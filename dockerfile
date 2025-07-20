# syntax=docker/dockerfile:1

FROM node:22-bookworm

WORKDIR /app

RUN echo "deb https://ftp.debian.org/debian/ bookworm contrib main non-free non-free-firmware" > /etc/apt/sources.list

RUN cat /etc/apt/sources.list

# Install chromium (for puppeteer/whatsapp-web.js)
RUN apt-get update && \
    apt-get install --allow-unauthenticated -y \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends

RUN ln -sf /usr/bin/chromium /usr/bin/google-chrome


ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV CHROME_BIN=/usr/bin/chromium

# Install dependencies
COPY package.json package-lock.json* yarn.lock* ./
RUN npm install

# Copy source code
COPY . .

EXPOSE 8080

# Default command: auto-generate prisma client, then run dev mode
CMD npx prisma generate && npm run dev
