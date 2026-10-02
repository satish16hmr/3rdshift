import Image from 'next/image'

import { Button } from '@/src/components/Button'
import { Container } from '@/src/components/Container'
import backgroundImage from '@/src/images/background-call-to-action.jpg'

export function CallToAction() {
  return (
    <section
      id="get-started-today"
      className="relative overflow-hidden bg-blue-600 py-32"
    >
      <Image
        className="absolute top-1/2 left-1/2 max-w-none -translate-x-1/2 -translate-y-1/2"
        src={backgroundImage}
        alt=""
        width={2347}
        height={1244}
        unoptimized
      />
      <Container className="relative">
        <div className="mx-auto max-w-lg text-center">
          <h2 className="font-display text-3xl tracking-tight text-white sm:text-4xl">
            Stop overpaying. Start shipping.
          </h2>
          <p className="mt-4 text-lg tracking-tight text-white">
            Every task you&rsquo;re outsourcing for hundreds or thousands of dollars a month
            can be done on 3rdShift in 60 seconds.
          </p>
          <Button href="/founding" color="white" className="mt-10">
            Get Founder Pricing →
          </Button>
        </div>
      </Container>
    </section>
  )
}
