FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
# pasta das fotos (D29); o volume "fotos" do compose herda este dono na primeira montagem
RUN mkdir -p /data/fotos && chown -R node:node /data
ENV PHOTOS_DIR=/data
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
