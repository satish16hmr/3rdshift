import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isDisposableEmail, SIGNUP_EMAIL_ERROR } from '../lib/auth/disposable-email.js'

test('rejects known disposable email domains with a permanent-address message', () => {
  for (const email of [
    'sicar68440@luxudata.com',
    'user@mailinator.com',
    'user@guerrillamail.com',
    'user@10minutemail.com',
    'user@temp-mail.org',
  ]) {
    assert.equal(isDisposableEmail(email), true, email)
  }

  assert.equal(SIGNUP_EMAIL_ERROR, 'Please use a permanent email address.')
})

test('allows legitimate permanent email domains', () => {
  for (const email of [
    'person@gmail.com',
    'person@outlook.com',
    'founder@example-company.com',
    'ops@3rdshift.ai',
  ]) {
    assert.equal(isDisposableEmail(email), false, email)
  }
})
