#!/bin/bash
set -e

SERVER="root@5.78.77.83"
REMOTE_DIR="/var/www/plclerk"

echo "==> Building..."
NEXT_PUBLIC_APP_URL=https://app.plclerk.net npm run build

echo "==> Syncing to server..."
rsync -avz --delete \
  --exclude='.env' \
  --exclude='uploads' \
  --exclude='node_modules' \
  --exclude='drizzle' \
  .next/standalone/ "$SERVER:$REMOTE_DIR/"
rsync -avz .next/static/ "$SERVER:$REMOTE_DIR/.next/static/"
rsync -avz public/ "$SERVER:$REMOTE_DIR/public/" 2>/dev/null || true
rsync -avz drizzle/ "$SERVER:$REMOTE_DIR/drizzle/"
rsync -avz package.json "$SERVER:$REMOTE_DIR/"
rsync -avz drizzle.config.ts "$SERVER:$REMOTE_DIR/"

echo "==> Installing production deps + running migrations..."
ssh "$SERVER" "cd $REMOTE_DIR && npm install --omit=dev && npx drizzle-kit migrate"

echo "==> Setting ownership..."
ssh "$SERVER" "chown -R plclerk:plclerk $REMOTE_DIR"

echo "==> Restarting app..."
ssh "$SERVER" "systemctl restart plclerk"

echo "==> Done! https://app.plclerk.net"
