# 御洛平公益本草文化平台

一个面向中医药文化学习与公开阅读的 Next.js 项目。以本草条目、传统医籍、理论文章和文化故事为核心，采用宣纸白、青绿、淡金与朱红的中式视觉体系。内容以 JSON 与 Markdown 文件维护，不需要数据库。

> **内容边界：** 预置药材功效与用法属于传统本草知识示例，古籍选文仅供文化学习，不构成医疗建议、诊断或治疗方案。正式公开运营前，请对照权威版本复核内容、版本信息、来源与授权。

## 技术栈与栏目

- Next.js 16 App Router、React 19、TypeScript、Tailwind CSS
- shadcn/ui 风格基础组件、lucide-react 图标、react-markdown / remark-gfm 阅读器、gray-matter YAML front matter
- 首页、本草堂（分类/搜索/详情）、医典阁（书籍/Markdown 阅读/PDF 预览/本地进度）、岐黄论、文化志、关于我们、站内搜索及密码保护后台
- SEO 元数据、Open Graph 基本信息、JSON-LD、动态 sitemap 与 robots.txt

## 本地运行

需要 Node.js 22.13+、pnpm 11+。

```bash
pnpm install
pnpm dev
```

打开 <http://localhost:3000>。生产构建与启动：

```bash
pnpm build
pnpm start
```

`pnpm start` 会先将 `.next/static` 和 `public/` 复制到 `.next/standalone/` 中对应位置，再启动生产服务。Next.js 的 standalone 产物默认不包含这两类资源，直接运行 `server.js` 而未补齐它们，会导致 CSS、JavaScript 和图片 404，页面显示为无样式状态。此步骤不会覆盖或清理运行目录中的 `content/`。Docker 部署仍由 Dockerfile 复制这些资源。

运行检查：

```bash
pnpm lint
pnpm test:standalone
```

### 配置后台

复制环境变量模板并设置自己的密码和随机密钥：

```bash
cp .env.example .env.local
```

编辑 `.env.local`：`ADMIN_PASSWORD` 至少 12 位，`ADMIN_SESSION_SECRET` 至少 32 个随机字符。切勿将真实 `.env.local` 提交到 Git。可用以下命令生成密钥：

```bash
openssl rand -hex 32
```

后台入口：<http://localhost:3000/admin>。登录后可以上传 Markdown/MDX/PDF、编辑本草/文章/首页 JSON 文件和扫描书籍目录。文件上传上限为单文件 20 MB。

## 内容维护

### 添加一本书

把 `.md` 或 `.mdx` 文件放入 `content/books/`，文件名会自动成为 URL slug。文件顶部可用 YAML front matter 填写元信息：

```md
---
title: 本草拾遗（选读）
author: 陈藏器
dynasty: 唐
category: 本草类
summary: 古籍导读与阅读说明。
coverLabel: 本草拾遗
featured: false
---

> 阅读提示：请注明底本、整理者、版权状态与内容性质。

## 第一章

在此编写正文，可使用常规 Markdown 标题、段落、列表、引用和表格。
```

MDX 文件按 Markdown 渲染，适合常规 Markdown 内容，不执行任意 JSX。`.pdf` 文件会出现在医典阁并提供浏览器内嵌预览；建议同名使用有意义的文件名。书目元数据可在 Markdown front matter 中管理；纯 PDF 暂以文件名生成标题，后续可扩展 sidecar 元数据。

### 添加或修改本草

在 `content/herbs.json` 数组中新增条目，保持字段结构一致：

```json
{
  "slug": "dang-shen",
  "name": "党参",
  "pinyin": "Dǎng Shēn",
  "category": "草部·山草类",
  "nature": "平",
  "flavor": "甘",
  "channels": "脾、肺经",
  "effects": "传统功效介绍",
  "usage": "传统用法介绍",
  "cautions": "注意事项",
  "description": "简要来源与本草简介"
}
```

