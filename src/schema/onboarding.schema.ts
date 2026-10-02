import { z } from 'zod'

export const personalDetailsSchema = z.object({
    name: z
        .string()
        .trim()
        .min(2, 'Name must be at least 2 characters')
        .max(100, 'Name is too long'),

    avatar_url: z.string().url().nullable().optional(),

    additional_context: z.string().optional(),
})


export const onboardingStep2Schema = z.object({
    companyName: z
        .string()
        .trim()
        .optional(),

    targetAudience: z
        .string()
        .trim()
        .min(5, 'Target audience is too short')
        .max(200, 'Target audience is too long'),

    industry: z
        .string()
        .trim()
        .min(2, 'Industry is required')
        .max(100),

    competitors: z
        .string()
        .trim()
        .optional(),

    brandTone: z
        .string()
        .trim()
        .min(5, 'Brand tone is required')
        .max(300),

    additional_context: z
        .string()
        .trim()
        .optional(),
})