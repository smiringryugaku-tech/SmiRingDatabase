# ---------------------------------------
# 1. ビルドステージ
# ---------------------------------------
FROM node:22-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---------------------------------------
# 2. 実行ステージ
# ---------------------------------------
FROM node:22-slim

WORKDIR /app

# 合成そのものを行うffmpeg（ffprobeも同梱）。このイメージで一番重要な依存関係。
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production

# Cloud Run Job として実行される（HTTPサーバーではないのでポートは開かない）。
# ROOM_NAME / RECORDING_ID は実行ごとに backend から上書きで渡される。
CMD ["node", "dist/index.js"]
