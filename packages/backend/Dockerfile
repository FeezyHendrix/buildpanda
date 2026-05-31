FROM node:22-alpine AS base
WORKDIR /app

FROM base AS dev
COPY package.json ./
RUN npm install
COPY . ./
EXPOSE 3000
CMD ["npx", "tsx", "watch", "src/server.ts"]

FROM base AS build
COPY package.json ./
RUN npm install
COPY . ./
RUN npx tsup src/server.ts --format esm

FROM node:22-alpine AS prod
WORKDIR /app
COPY --from=build /app/package.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/server.js"]
