FROM node:22-alpine AS base
WORKDIR /app

FROM base AS dev
COPY package.json ./
RUN npm install
COPY . ./
EXPOSE 5173
CMD ["npx", "vite", "--host", "0.0.0.0"]

FROM base AS build
# Vite inlines VITE_* at build time, so the value must reach `vite build` (not runtime).
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY package.json ./
RUN npm install
COPY . ./
RUN npm run build

FROM nginx:stable-alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html

# Shipped as a template so the entrypoint can substitute ${PORT} and
# ${NGINX_LOCAL_RESOLVERS}, which nginx cannot read from the environment itself.
# LOCAL_RESOLVERS=1 is required or 15-local-resolvers.envsh never populates it.
#
# The filter is an awk regex over env var NAMES and must match BOTH: the narrower
# `PORT` leaves ${NGINX_LOCAL_RESOLVERS} literal and nginx refuses to start, while
# dropping it blanks out $uri, $host and every other nginx runtime variable.
ENV NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1
ENV PORT=8080
ENV NGINX_ENVSUBST_FILTER="^(PORT|NGINX_LOCAL_RESOLVERS)$"
COPY nginx.conf /etc/nginx/templates/default.conf.template
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
