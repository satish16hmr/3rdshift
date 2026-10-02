'use client'

import { useState } from 'react'
import LogoPng from '@/public/logo-hq.png'
import AuthBgPng from '@/public/images/auth/authBg.png'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import AuthFooter from '@/components/auth/AuthFooter'
import RightPanel from '@/components/auth/RightPanel'
import { Input } from '@/components/input'
import { Button } from '@/components/ui/button'

import Image from 'next/image'
import { Loader } from '@/components/loader'
import { forgotPasswordSchema } from '@/src/schema/auth.schema'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleReset = async () => {
    setError('')
    setFieldError('')

    const result = forgotPasswordSchema.safeParse({ email })

    if (!result.success) {
      setFieldError(result.error.issues[0]?.message || 'Invalid email')
      return
    }

    setLoading(true)

    const response = await fetch('/api/auth/password-reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: email.trim() }),
    })

    if (!response.ok) {
      const data = await response.json().catch(() => null)
      setError(data?.error || 'Error sending recovery email')
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  return (
    <div className='h-screen'>
      <div className="flex flex-col lg:flex-row h-[calc(100vh-61px)]">
        {/* ── Left column: form ── */}
        <div className="flex flex-1 flex-col md:justify-center p-3 sm:p-6 2xl:px-20 2xl:max-w-[50%] relative">
          <Image src={AuthBgPng} alt="Auth Background" className={`w-full h-full absolute top-0 left-0 z-0 lg:hidden`} width={1000} height={1000} />

          {
            sent ? (
              <div className="flex min-h-screen items-center justify-center">
                <div className="mx-auto w-full max-w-90">
                  <Image src={LogoPng} alt='logo' height={60} width={139} className='h-11 w-28 md:h-15 md:w-34.75' />

                  <h1 className="text-2xl md:text-3xl font-semibold text-zinc-950 mt-20">Check Email</h1>
                  <p className="mt-3 mb-8 text-neutral-500">We send a password reset link to   <strong>{email}</strong>.</p>
                  <Button variant='outline' className='h-11 min-w-40.5 flex items-center justify-center' onClick={() => router.push('/login')}>
                    <ArrowLeft className='h-5' /> Back to login
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mx-auto w-full md:max-w-[600px] lg:max-w-90 bg-white max-lg:h-fit relative z-10 max-lg:rounded-lg max-lg:py-8 max-lg:px-4">
                <Image src={LogoPng} alt='logo' height={60} width={139} className='h-11 w-28 md:h-15 md:w-34.75 cursor-pointer' onClick={() => { router.push("/") }} />

                <h1 className="text-2xl md:text-3xl xl:text-4xl font-semibold tracking-tight text-zinc-800 mt-10 sm:mt-20">
                  Reset your password
                </h1>
                <p className='text-neutral-500 mt-2 md:mt-3 text-sm md:text-base'>Enter your email and we’ll send you a reset link.</p>

                <div className='mt-8'>
                  <label className='text-sm text-zinc-700'>Email</label>
                  <Input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    autoComplete="email"
                    className="mt-1.5"
                    onChange={(e) => {
                      setEmail(e.target.value)
                      setFieldError('')
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleReset()}
                  />
                  {fieldError && <p className="mt-2 text-sm text-red-500">{fieldError}</p>}
                  {error && (
                    <p className="mt-2 text-sm text-red-500">{error}</p>
                  )}
                  {/* {error && <p className="mt-2 text-sm text-red-500">{error}</p>} */}

                  <Button variant="primary" className="w-full h-11 flex items-center justify-center mt-6" onClick={handleReset} disabled={!email.trim() || loading}>
                    {loading ? <Loader size={5} /> : 'Send reset link'}
                  </Button>
                </div>
              </div>
            )
          }
        </div>

        {/* ── Right column: branded visual ── */}
        <RightPanel />
      </div>
      <AuthFooter />
    </div>
  )
}