`slug` 用于详情页地址；`category` 用于分类筛选。请勿把传统功效描述写成针对具体病症的保证性疗效。

### 添加或修改文章、首页推荐

- `content/articles.json`：文章数组。每篇包含 `slug`、`title`、`category`、`date`（YYYY-MM-DD）、`excerpt`、`readTime`、`cover`、`content`；正文支持 Markdown 基础语法。
- `content/home.json`：首页推荐的 slug 清单，分别编辑 `featuredHerbs`、`featuredBooks`、`featuredArticles`。被推荐的 slug 必须对应真实内容。
- 医典分类在各书籍 Markdown 文件的 `category` 字段中管理。

修改 JSON 后请验证逗号、引号与方括号格式。登录后台也可直接编辑这三份 JSON；保存即写回内容目录。

## Docker 一键运行

Docker 与 Docker Compose 环境下：

```bash
cp .env.example .env
# 编辑 .env，设置安全的 ADMIN_PASSWORD 和 ADMIN_SESSION_SECRET
docker compose up --build -d
```

打开 <http://localhost:3000>。`docker-compose.yml` 把 `./content` 挂载到容器，新增书籍及后台 JSON 修改会留在主机文件中。升级后重新构建：

```bash
docker compose down
docker compose up --build -d
```

首次运行前确保 `.env` 已配置；不要将公开可访问的项目使用示例密码部署。

## 云服务器部署（推荐）

项目默认提供 Ubuntu 云服务器 + Docker Compose + Nginx 反向代理方案。请先将域名 A 记录指向服务器公网 IP，并在云平台安全组放行 TCP 80、443；不要将应用的 3000 端口直接暴露到公网，Compose 已将它绑定到本机回环地址。

在 Ubuntu 22.04/24.04 服务器安装 Docker、Compose 插件和 Nginx 后，克隆项目并配置环境变量：

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2 nginx certbot python3-certbot-nginx git
sudo systemctl enable --now docker nginx
git clone <你的代码仓库地址> yuluoping-herbal
cd yuluoping-herbal
cp .env.example .env
nano .env  # 设置 ADMIN_PASSWORD、ADMIN_SESSION_SECRET
docker compose up --build -d
```

复制 `deploy/nginx-yuluoping.conf.example` 到 Nginx sites-available，将 `your-domain.example` 替换为真实域名，启用站点并签发 HTTPS 证书：

```bash
sudo cp deploy/nginx-yuluoping.conf.example /etc/nginx/sites-available/yuluoping
sudo nano /etc/nginx/sites-available/yuluoping  # 填入你的域名
sudo ln -s /etc/nginx/sites-available/yuluoping /etc/nginx/sites-enabled/yuluoping
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d example.com -d www.example.com
```

将 Certbot 命令中的域名替换成自己的域名。日常升级在服务器仓库目录执行 `git pull && docker compose up --build -d`；书籍、JSON 和后台编辑内容存于 `./content/`，随主机目录持久保留。建议定期备份 `content/` 与 `.env`（密钥单独妥善保管）。Nginx 配置样例见 [`deploy/nginx-yuluoping.conf.example`](deploy/nginx-yuluoping.conf.example)。

## Vercel 部署

1. 将项目提交到 GitHub/GitLab 等代码仓库，并在 Vercel 导入仓库。
2. 在 Vercel Project Settings → Environment Variables 添加 `ADMIN_PASSWORD`（至少 12 位）、`ADMIN_SESSION_SECRET`（至少 32 个随机字符）和 `NEXT_PUBLIC_SITE_URL`（正式域名）。
3. 部署即可；默认构建命令 `pnpm build`，安装命令 `pnpm install`。
4. 后续内容更新通过提交 `content/` 文件并重新部署完成。

**Vercel 文件系统限制：** Serverless 部署不提供可靠持久化的本地写入，因此 `/admin` 的文件上传和 JSON 保存会在 Vercel 环境禁用；后台仍可登录查看提示。要在线上传或保存内容，请接入 Vercel Blob、对象存储或数据库，并实现对应存储适配器。不要假设部署实例本地文件写入可跨重启保留。

### 古籍全本（文件夹书籍）

医典阁收录 50 部取自维基文库（PD-old）的中医古籍全本。每部书是 `content/books/<slug>/` 下的一个文件夹：

- `meta.json`：书名、作者、朝代、分类、简介、`featured`，以及 `sources`（维基文库页面 URL 与修订版本号）和 `chapters`（篇目列表、字数、篇内标题）。
- `NN-<篇名拼音>.md`：每卷/篇一个文件，front matter 含 `title`、`source`、`sourceUrl`、`revid`。

书目由 `scripts/wikisource-books.json` 定义，可复现导入：

```bash
pip install pypinyin opencc-python-reimplemented   # 篇目文件名拼音、检索繁简映射（可选）
WS_CACHE=/tmp/wscache python3 scripts/import-wikisource.py              # 全部
WS_CACHE=/tmp/wscache python3 scripts/import-wikisource.py nan-jing     # 指定书籍
```

阅读路由：`/books/<slug>` 为目录页，`/books/<slug>/<篇>` 为分篇阅读页（上一篇/下一篇、阅读进度）。单文件 `.md/.mdx/.pdf` 书籍（导读、后台上传）照常支持。本草条目链接《本草纲目》原文时使用 `lib/content.ts` 的 `getGangmuEntryHref(name)`。

## 目录结构

```text
app/                    页面、SEO 与 API 路由
  api/admin/             登录、上传、内容编辑和索引接口
  api/books/pdf/         PDF 文件预览接口
