# 🚀 Hướng dẫn Deploy

## Môi trường

| | Production | Staging |
|---|---|---|
| **Nhánh Git** | `main` | `staging` |
| **PM2 process** | `shopee-bot` | `shopee-staging` |
| **Port** | `3456` | `3456` |
| **Database** | Aiven Production | Aiven Staging |
| **VPS** | VPS riêng | VPS riêng |

---

## 🖥️ Setup lần đầu trên VPS (Windows)

### 1. Cài đặt môi trường
```cmd
# Cài Node.js: https://nodejs.org (chọn LTS)
npm install -g pm2
npm install -g pm2-windows-startup
pm2-startup install
```

### 2. Clone code

**Production VPS:**
```cmd
git clone -b main https://github.com/lamkhoi-dev/sp_extension.git C:\var\www\shopee-bot
cd C:\var\www\shopee-bot
npm install
```

**Staging VPS:**
```cmd
git clone -b staging https://github.com/lamkhoi-dev/sp_extension.git C:\shopee-staging
cd C:\shopee-staging
npm install
```

### 3. Tạo file .env

Tạo file `.env` trong thư mục project (dùng Notepad, lưu đúng tên `.env` không phải `.env.txt`).

**Production `.env`:**
```env
DATABASE_URL="postgres://avnadmin:<PASSWORD>@<HOST_PRODUCTION>/defaultdb?sslmode=require"
JWT_SECRET=your-secret-key-here
SERVER_URL=http://localhost:3456
NODE_ENV=production
GMAIL_USER=lamkhoi.dev@gmail.com
GMAIL_APP_PASSWORD=<APP_PASSWORD>
NOTIFY_EMAILS=nguyenthaian210506@gmail.com,khoilam.dev@gmail.com
LINK_MODE=direct
SHOPEE_AFFILIATE_ID=17340250483
```

**Staging `.env`:**
```env
DATABASE_URL="postgres://avnadmin:<PASSWORD>@<HOST_STAGING>/defaultdb?sslmode=require"
JWT_SECRET=your-secret-key-here
SERVER_URL=http://localhost:3456
NODE_ENV=staging
GMAIL_USER=lamkhoi.dev@gmail.com
GMAIL_APP_PASSWORD=<APP_PASSWORD>
NOTIFY_EMAILS=nguyenthaian210506@gmail.com,khoilam.dev@gmail.com
LINK_MODE=direct
SHOPEE_AFFILIATE_ID=17340250483
```

> ⚠️ File `.env` **không được commit lên Git** (đã có trong `.gitignore`)

### 4. Start server

**Production:**
```cmd
cd C:\var\www\shopee-bot
pm2 start ecosystem.config.js --env production
pm2 save
```

**Staging:**
```cmd
cd C:\shopee-staging
pm2 start ecosystem.config.js --env staging
pm2 save
```

### 5. Kiểm tra
```cmd
pm2 status
pm2 logs shopee-staging --lines 30
```

---

## 🔄 Workflow deploy hàng ngày

### Sửa code local → đẩy lên Staging trước

```bash
# Local
git add .
git commit -m "mô tả thay đổi"
git push origin staging
```

```cmd
# VPS Staging
cd C:\shopee-staging
git pull origin staging
pm2 restart shopee-staging
```

### Test OK → đẩy lên Production

```bash
# Local: merge staging vào main
git checkout main
git merge staging
git push origin main
```

```cmd
# VPS Production
cd C:\var\www\shopee-bot
git pull origin main
pm2 restart shopee-bot
```

### Tóm tắt flow

```
Sửa code local
      ↓
git push origin staging
      ↓
VPS Staging: git pull + pm2 restart shopee-staging
      ↓ test OK
git push origin main
      ↓
VPS Production: git pull + pm2 restart shopee-bot
```

---

## 🛠️ Lệnh PM2 thường dùng

```cmd
pm2 status                        # Xem danh sách process
pm2 logs shopee-staging           # Xem log realtime
pm2 logs shopee-bot --lines 50    # Xem 50 dòng log gần nhất
pm2 restart shopee-staging        # Restart
pm2 stop shopee-staging           # Dừng
pm2 delete shopee-staging         # Xóa khỏi danh sách
pm2 save                          # Lưu để tự start khi reboot VPS
```

---

## 🗄️ Database

| | Host | Port | DB |
|---|---|---|---|
| **Production** | `pg-30a41d40-nguyenthaian210506clone-e3a2.e.aivencloud.com` | `22900` | `defaultdb` |
| **Staging** | `pg-3a6998bf-lamkhoi-7dc0.l.aivencloud.com` | `18196` | `defaultdb` |

Quản lý DB tại: [Aiven Console](https://console.aiven.io)
