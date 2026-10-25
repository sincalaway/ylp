import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import fs from 'node:fs/promises'
import path from 'node:path'
import { cookies } from 'next/headers'
import matter from 'gray-matter'
import { ADMIN_COOKIE, verifySession } from '@/lib/auth'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 20
export async function POST(request: Request) {
 if (!verifySession((await cookies()).get(ADMIN_COOKIE)?.value)) return NextResponse.json({ error: '请先登录后台。' }, { status: 401 })
 if (process.env.VERCEL) return NextResponse.json({ error: 'Vercel 不支持本地持久化上传，请通过 Git 更新 content/books/ 或接入对象存储。' }, { status: 501 })
 const data = await request.formData(); const files = data.getAll('files').filter((f): f is File => f instanceof File)
 if (!files.length) return NextResponse.json({ error: '请选择至少一个文件。' }, { status: 400 })
 if (files.reduce((sum,file)=>sum+file.size,0)>50*1024*1024) return NextResponse.json({error:'单次上传总大小不能超过 50 MB。'},{status:413})
 const root = path.join(process.cwd(), 'content', 'books'); await fs.mkdir(root, { recursive: true })
 const added: string[] = []
 for (const file of files) {
  const ext = path.extname(file.name).toLowerCase()
  if (!['.md','.mdx','.pdf'].includes(ext)) return NextResponse.json({ error: `不支持的文件类型：${ext || '未知'}` }, { status: 400 })
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: '单个文件不能超过 20 MB。' }, { status: 413 })
  if (file.size === 0) return NextResponse.json({ error: '空文件不能上传。' }, { status: 400 })
  const base = path.basename(file.name, ext).normalize('NFKC').replace(/[^A-Za-z0-9_\u4e00-\u9fa5-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'book'
  let target = `${base}${ext}`; let n = 2
  while (await fs.access(path.join(root, target)).then(()=>true).catch(()=>false)) { target = `${base}-${n++}${ext}` }
  const buffer = Buffer.from(await file.arrayBuffer())
  if (ext === '.pdf' && buffer.subarray(0,5).toString() !== '%PDF-') return NextResponse.json({ error: `${file.name} 不是有效的 PDF 文件。` }, { status: 400 })
  if (ext !== '.pdf') { try { matter(buffer.toString('utf8')) } catch { return NextResponse.json({ error: `${file.name} 的 Markdown/YAML 头部格式有误。` }, { status: 400 }) } }
  await fs.writeFile(path.join(root, target), buffer, { flag: 'wx' }); added.push(target)
 }
 revalidatePath('/books');revalidatePath('/sitemap.xml')
 for(const file of added){const slug=file.replace(/\.(md|mdx|pdf)$/i,'');revalidatePath(`/books/${slug}`)}
 return NextResponse.json({ ok: true, title: added.join('、'), files: added })
}
