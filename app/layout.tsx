import type { Metadata } from 'next'
import './globals.css'
import { Header, Footer } from '@/components/site-shell'
export const metadata: Metadata = {
  title: { default: '御洛平公益本草文化平台｜本草 · 医典 · 岐黄', template: '%s｜御洛平公益本草文化平台' },
  description: '以公益方式分享中医药文化、本草知识与古籍阅读资料。探索本草堂、医典阁、岐黄论与传统文化故事。本站内容仅供文化学习，不构成医疗建议。',
  applicationName: '御洛平公益本草文化平台',
  openGraph: { title: '御洛平公益本草文化平台', description: '传承本草智慧，分享中医文化。', type: 'website', locale: 'zh_CN' },
  icons: { icon: '/images/yuluoping-logo.webp' },
  robots: { index: true, follow: true }
}
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const schema = { '@context': 'https://schema.org', '@type': 'Organization', name: '御洛平公益本草文化平台', description: '面向公众的中医药文化公益分享平台', url: process.env.NEXT_PUBLIC_SITE_URL || 'https://example.org' }
  return <html lang="zh-CN"><body><a className="sr-only" href="#main">跳至正文</a><Header/><main id="main">{children}</main><Footer/><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}/></body></html>
}