components/              导航、卡片、阅读器、后台表单
  ui/button.tsx          shadcn/ui 风格通用按钮
content/
  herbs.json             本草条目
  articles.json          岐黄论文章
  home.json              首页精选配置
  books/*.md             导读及上传书籍 Markdown/MDX/PDF
  books/<slug>/          古籍全本：meta.json + 分篇 Markdown
lib/                     内容读取、检索、会话验证
deploy/                  云服务器 Nginx 配置样例
public/images/           SVG 本草主题插画
Dockerfile               多阶段 Docker 镜像构建
docker-compose.yml       云服务器启动与内容持久化
pnpm-workspace.yaml      pnpm 安装脚本授权设置
```

## 内容安全与授权

上传者需自行确认文本来源与版权授权；切勿上传未经授权的现代书籍扫描件。古籍电子文本也应标注使用的版本、整理者和出处。网站示例条目仅为传统文化介绍，实际用药、购药或健康决策需咨询正规医疗机构的专业人员。

## 框架安全基线

项目使用 Next.js 16.4.3（2026-10-25 时已发布的 16.4 补丁版）。版本更新参考 Next.js 官方 2026-10-14 安全公告：[Next.js Security Update for Upstream Vulnerabilities](https://nextjs.org/blog/nextjs-security-update-october-14-2026)。更新依赖时请优先使用仍受支持的稳定补丁版本，并重新运行 `pnpm install && pnpm build && pnpm lint`。

## 图文来源与版权

- 本草插图：清·吴其濬《植物名实图考》（1848）木刻图，取自 [Wikimedia Commons](https://commons.wikimedia.org/)，公有领域。每味药的出处链接记录在 `content/herbs.json` 的 `illustration` 字段，图片存于 `public/images/herbs/`（已转为 webp，国内访问无需外链）。
- 古籍原文：50 部全本取自[维基文库](https://zh.wikisource.org/)（PD-old），位于 `content/books/<slug>/`，`meta.json` 与每篇 front matter 注明来源页面与修订版本。重新导入：`python3 scripts/import-wikisource.py`（书目见 `scripts/wikisource-books.json`）。
