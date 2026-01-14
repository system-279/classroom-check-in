FROM node:24-slim AS builder

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

# Build-time env vars for Next.js
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_AUTH_MODE=dev
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_AUTH_MODE=$NEXT_PUBLIC_AUTH_MODE

RUN npm run build

FROM node:24-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy standalone output - handle different possible structures
COPY --from=builder /app/.next/standalone ./standalone-temp

# Move files to correct location (including hidden dirs like .next)
RUN if [ -d "standalone-temp/web" ]; then \
      mv standalone-temp/node_modules ./node_modules && \
      cp -r standalone-temp/web/. ./ && \
      rm -rf standalone-temp; \
    else \
      cp -r standalone-temp/. ./ && \
      rm -rf standalone-temp; \
    fi

# Copy static files to .next/static (required for standalone)
COPY --from=builder /app/.next/static ./.next/static

# Copy public directory if it exists (optional)
RUN mkdir -p ./public

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
