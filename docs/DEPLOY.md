# 御洛平部署到自有云服务器

本指南使用仓库自带的 `Dockerfile`、`docker-compose.yml` 与 `deploy/nginx-yuluoping.conf.example`，在自己的云服务器上以 Docker Compose + Nginx + HTTPS 方式运行站点。

## 1. 准备服务器

- 系统：Ubuntu 22.04/24.04 或 Debian 12
- 配置：**2 核 2GB 起**（构建全文索引峰值约 1GB 内存，内存不足请加 swap）
- 硬盘：预留 5GB 以上
- 安全组放行 TCP 22、80、443

```bash
# 没有 swap 时先加一个
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
```

## 2. 安装 Docker 和 Nginx

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2 nginx git
```

国内服务器拉取镜像较慢时，先给 Docker 配置镜像加速源（云厂商控制台一般提供）。

## 3. 拉取代码、配置环境变量

```bash
git clone https://github.com/sincalaway/ylp.git
cd ylp
cp .env.example .env
nano .env
```

`.env` 中需要填写：

- `ADMIN_PASSWORD`：后台密码，至少 12 位
- `ADMIN_SESSION_SECRET`：至少 32 位随机字符串，可用 `openssl rand -hex 32` 生成
- `NEXT_PUBLIC_SITE_URL`：站点地址，例如 `https://your-domain.example`

## 4. 构建并启动

```bash
sudo docker compose up -d --build
```

首次构建约 5–10 分钟（含医典阁全文索引）。服务只监听本机 `127.0.0.1:3000`，不直接对外暴露。

```bash
curl -I http://127.0.0.1:3000   # 返回 200 即成功
```

## 5. 配置 Nginx 反向代理

```bash
sudo cp deploy/nginx-yuluoping.conf.example /etc/nginx/sites-available/yuluoping
sudo nano /etc/nginx/sites-available/yuluoping   # 把 your-domain.example 替换成真实域名
sudo ln -s /etc/nginx/sites-available/yuluoping /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 6. 启用 HTTPS

域名 A 记录解析到服务器公网 IP 后：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.example
```

## 7. 日常更新

```bash
cd ylp && git pull && sudo docker compose up -d --build
```

## 注意事项

- **备案**：中国大陆服务器使用域名访问前必须完成 ICP 备案，否则会被拦截；香港或海外服务器无需备案。
- **内容持久化**：`content/` 挂载在宿主机目录，后台修改的本草数据与上传的书籍会保留。建议定期备份 `content/` 与 `.env`。
- **全文搜索**：后台新上传的书需要重新构建一次（第 7 步）才会进入典籍正文搜索。
- **暂无域名**：可把 `docker-compose.yml` 中的端口改为 `"3000:3000"`，在安全组放行 3000，用 `服务器IP:3000` 临时访问。
