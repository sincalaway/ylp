import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import fs from 'node:fs/promises'
import path from 'node:path'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE, verifySession } from '@/lib/auth'
export const runtime='nodejs'
export const dynamic='force-dynamic'
const allowed=['herbs','articles','home'] as const
type Key=typeof allowed[number]
const filePath=(key:Key)=>path.join(process.cwd(),'content',`${key}.json`)
export async function GET(){if(!verifySession((await cookies()).get(ADMIN_COOKIE)?.value))return NextResponse.json({error:'请先登录后台。'},{status:401});try{const pairs=await Promise.all(allowed.map(async key=>[key,JSON.parse(await fs.readFile(filePath(key),'utf8'))] as const));return NextResponse.json(Object.fromEntries(pairs))}catch{return NextResponse.json({error:'读取内容文件失败。'},{status:500})}}
export async function POST(request:Request){if(!verifySession((await cookies()).get(ADMIN_COOKIE)?.value))return NextResponse.json({error:'请先登录后台。'},{status:401});if(process.env.VERCEL)return NextResponse.json({error:'Vercel 文件系统为只读部署内容；请通过 Git 更新内容，或接入数据库/对象存储。'},{status:501});try{const body=await request.json();const key=body.file as Key;if(!allowed.includes(key))return NextResponse.json({error:'不允许编辑该文件。'},{status:400});const text=String(body.content||'');if(text.length>500_000)return NextResponse.json({error:'内容文件不能超过 500 KB。'},{status:413});const parsed=JSON.parse(text);if(key==='herbs'&&!Array.isArray(parsed))return NextResponse.json({error:'本草文件必须是 JSON 数组。'},{status:400});if(key==='articles'&&!Array.isArray(parsed))return NextResponse.json({error:'文章文件必须是 JSON 数组。'},{status:400});if(key==='home'&&(Array.isArray(parsed)||parsed===null||typeof parsed!=='object'))return NextResponse.json({error:'首页推荐文件必须是 JSON 对象。'},{status:400});const target=filePath(key);const temp=`${target}.${Date.now()}.tmp`;await fs.writeFile(temp,JSON.stringify(parsed,null,2)+'\n',{encoding:'utf8',flag:'wx'});await fs.rename(temp,target);for(const route of ['/','/herbs','/herbs/[slug]','/articles','/articles/[slug]','/search','/sitemap.xml'])revalidatePath(route,route.includes('[')?'page':undefined);return NextResponse.json({ok:true,file:`${key}.json`})}catch{return NextResponse.json({error:'JSON 格式无效或文件保存失败，请检查语法后重试。'},{status:400})}}
