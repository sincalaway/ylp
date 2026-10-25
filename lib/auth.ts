import { createHmac, timingSafeEqual } from 'node:crypto'
export const ADMIN_COOKIE = 'yuluoping_admin'
const secret = () => process.env.ADMIN_SESSION_SECRET || 'development-only-change-me-before-deploy'
export function createSession() {
  const expires = Date.now() + 1000 * 60 * 60 * 24 * 5
  const body = String(expires)
  const signature = createHmac('sha256', secret()).update(body).digest('hex')
  return `${body}.${signature}`
}
export function verifySession(value?: string) {
  if (!value) return false
  const [body, signature] = value.split('.')
  if (!body || !signature || Number(body) < Date.now()) return false
  const expected = createHmac('sha256', secret()).update(body).digest('hex')
  const a = Buffer.from(signature); const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
