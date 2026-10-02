// @ts-nocheck
import Image from 'next/image'
import logoWordmark from '@/src/images/logo-wordmark.png'
import logoWhite from '@/src/images/logo-wordmark-white.png'

export function Logo(props) {
  return (
    <Image src={logoWordmark} alt="3rdShift" className="h-10 w-auto" unoptimized {...props} />
  )
}

export function LogoWhite(props) {
  return (
    <Image src={logoWhite} alt="3rdShift" className="h-10 w-auto" unoptimized {...props} />
  )
}
