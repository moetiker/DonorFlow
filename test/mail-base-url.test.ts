import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getMailBaseUrl } from '../lib/mailing-data'

/**
 * The status links in every sent mail are built on this base URL. It must come
 * from the configuration alone — deriving it from the request would let a
 * forged Host header point the tokens at someone else's server.
 */

function withEnv(value: string | undefined, run: () => void) {
  const previous = process.env.NEXTAUTH_URL
  if (value === undefined) delete process.env.NEXTAUTH_URL
  else process.env.NEXTAUTH_URL = value
  try {
    run()
  } finally {
    if (previous === undefined) delete process.env.NEXTAUTH_URL
    else process.env.NEXTAUTH_URL = previous
  }
}

test('the base URL comes from NEXTAUTH_URL', () => {
  withEnv('https://example.org', () => {
    assert.equal(getMailBaseUrl(), 'https://example.org')
  })
})

test('a trailing slash is dropped so the status path is not doubled', () => {
  withEnv('https://example.org/', () => {
    assert.equal(getMailBaseUrl(), 'https://example.org')
  })
})

test('an unset or blank NEXTAUTH_URL yields null, so the caller refuses to send', () => {
  withEnv(undefined, () => assert.equal(getMailBaseUrl(), null))
  withEnv('   ', () => assert.equal(getMailBaseUrl(), null))
})
