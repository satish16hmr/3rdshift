import { Dialog, DialogBody } from '@/components/dialog'
import { CheckCircle2, ArrowRight } from 'lucide-react'
import Image from 'next/image'
import UpgradeConfettiPng from '@/public/images/auth/confetti.png'
import UpgradeBgPng from '@/public/images/auth/upgradePlanBg.png'
import { Button } from '../ui/button'
import { createPortal } from 'react-dom'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Pagination } from 'swiper/modules'
import 'swiper/css'
import { useState } from 'react'
interface UpgradeSuccessModalProps {
    open: boolean
    onClose: () => void
    onContinue?: () => void
}

export default function UpgradeSuccessModal({
    open,
    onClose,
    onContinue,
}: UpgradeSuccessModalProps) {
    const [activeIndex, setActiveIndex] = useState(0)

    return createPortal(
        <Dialog
            open={open}
            onClose={onClose}
            size="md"
            className="overflow-hidden p-0! w-[95%]! lg:min-w-[600px]"
        >
            <Swiper
                modules={[Pagination]}
                slidesPerView={1}
                onSlideChange={(swiper) => setActiveIndex(swiper.activeIndex)}
            >
                <SwiperSlide>
                    <div className="relative h-[200px] sm:h-[320px] overflow-hidden bg-blue-950">
                        <Image src={UpgradeBgPng} alt='UpgradeBgPng' fill className='w-full h-full object-cover' />
                        <Image src={UpgradeConfettiPng} alt='UpgradeConfettiPng' fill className='absolute top-0 left-0' />
                    </div>
                </SwiperSlide>
                <SwiperSlide>
                    <div className="relative h-[200px] sm:h-[320px] overflow-hidden bg-blue-950">
                        <Image src={UpgradeBgPng} alt='UpgradeBgPng' fill className='w-full h-full object-cover' />
                        <Image src={UpgradeConfettiPng} alt='UpgradeConfettiPng' fill className='absolute top-0 left-0' />
                    </div>
                </SwiperSlide>
                <SwiperSlide>
                    <div className="relative h-[200px] sm:h-[320px] overflow-hidden bg-blue-950">
                        <Image src={UpgradeBgPng} alt='UpgradeBgPng' fill className='w-full h-full object-cover' />
                        <Image src={UpgradeConfettiPng} alt='UpgradeConfettiPng' fill className='absolute top-0 left-0' />
                    </div>
                </SwiperSlide>
            </Swiper>

            <DialogBody className="mt-0! p-0!">
                <div className="flex justify-center gap-2 mt-5">
                    {[0, 1, 2].map((index) => (
                        <div
                            key={index}
                            className={`h-2 w-2 rounded-full transition-colors ${activeIndex === index
                                    ? 'bg-blue-500'
                                    : 'bg-zinc-300'
                                }`}
                        />
                    ))}
                </div>
                <div className="px-6 text-center mt-5 md:mt-10">
                    <h2 className="text-xl md:text-2xl font-semibold text-zinc-800">
                        Welcome to Pro Plan
                    </h2>

                    <p className="mt-3 mb-4 md:mt-6 md:mb-8 text-sm md:text-base leading-6 text-neutral-500">
                        Unlock advanced workflows, premium automations, team collaboration,
                        and priority support to scale your productivity faster.
                    </p>
                </div>

                <div className="bg-zinc-50 border-t border-zinc-200 py-6 flex justify-center">
                    <Button
                        onClick={onContinue}
                        variant='primary'
                    >
                        Continue
                        <ArrowRight className="size-4" />
                    </Button>
                </div>
            </DialogBody>
        </Dialog>,
        document.body
    )
}