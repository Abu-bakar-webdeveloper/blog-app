#!/bin/bash
set -e

cd "$(dirname "$0")"

echo ">>> Pulling latest code..."
git pull origin main

echo ">>> Rebuilding and restarting containers..."
sudo docker-compose -f docker-compose.prod.yml up --build -d

echo ">>> Running migrations..."
sudo docker exec node_app npx prisma migrate deploy

echo ">>> Updating nginx config..."
sudo cp nginx/blog-app.conf /etc/nginx/conf.d/blog-app.conf
sudo nginx -t
sudo systemctl reload nginx

echo ">>> Deploy complete."
sudo docker ps