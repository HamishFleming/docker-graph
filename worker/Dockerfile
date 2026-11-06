FROM node:22-bookworm AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
FROM node:22-bookworm
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npx playwright install --with-deps chromium
COPY --from=build /app/dist ./dist
COPY worker/*.mjs ./worker/
ENV PORT=3000 CHROMIUM_NO_SANDBOX=1
EXPOSE 3000
CMD ["node", "worker/server.mjs"]
