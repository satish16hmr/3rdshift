import { z } from 'zod'

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),

  password: z
    .string()
    .min(1, 'Password is required')
    .min(6, 'Password must be at least 6 characters'),
})

export type LoginInput = z.infer<typeof loginSchema>


export const signupSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .trim()
    .refine((val) => /^[A-Za-z\s]+$/.test(val), {
      message: 'Names can only contain letters',
    }),

  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
    .toLowerCase()
    .trim(),

  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .refine((val) => /[a-z]/.test(val), {
      message: 'Please Include at least one lowercase letter',
    })
    .refine((val) => /[A-Z]/.test(val), {
      message: 'Please Include at least one uppercase letter',
    })
    .refine((val) => /\d/.test(val), {
      message: 'Please Include at least one number',
    })
    .refine((val) => /[^A-Za-z0-9]/.test(val), {
      message: 'Please Include a symbol',
    }),
})

export type SignupInput = z.infer<typeof signupSchema>

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
})

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>


export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(1, 'Password is required')
      .min(6, 'Password must be at least 6 characters'),

    confirmPassword: z
      .string()
      .min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
