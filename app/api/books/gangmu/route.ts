import { NextResponse } from 'next/server'
import { getGangmuEntryHref } from '@/lib/content'
export const runtime='nodejs'
export const dynamic='force-dynamic'
/** GET /api/books/gangmu?name=人參 → { href: "/books/ben-cao-gang-mu-yuanwen/15-cao-zhi-yi#人參" } */
export async function GET(request:Request){const name=new URL(request.url).searchParams.get('name')?.slice(0,40)||'';const href=getGangmuEntryHref(name);return href?NextResponse.json({href},{headers:{'Cache-Control':'public, max-age=3600'}}):NextResponse.json({error:'not found'},{status:404})}
