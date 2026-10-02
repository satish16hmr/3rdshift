# Secret scanning gate

This repo uses Gitleaks as a local pre-commit gate.

## Install

1. Install Gitleaks on macOS:

   ```sh
   brew install gitleaks
   ```

2. Install the tracked git hook for this clone:

   ```sh
   npm run hooks:install
   ```

`npm install` also runs `prepare`, which points Git at `.githooks/` for future clones that install dependencies.

## Commands

- `npm run secrets:scan:staged` scans the staged snapshot, matching what the pre-commit hook checks.
- `npm run secrets:scan` is an alias for the staged scan.

## Coverage

The `.gitleaks.toml` config extends the default Gitleaks rules and adds project-specific blocks for:

- Supabase access token prefixes
- GitHub classic and fine-grained PAT prefixes
- Stripe/OpenAI-style secret key prefixes
- Stripe webhook signing secret prefixes
- Supabase service-role/JWT-shaped values
- Generic high-entropy credential-like assignments

The hook must stay blocking. Do not bypass it with `--no-verify` unless rotating/removing an already-leaked value in a private emergency branch.
