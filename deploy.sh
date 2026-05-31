#!/bin/bash
# deploy.sh — chạy trên VPS (staging hoặc production)
# Usage: ./deploy.sh [staging|production]
#
# Yêu cầu: git, node, npm, pm2 đã cài sẵn

set -e  # dừng nếu có lỗi

ENV=${1:-production}
APP_DIR=$(pwd)
BRANCH="main"

if [ "$ENV" = "staging" ]; then
  BRANCH="staging"
  PM2_NAME="shopee-staging"
else
  PM2_NAME="shopee-bot"
fi

echo "🚀 Deploying [$ENV] from branch [$BRANCH]..."

# 1. Pull code
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

# 2. Backend deps
echo "📦 Installing backend dependencies..."
npm install --omit=dev

# 3. Build frontend
echo "🎨 Building frontend..."
cd Affiliate-AI/client
npm install --omit=dev
npm run build
cd "$APP_DIR"

# 4. Restart app via PM2
echo "♻️  Restarting PM2 process [$PM2_NAME]..."
if pm2 list | grep -q "$PM2_NAME"; then
  pm2 restart "$PM2_NAME"
else
  pm2 start server.js --name "$PM2_NAME" --update-env
fi

pm2 save

echo "✅ Deploy [$ENV] thành công!"
echo "📊 PM2 status:"
pm2 status "$PM2_NAME"
