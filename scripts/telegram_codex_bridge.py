#!/usr/bin/env python3
"""Telegram to Codex CLI bridge for JR's local Mac mini."""

from __future__ import annotations

import json
import logging
import os
import socket
import signal
import ssl
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


REPO_DIR = Path(
    os.environ.get(
        "TELEGRAM_CODEX_REPO_DIR",
        "/Users/3rdshift/.openclaw/workspace/3rdshift-frontend",
    )
)
LOG_PATH = Path(
    os.environ.get(
        "TELEGRAM_CODEX_LOG",
        str(Path.home() / "Library/Logs/3rdshift/telegram-codex-bridge.log"),
    )
)
CODEX_BIN = os.environ.get("CODEX_BIN", "codex")
CODEX_SESSION_ID = os.environ.get("TELEGRAM_CODEX_SESSION_ID", "").strip()
TELEGRAM_LIMIT = 4096
CHUNK_BODY_LIMIT = 3900
FLUSH_SECONDS = 2.0
TELEGRAM_NETWORK_RETRIES = 10
DIVIDER_LINE = "--------"


class BridgeState:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.process: subprocess.Popen[str] | None = None
        self.started_at: float | None = None
        self.prompt: str | None = None
        self.starting = False
        self.stop_requested = False

    def is_running(self) -> bool:
        with self.lock:
            return self.starting or (self.process is not None and self.process.poll() is None)


STATE = BridgeState()


def setup_logging() -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        filename=str(LOG_PATH),
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )
    console = logging.StreamHandler(sys.stdout)
    console.setLevel(logging.INFO)
    console.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logging.getLogger().addHandler(console)


def required_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def telegram_request(token: str, method: str, data: dict[str, Any]) -> dict[str, Any]:
    url = f"https://api.telegram.org/bot{token}/{method}"
    body = urllib.parse.urlencode(data).encode("utf-8")
    request = urllib.request.Request(url, data=body, method="POST")
    last_error_key: tuple[str, str] | None = None
    consecutive_errors = 0

    while True:
        try:
            with urllib.request.urlopen(request, timeout=70) as response:
                payload = response.read().decode("utf-8")
            result = json.loads(payload)
            if not result.get("ok"):
                raise RuntimeError(f"Telegram API error from {method}: {result}")
            return result
        except (ssl.SSLError, urllib.error.URLError, socket.timeout, ConnectionError) as exc:
            error_key = (type(exc).__name__, str(exc))
            if error_key == last_error_key:
                consecutive_errors += 1
            else:
                last_error_key = error_key
                consecutive_errors = 1

            if consecutive_errors >= TELEGRAM_NETWORK_RETRIES:
                message = (
                    f"Telegram API network call failed {consecutive_errors} times in a row "
                    f"for {method}: {type(exc).__name__}: {exc}"
                )
                logging.critical(message)
                raise SystemExit(message) from exc

            logging.warning(
                "Telegram API network error for %s; retrying in 5s "
                "(same_error_count=%s/%s): %s: %s",
                method,
                consecutive_errors,
                TELEGRAM_NETWORK_RETRIES,
                type(exc).__name__,
                exc,
            )
            time.sleep(5)


def send_message(token: str, chat_id: str, text: str) -> None:
    telegram_request(
        token,
        "sendMessage",
        {
            "chat_id": chat_id,
            "text": text[:TELEGRAM_LIMIT],
            "disable_web_page_preview": "true",
        },
    )


def try_send_message(token: str, chat_id: str, text: str) -> bool:
    try:
        send_message(token, chat_id, text)
        return True
    except Exception:
        logging.exception("Failed to send Telegram message")
        return False


def split_codex_chunks(text: str) -> list[str]:
    if not text:
        return []

    chunks: list[str] = []
    remaining = text
    while remaining:
        piece = remaining[:CHUNK_BODY_LIMIT]
        split_at = max(piece.rfind("\n"), piece.rfind(" "))
        if len(remaining) > CHUNK_BODY_LIMIT and split_at > 1000:
            piece = piece[:split_at]
        chunks.append(piece)
        remaining = remaining[len(piece) :].lstrip("\n")
    return chunks


def send_codex_output(token: str, chat_id: str, text: str) -> None:
    chunks = split_codex_chunks(text)
    total = len(chunks)
    for index, chunk in enumerate(chunks, start=1):
        prefix = f"[Codex {index}/{total}]\n"
        message = prefix + chunk
        if len(message) > TELEGRAM_LIMIT:
            message = message[:TELEGRAM_LIMIT]
        try_send_message(token, chat_id, message)


