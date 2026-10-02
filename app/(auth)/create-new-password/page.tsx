'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import LogoPng from '@/public/logo-hq.png'
import AuthBgPng from '@/public/images/auth/authBg.png'

import AuthFooter from '@/components/auth/AuthFooter'
import RightPanel from '@/components/auth/RightPanel'
import { Input } from '@/components/input'
import { Button } from '@/components/ui/button'
import { Loader } from '@/components/loader'

import { createClient } from '@/lib/supabase/client'
import { resetPasswordSchema } from '../../../src/schema/auth.schema'

export default function CreateNewPassword() {
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const router = useRouter()

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const [fieldErrors, setFieldErrors] = useState<{
        password?: string
        confirmPassword?: string
    }>({})

    const handleResetPassword = async () => {
        setError('')
        setFieldErrors({})

        const result = resetPasswordSchema.safeParse({
            password,
            confirmPassword,
        })

        if (!result.success) {
            const errors: typeof fieldErrors = {}

            result.error.issues.forEach((err) => {
                const field = err.path[0] as keyof typeof errors
                errors[field] = err.message
            })

            setFieldErrors(errors)
            return
        }

        setLoading(true)

        const supabase = createClient()

        const { error: updateError } = await supabase.auth.updateUser({
            password: result.data.password,
        })

        if (updateError) {
            setError(updateError.message)
            setLoading(false)
            return
        }

        setLoading(false)

        // redirect after success
        router.push('/login')
    }

    return (
        <div className='h-screen'>
            <div className="flex flex-col lg:flex-row h-[calc(100vh-61px)]">

                {/* ── Left column: form ── */}
                <div className="flex flex-1 flex-col md:justify-center p-3 sm:p-6 2xl:px-20 2xl:max-w-[50%] relative">
                    <Image src={AuthBgPng} alt="Auth Background" className={`w-full h-full absolute top-0 left-0 z-0 lg:hidden`} width={1000} height={1000} />

                    <div className="mx-auto w-full md:max-w-[600px] lg:max-w-90 bg-white max-lg:h-fit relative z-10 max-lg:rounded-md max-lg:py-8 max-lg:px-4">

                        <Image src={LogoPng} alt='logo' height={60} width={139} className='h-11 w-28 md:h-15 md:w-34.75 cursor-pointer' onClick={() => { router.push("/") }} />

                        <h1 className="text-2xl md:text-3xl xl:text-4xl font-semibold tracking-tight text-zinc-800 mt-10 sm:mt-20">
                            Create Your New Password
                        </h1>

                        <p className='text-neutral-500 mt-2 md:mt-3 text-sm md:text-base'>
                            Set a unique password to protect your data.
                        </p>

                        <div className='mt-8 space-y-6'>
                            <div>
                                <label className='text-sm text-zinc-700'>Password</label>
                                <Input
                                    type="password"
                                    showPasswordToggle
                                    placeholder="****"
                                    value={password}
                                    error={fieldErrors.password}
                                    onChange={(e) => {
                                        setPassword(e.target.value)
                                        setFieldErrors((prev) => ({
                                            ...prev,
                                            password: '',
                                        }))
                                    }}
                                    autoComplete="new-password"
                                    className="mt-1.5"
                                />
                            </div>

                            <div>
                                <label className='text-sm text-zinc-700'>Confirm Password</label>
                                <Input
                                    type="password"
                                    showPasswordToggle
                                    placeholder="****"
                                    value={confirmPassword}
                                    error={fieldErrors.confirmPassword}
                                    onChange={(e) => {
                                        setConfirmPassword(e.target.value)
                                        setFieldErrors((prev) => ({
                                            ...prev,
                                            confirmPassword: '',
                                        }))
                                    }}
                                    autoComplete="new-password"
                                    className="mt-1.5"
                                />
                            </div>

                            {error && (
                                <p className="text-sm text-red-500">{error}</p>
                            )}

                            <Button
                                variant="primary"
                                className="w-full h-11 flex items-center justify-center mt-6"
                                onClick={handleResetPassword}
                                disabled={loading}
                            >
                                {loading ? <Loader size={5} /> : 'Reset password'}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* ── Right column: branded visual ── */}
                <RightPanel />
            </div>

            <AuthFooter />
        </div>
    )
}