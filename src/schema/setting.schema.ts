import { z } from 'zod'

export const nameSchema = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name is too long')

export const emailSchema = z
  .string()
  .trim()
  .email('Please enter a valid email address')

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long')

export const deleteConfirmationSchema = z.literal('DELETE')

export const accountUpdateSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema.optional(),
})

export type AccountUpdateInput = z.infer<typeof accountUpdateSchema>