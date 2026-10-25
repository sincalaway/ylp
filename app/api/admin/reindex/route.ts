import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE, verifySession } from '@/lib/auth'
import { getArticles, getBooks, getHerbs } from '@/lib/content'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function POST(){if(!verifySession((await cookies()).get(ADMIN_COOKIE)?.value))return NextResponse.json({error:'请先登录后台。'},{status:401});return NextResponse.json({ok:true,books:getBooks().length,herbs:getHerbs().length,articles:getArticles().length})}
