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
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/knexfile.ts ./knexfile.ts
COPY --from=build /app/src/db ./src/db
EXPOSE 3000
# Apply any pending migrations before booting so prod schema always matches code.
CMD ["sh", "-c", "npm run db:migrate && node dist/server.js"]
