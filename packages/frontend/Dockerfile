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
# Ship the config as a TEMPLATE so the entrypoint expands ${NGINX_LOCAL_RESOLVERS}
# into it (20-envsubst-on-templates.sh writes /etc/nginx/templates/*.template ->
# /etc/nginx/conf.d/). NGINX_ENTRYPOINT_LOCAL_RESOLVERS must be set or
# 15-local-resolvers.envsh early-returns and the variable is never populated.
ENV NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1
COPY nginx.conf /etc/nginx/templates/default.conf.template
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
