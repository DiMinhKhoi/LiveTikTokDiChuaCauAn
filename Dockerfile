FROM node:22-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir gTTS==2.5.4

ENV PATH="/opt/venv/bin:${PATH}" \
    NODE_ENV=production \
    PORT=3000

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server.js tts_service.py fortunes.json ./
COPY public ./public

RUN mkdir -p /app/public/audio_cache \
    && chown node:node /app/public/audio_cache

USER node
EXPOSE 3000

CMD ["node", "server.js"]
