# syntax=docker/dockerfile:1

# Build step
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package.json package-lock.json* yarn.lock* ./

# Install dependencies (faster with cache)
RUN npm install

# Copy rest of app
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# --- Final step for runtime ---
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

# Install only prod dependencies
COPY package.json package-lock.json* yarn.lock* ./
RUN npm install --omit=dev

# Copy built app & generated Prisma client
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/data.db ./data.db
COPY --from=builder /app/.env ./

# Expose port
EXPOSE 8080

CMD ["node", "dist/app.js"]
