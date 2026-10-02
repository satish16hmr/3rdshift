import Image from "next/image";
import AuthBgPng from '@/public/images/auth/authBg.png'
import TeamMemberPng from '@/public/images/auth/team-member.png'
import GetWorkPng from '@/public/images/auth/get-work.png'
import DescribeTaskPng from '@/public/images/auth/describe-task.png'

type RightPanelProps = {
    signUp?: boolean;
    bgImg?: any;
    title?: any
    description?: any
    titleClassName?: any
    descriptionClassName?: any
    bgImgClassName?: any
    textContainerClassName?: any
}

export default function RightPanel({ signUp = false,textContainerClassName = '', bgImg = AuthBgPng, title = `70+ AI Team Members, ready when you are`, description = `Pick from 70+ AI team members across marketing, writing, and more. Just choose, assign, and get things done.`, titleClassName = ``, descriptionClassName = ``, bgImgClassName = `` }: RightPanelProps) {
    return (
        <>
            <div className="hidden flex-1 flex-col items-center justify-center p-3 lg:flex relative max-w-[50%] w-full">
                <Image src={bgImg} alt="Auth Background" className={`w-full h-[calc(100vh-87px)] mb-auto rounded-3xl border border-zinc-300 ${bgImgClassName} max-2xl:object-cover`} width={1000} height={1000} />
                {
                    !signUp && (
                        <div className="absolute top-60 left-[42%] min-[1110px]:left-[41%] min-[1231px]:left-[42%] min-[1362px]:left-[44%] min-[1610px]:left-[45%] min-[1611px]:left-[40%] min-[1660px]:left-[40%] min-[1710px]:left-[42%] min-[1750px]:left-[45%] -translate-x-1/2 flex items-start gap-4">
                            <Image
                                src={TeamMemberPng}
                                alt="team member"
                                className="size-32 min-[1110px]:size-38 min-[1231px]:size-40 min-[1610px]:w-52 min-[1610px]:h-55.25"
                                width={208}
                                height={221}
                                quality={1000}
                            />
                            <Image
                                src={GetWorkPng}
                                alt="get work"
                                className="size-32 min-[1110px]:size-38 min-[1231px]:size-40 min-[1610px]:w-52 min-[1610px]:h-55.25 mt-16"
                                width={208}
                                height={221}
                                quality={1000}
                            />
                            <Image
                                src={DescribeTaskPng}
                                alt="describe task"
                                className="size-32 min-[1110px]:size-38 min-[1231px]:size-40 min-[1610px]:w-52 min-[1610px]:h-55.25 mt-36"
                                width={208}
                                height={221}
                                quality={1000}
                            />
                        </div>
                    )
                }
                <div className={`${textContainerClassName} absolute z-20 bottom-20 left-10 xl:left-20 max-w-125.25`}>
                    <h3 className={`text-zinc-950 max-w-96 min-[1610px]:max-w-full text-3xl min-[1603px]:text-4xl min-[1610px]:text-5xl min-[1610px]:leading-15 ${titleClassName}`}>
                        {title}
                    </h3>
                    <p className={`mt-3 text-zinc-500 max-w-[90%] xl:max-w-full min-[1610px]:text-lg ${descriptionClassName}`}>
                        {description}
                    </p>
                </div>
            </div>
        </>
    )
}