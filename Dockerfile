# Image for container hosts (Railway, Render, Fly...)
FROM node:20-bookworm-slim

# Chromium renders the PDFs
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium fonts-liberation fonts-noto-core ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV CHROME_PATH=/usr/bin/chromium \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    DATA_DIR=/data

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY . .
RUN npm run build && mkdir -p /data

EXPOSE 3000
# the PDF renderer opens the app's own pages, so point it at localhost
CMD ["sh", "-c", "INTERNAL_URL=http://127.0.0.1:${PORT:-3000} exec node_modules/.bin/next start -p ${PORT:-3000}"]
