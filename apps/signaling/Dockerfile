FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/signaling/package.json ./apps/signaling/

# Install dependencies
RUN npm ci

# Copy source
COPY packages/shared ./packages/shared
COPY apps/signaling ./apps/signaling
COPY tsconfig.json ./

# Build
RUN npm run build:shared
RUN npm run build:signaling

# Production image
FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/apps/signaling/dist ./apps/signaling/dist
COPY --from=builder /app/apps/signaling/package.json ./apps/signaling/

ENV NODE_ENV=production
ENV PORT=8080

CMD ["node", "apps/signaling/dist/server.js"]
