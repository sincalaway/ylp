import { NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'
import { getBooks } from '@/lib/content'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(_request:Request,{params}:{params:Promise<{slug:string}>}){const {slug}=await params;if(!/^[A-Za-z0-9_\u4e00-\u9fa5-]+$/.test(slug))return new NextResponse('Not found',{status:404});const item=getBooks().find((b)=>b.slug===slug&&b.format==='pdf');if(!item)return new NextResponse('Not found',{status:404});const file=path.join(process.cwd(),'content','books',item.fileName);try{const data=await fs.readFile(file);return new NextResponse(new Uint8Array(data),{headers:{'Content-Type':'application/pdf','Content-Disposition':'inline','Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff'}})}catch{return new NextResponse('Not found',{status:404})}}
