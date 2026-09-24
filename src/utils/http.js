/**
 * Shared request helpers for Gatsby Functions.
 */

export function parseRequestBody(req) {
  if (req == null || req.body == null || req.body === '') {
    return {}
  }

  if (typeof req.body === 'object') {
    return req.body
  }

  return JSON.parse(req.body)
}

export function jsonBody(data) {
  return typeof data === 'string' ? data : JSON.stringify(data)
}
