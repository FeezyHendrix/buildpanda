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

# Shipped as a TEMPLATE, not as conf.d/default.conf: the platform picks the port
# at runtime via $PORT and nginx cannot read env vars from its config. The image
# entrypoint renders /etc/nginx/templates/*.template into /etc/nginx/conf.d/,
# which also overwrites the stock default.conf.
#
# NGINX_ENVSUBST_FILTER is not optional — without it envsubst would also expand
# $uri, $host, $remote_addr and every other nginx runtime variable in the config
# into empty strings.
ENV PORT=8080
ENV NGINX_ENVSUBST_FILTER=PORT
COPY nginx.conf /etc/nginx/templates/default.conf.template
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