def remove_duplicate_trailing_copy(text: str) -> str:
    stripped = text.strip()
    if not stripped:
        return ""

    for length in range(len(stripped) // 2, 20, -1):
        suffix = stripped[-length:].strip()
        prefix = stripped[: -length].rstrip()
        if not suffix or not prefix.endswith(suffix):
            continue
        before_duplicate = prefix[: -len(suffix)].rstrip()
        if before_duplicate:
            return prefix
    return stripped


def clean_codex_output(raw_output: str) -> str:
    lines = raw_output.splitlines()
    divider_count = 0
    start_index = 0

    for index, line in enumerate(lines):
        if line.strip() == DIVIDER_LINE:
            divider_count += 1
            if divider_count == 2:
                start_index = index + 1
                break
    else:
        if divider_count:
            return ""

    cleaned: list[str] = []
    skip_next = False
    skip_token_count = False

    for line in lines[start_index:]:
        stripped = line.strip()

        if skip_next:
            skip_next = False
            continue

        if skip_token_count:
            skip_token_count = False
            if stripped.replace(",", "").isdigit():
                continue

        if stripped.startswith("Reading additional input"):
            continue

        if stripped == DIVIDER_LINE:
            continue

        if stripped == "user":
            skip_next = True
            continue

        if stripped == "codex":
            continue

        if stripped == "tokens used":
            skip_token_count = True
            continue

        cleaned.append(line)

    return remove_duplicate_trailing_copy("\n".join(cleaned))


class CodexOutputFilter:
    def __init__(self) -> None:
        self.raw_parts: list[str] = []
        self.sent_chars = 0

    def append(self, text: str) -> None:
        self.raw_parts.append(text)

    def next_text(self) -> str:
        cleaned = clean_codex_output("".join(self.raw_parts))
        if len(cleaned) <= self.sent_chars:
            return ""

        next_text = cleaned[self.sent_chars :].lstrip("\n")
        self.sent_chars = len(cleaned)
        return next_text


def status_text() -> str:
    with STATE.lock:
        process = STATE.process
        started_at = STATE.started_at
        prompt = STATE.prompt
        starting = STATE.starting

    if starting and started_at is not None:
        elapsed = int(time.time() - started_at)
        prompt_preview = (prompt or "").replace("\n", " ")[:120]
        return f"Codex status: starting for {elapsed}s\nPrompt: {prompt_preview}"

    if process is None or process.poll() is not None or started_at is None:
        return "Codex status: idle"

    elapsed = int(time.time() - started_at)
    prompt_preview = (prompt or "").replace("\n", " ")[:120]
    return f"Codex status: running for {elapsed}s\nPrompt: {prompt_preview}"


def stop_codex() -> str:
    with STATE.lock:
        process = STATE.process
        if process is None or process.poll() is not None:
            return "Codex is not running."
        STATE.stop_requested = True

    logging.info("Stop requested for Codex process pid=%s", process.pid)
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        return "Codex process already exited."
    except Exception as exc:
        logging.exception("Failed to terminate Codex process")
        return f"Failed to stop Codex: {exc}"

    def force_kill_if_needed() -> None:
        time.sleep(10)
        if process.poll() is None:
            logging.warning("Codex still running after SIGTERM; sending SIGKILL pid=%s", process.pid)
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                return
            except Exception:
                logging.exception("Failed to SIGKILL Codex process")

    threading.Thread(target=force_kill_if_needed, daemon=True).start()
    return "Stop requested. Codex process is terminating."


def run_codex(token: str, chat_id: str, prompt: str) -> None:
    command = [
        CODEX_BIN,
        "exec",
        "--sandbox",
        "workspace-write",
        "-c",
        'approval_policy="never"',
    ]
    if CODEX_SESSION_ID:
        command.extend(["resume", CODEX_SESSION_ID, prompt])
    else:
        command.append(prompt)
    logging.info("Starting Codex prompt_len=%s cwd=%s", len(prompt), REPO_DIR)

    try:
        process = subprocess.Popen(
            command,
            cwd=str(REPO_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            start_new_session=True,
        )
    except Exception as exc:
        logging.exception("Failed to start Codex")
        try_send_message(token, chat_id, f"Failed to start Codex: {exc}")
        with STATE.lock:
            STATE.process = None
            STATE.started_at = None
            STATE.prompt = None
            STATE.starting = False
            STATE.stop_requested = False
        return

    with STATE.lock:
        STATE.process = process
        STATE.started_at = time.time()
        STATE.prompt = prompt
        STATE.starting = False
        STATE.stop_requested = False

    try_send_message(token, chat_id, f"Codex started. pid={process.pid}")

    buffered: list[str] = []
    buffered_chars = 0
    last_flush = time.time()
    output_filter = CodexOutputFilter()

    def flush(force: bool = False) -> None:
        nonlocal buffered_chars, last_flush
        if not buffered:
            return
        if not force and buffered_chars < CHUNK_BODY_LIMIT and time.time() - last_flush < FLUSH_SECONDS:
            return
        raw_text = "".join(buffered)
        buffered.clear()
        buffered_chars = 0
        last_flush = time.time()
        output_filter.append(raw_text)
        text = output_filter.next_text()
        if text:
            logging.info("Sending Codex output chars=%s", len(text))
            send_codex_output(token, chat_id, text)

    return_code: int | None = None
    try:
        assert process.stdout is not None
        for line in process.stdout:
            logging.info("codex: %s", line.rstrip())
            buffered.append(line)
            buffered_chars += len(line)
            flush()
        return_code = process.wait()
        flush(force=True)
    except Exception:
        logging.exception("Error while reading Codex output")
        try_send_message(token, chat_id, "Bridge error while reading Codex output. Check local log.")
    finally:
        with STATE.lock:
            stopped = STATE.stop_requested
            STATE.process = None
            STATE.started_at = None
            STATE.prompt = None
            STATE.starting = False
            STATE.stop_requested = False

    if return_code is None:
        return
    if stopped:
        try_send_message(token, chat_id, f"Codex stopped. exit={return_code}")
    elif return_code == 0:
        try_send_message(token, chat_id, "Codex finished. exit=0")
    else:
        try_send_message(token, chat_id, f"Codex exited with error. exit={return_code}")
    logging.info("Codex finished return_code=%s stopped=%s", return_code, stopped)


def handle_message(token: str, authorized_chat_id: str, message: dict[str, Any]) -> None:
    chat = message.get("chat", {})
    chat_id = str(chat.get("id", ""))
    text = message.get("text", "")
    message_id = message.get("message_id")

    if chat_id != authorized_chat_id:
        logging.warning("Ignored unauthorized chat_id=%s message_id=%s", chat_id, message_id)
        return

    logging.info(
        "Received authorized message_id=%s text_len=%s text=%r",
        message_id,
        len(text),
        text,
    )
    command = text.strip()

    if command == "/status":
        send_message(token, chat_id, status_text())
        return

    if command == "/stop":
        send_message(token, chat_id, stop_codex())
        return

    if not command:
        try_send_message(token, chat_id, "Send a task, /status, or /stop.")
        return

    if STATE.is_running():
        try_send_message(token, chat_id, "Codex is already running. Use /status or /stop.")
        return

    with STATE.lock:
        STATE.starting = True
        STATE.started_at = time.time()
        STATE.prompt = text

    thread = threading.Thread(target=run_codex, args=(token, chat_id, text), daemon=True)
    thread.start()


def poll_loop(token: str, authorized_chat_id: str) -> None:
    offset = 0
    logging.info("Bridge started repo=%s log=%s", REPO_DIR, LOG_PATH)
    while True:
        try:
            result = telegram_request(
                token,
                "getUpdates",
                {
                    "offset": offset,
                    "timeout": 50,
                    "allowed_updates": json.dumps(["message"]),
                },
            )
            for update in result.get("result", []):
                offset = max(offset, int(update["update_id"]) + 1)
                message = update.get("message")
                if message:
                    handle_message(token, authorized_chat_id, message)
        except urllib.error.URLError:
            logging.exception("Telegram network error")
            time.sleep(5)
        except KeyboardInterrupt:
            logging.info("Bridge interrupted")
            break
        except Exception:
            logging.exception("Unexpected bridge error")
            time.sleep(5)


def main() -> int:
    setup_logging()
    token = required_env("TELEGRAM_BOT_TOKEN")
    authorized_chat_id = required_env("TELEGRAM_AUTHORIZED_CHAT_ID")
    poll_loop(token, authorized_chat_id)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
