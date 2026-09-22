import { describe, it, expect } from 'vitest'
import { parseRequestBody, jsonBody } from './http'

describe('parseRequestBody', () => {
  it('parses JSON strings', () => {
    expect(parseRequestBody({ body: '{"ok":true}' })).toEqual({ ok: true })
  })

  it('returns objects as-is', () => {
    expect(parseRequestBody({ body: { ok: true } })).toEqual({ ok: true })
  })

  it('returns an empty object for empty bodies', () => {
    expect(parseRequestBody({ body: '' })).toEqual({})
    expect(parseRequestBody({})).toEqual({})
  })
})

describe('jsonBody', () => {
  it('stringifies objects and keeps strings', () => {
    expect(jsonBody({ a: 1 })).toBe('{"a":1}')
    expect(jsonBody('already')).toBe('already')
  })
})
