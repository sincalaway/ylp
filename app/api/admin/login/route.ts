import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { ADMIN_COOKIE, createSession } from '@/lib/auth'
export const runtime = 'nodejs'
export async function POST(request: Request) {
 const configured = process.env.ADMIN_PASSWORD
 if (!configured || configured.length < 12) return NextResponse.json({ error: '后台尚未安全配置：请设置至少 12 位 ADMIN_PASSWORD。' }, { status: 503 })
 if (!process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET.length < 32) return NextResponse.json({ error: '后台尚未安全配置：请设置至少 32 位随机 ADMIN_SESSION_SECRET。' }, { status: 503 })
 let input = ''
 try { input = String((await request.json()).password || '') } catch { return NextResponse.json({ error: '请求格式无效。' }, { status: 400 }) }
 const a = Buffer.from(input); const b = Buffer.from(configured)
 if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: '密码不正确。' }, { status: 401 })
 const response = NextResponse.json({ ok: true })
 response.cookies.set(ADMIN_COOKIE, createSession(), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 5 })
 return response
}
