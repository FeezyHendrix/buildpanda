# The marketing site. Mirrors packages/frontend's Dockerfile so the Railway
# services stay consistent, but this one keeps a Node runtime rather than
# serving static files from nginx: the site is a Next.js app with server-
# rendered routes, a sitemap and an OG image route, so there is no static
# bundle to hand to a web server.
FROM node:22-alpine AS base
WORKDIR /app

FROM base AS build
COPY package.json ./
# No workspace dependencies, so the package installs standalone and the image
# does not need the rest of the monorepo.
RUN npm install
COPY . ./
# next/font downloads Google Fonts during the build, so this step needs network.
RUN npm run build

FROM base AS prod
ENV NODE_ENV=production
# Railway injects PORT; the start script binds :: so both stacks reach it.
ENV PORT=8080
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/next.config.mjs ./next.config.mjs
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
EXPOSE 8080
CMD ["npm", "run", "start"]
