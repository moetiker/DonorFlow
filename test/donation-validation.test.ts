import { test } from 'node:test'
import assert from 'node:assert/strict'
import { updateDonationSchema, updateMemberSchema, memberEmailSchema } from '../lib/validation'

test('update with only an amount is valid', () => {
  assert.equal(updateDonationSchema.safeParse({ amount: 10 }).success, true)
})

test('update that clears both recipients is rejected', () => {
  assert.equal(updateDonationSchema.safeParse({ memberId: null, groupId: null }).success, false)
})

test('update that clears the only key present is rejected', () => {
  assert.equal(updateDonationSchema.safeParse({ memberId: null }).success, false)
})

test('update that sets only memberId is valid', () => {
  assert.equal(updateDonationSchema.safeParse({ memberId: 'm1' }).success, true)
})

test('update that sets both recipients is rejected', () => {
  assert.equal(updateDonationSchema.safeParse({ memberId: 'm1', groupId: 'g1' }).success, false)
})

test('member update accepts an empty or legacy malformed email', () => {
  assert.equal(updateMemberSchema.safeParse({ firstName: 'A', email: '' }).success, true)
  assert.equal(updateMemberSchema.safeParse({ firstName: 'A', email: null }).success, true)
  assert.equal(updateMemberSchema.safeParse({ firstName: 'A', email: 'not-an-email' }).success, true)
})

test('a changed member email must be well-formed', () => {
  assert.equal(memberEmailSchema.safeParse({ email: 'not-an-email' }).success, false)
  assert.equal(memberEmailSchema.safeParse({ email: 'a@example.org' }).success, true)
})
