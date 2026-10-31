# MIDFLOW — production image (front-end + API in one Node process)
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY package.json ./
COPY --from=build /app/dist ./dist
COPY server ./server
COPY src/assets/photos ./src/assets/photos
# events.jsonl and the image cache live here — mount a volume to keep them across deploys
RUN mkdir -p server/data && chown -R node:node server/data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:3000/api/health || exit 1
CMD ["node", "server/server.ts"]
