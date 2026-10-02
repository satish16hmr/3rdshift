"use client";

import { useState } from "react";
import ReactPlayer from "react-player";
import { ArrowRight, Pause, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogBody } from "@/components/dialog";


export default function WelcomeModal() {
  const [open, setOpen] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <Dialog
      open={open}
      onClose={setOpen}
      size="5xl"
      className="p-0! relative z-10 w-full max-w-[95%] sm:max-w-125 md:max-w-150 overflow-hidden rounded-xl bg-white shadow-2xl">
      <DialogBody className="mt-0!">
        <div
          className="group relative aspect-video overflow-hidden"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <ReactPlayer
            src="/video.mp4"
            controls={playing}
            playing={playing}
            width="100%"
            height="100%"
          />

          {!playing && (
            <button
              onClick={() => setPlaying(true)}
              className="absolute inset-0 flex cursor-pointer items-center justify-center"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/25 backdrop-blur-xl shadow-2xl transition-all duration-200">
                {playing ? (
                  <Pause
                    size={35}
                    fill="currentColor"
                    className="text-white"
                  />
                ) : (
                  <Play
                    size={35}
                    fill="currentColor"
                    className="ml-1 text-white"
                  />
                )}
              </div>
            </button>
          )}
        </div>

        <div className="hidden px-6 py-7.75 sm:block">
          <h2 className="text-center text-2xl font-semibold text-zinc-800">
            Your team is ready. Let's get something done.
          </h2>

          <p className="mt-3 text-center text-base leading-6 text-neutral-500">
            Everything is set up for high-speed collaboration.
            See who's online or start a new workflow.
          </p>

          <div className="mt-6 flex items-center justify-center gap-3 border-t border-zinc-200 bg-zinc-50 pt-[25px]">
            <Button variant="outline">
              Pick a quick action
            </Button>

            <Button variant="primary">
              Browse your team
              <ArrowRight />
            </Button>
          </div>
        </div>
      </DialogBody>
    </Dialog>
  );
}