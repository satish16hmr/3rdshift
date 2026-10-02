import { getSelectedMode, getCreditCost } from './modeResolver'

declare function describe(name: string, fn: () => void): void
declare function test(name: string, fn: () => void): void
declare function expect(actual: unknown): {
  toBe(expected: unknown): void
  toBeNull(): void
}

const workerWithModeField = {
  workerModeField: 'plan_mode',
  modeCredits: { executive_summary: 0, investor_plan: 1, bank_lender_plan: 1 },
  creditCost: 1,
}

const workerLegacy = {
  workerModeField: 'course_mode',
  modeCredits: { mini_course: 0, signature: 2 },
  creditCost: 1,
}

const workerNoModeField = {
  modeCredits: { quick_sketch: 0, full_set: 1 },
  creditCost: 1,
}

const workerNoModeCredits = {
  creditCost: 2,
}

// --- getSelectedMode ---

describe('getSelectedMode', () => {
  test('returns workerModeField value when set and present in formValues', () => {
    expect(getSelectedMode(workerWithModeField, { plan_mode: 'investor_plan' })).toBe('investor_plan')
  })

  test('returns null when workerModeField set but not in formValues', () => {
    expect(getSelectedMode(workerWithModeField, {})).toBeNull()
  })

  test('falls back to legacy course_mode field', () => {
    expect(getSelectedMode(workerLegacy, { course_mode: 'mini_course' })).toBe('mini_course')
  })

  test('falls back to other legacy fields (page_type)', () => {
    const w = { workerModeField: 'page_type' }
    expect(getSelectedMode(w, { page_type: 'homepage' })).toBe('homepage')
  })

  test('returns null when no mode found anywhere', () => {
    expect(getSelectedMode(workerNoModeField, {})).toBeNull()
  })

  test('URL param overrides formValues', () => {
    const params = new URLSearchParams('mode=bank_lender_plan')
    expect(getSelectedMode(workerWithModeField, { plan_mode: 'investor_plan' }, params)).toBe('bank_lender_plan')
  })

  test('URL param overrides even when formValues has matching field', () => {
    const params = new URLSearchParams('mode=executive_summary')
    expect(getSelectedMode(workerWithModeField, { plan_mode: 'investor_plan' }, params)).toBe('executive_summary')
  })

  test('handles null searchParams gracefully', () => {
    expect(getSelectedMode(workerWithModeField, { plan_mode: 'investor_plan' }, null)).toBe('investor_plan')
  })

  test('workerModeField takes priority over legacy fields', () => {
    const w = { workerModeField: 'plan_mode' }
    // Even if a legacy field exists, plan_mode wins
    expect(getSelectedMode(w, { plan_mode: 'executive_summary', course_mode: 'mini_course' })).toBe('executive_summary')
  })
})

// --- getCreditCost ---

describe('getCreditCost', () => {
  test('returns 0 for free mode in modeCredits', () => {
    expect(getCreditCost(workerWithModeField, 'executive_summary')).toBe(0)
  })

  test('returns correct cost for paid mode in modeCredits', () => {
    expect(getCreditCost(workerWithModeField, 'investor_plan')).toBe(1)
  })

  test('returns worker.creditCost when mode not in modeCredits', () => {
    expect(getCreditCost(workerWithModeField, 'unknown_mode')).toBe(1)
  })

  test('returns worker.creditCost when selectedMode is null', () => {
    expect(getCreditCost(workerWithModeField, null)).toBe(1)
  })

  test('returns worker.creditCost when no modeCredits at all', () => {
    expect(getCreditCost(workerNoModeCredits, 'any_mode')).toBe(2)
  })

  test('returns 0 when no modeCredits and creditCost is 0', () => {
    expect(getCreditCost({ creditCost: 0 }, null)).toBe(0)
  })

  test('returns 0 when creditCost is undefined and no modeCredits', () => {
    expect(getCreditCost({}, null)).toBe(0)
  })
})
