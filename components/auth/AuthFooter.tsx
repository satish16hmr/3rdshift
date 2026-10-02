import Link from "next/link";

export default function AuthFooter() {
    return (
        <footer className="fixed! bottom-0! left-0! w-full! bg-white! border-t! border-zinc-200! p-4! sm:p-5! z-30! justify-between!">
            {/* Mobile Layout */}
            <div className="sm:hidden! space-y-3!">
                <div className="flex! justify-between! items-center!">
                    <a
                        href="mailto:hello@3rdshift.ai"
                        className="text-sm! text-neutral-500! hover:text-blue-500! text-left!"
                    >
                        Contact Us
                    </a>

                    <Link
                        href="/privacy"
                        className="text-sm! text-neutral-500! hover:text-blue-500! text-left!"
                    >
                        Privacy Policy
                    </Link>
                </div>

                <div className="flex! justify-between! items-center!">
                    <p className="text-sm! text-neutral-500! text-left!">
                        ©2026 3rdShift
                    </p>

                    <Link
                        href="/terms"
                        className="text-sm! text-neutral-500! hover:text-blue-500! text-left!"
                    >
                        Terms of Service
                    </Link>
                </div>
            </div>

            {/* Desktop Layout */}
            <div className="hidden! sm:flex! items-center! justify-between! w-full!">
                <a
                    href="mailto:hello@3rdshift.ai"
                    className="text-sm! text-neutral-500! hover:text-blue-500!"
                >
                    Contact Us
                </a>

                <div className="flex! items-center! gap-10!">
                    <Link
                        href="/privacy"
                        className="text-sm! text-neutral-500! hover:text-blue-500!"
                    >
                        Privacy Policy
                    </Link>

                    <Link
                        href="/terms"
                        className="text-sm! text-neutral-500! hover:text-blue-500!"
                    >
                        Terms of Service
                    </Link>

                    <p className="text-sm! text-neutral-500!">
                        ©2026 3rdShift
                    </p>
                </div>
            </div>
        </footer>
    );
}   