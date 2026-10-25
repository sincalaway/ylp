import { cookies } from 'next/headers'
import type { Metadata } from 'next'
import { ADMIN_COOKIE, verifySession } from '@/lib/auth'
import { AdminPanel } from '@/components/admin-panel'
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: '内容管理后台', robots: { index: false, follow: false } }
export default async function AdminPage(){const jar=await cookies();const loggedIn=verifySession(jar.get(ADMIN_COOKIE)?.value);return <AdminPanel initiallyLoggedIn={loggedIn} vercel={Boolean(process.env.VERCEL)}/>}
