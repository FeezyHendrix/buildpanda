# Build from the repository root: docker build -f packages/frontend/Dockerfile .
FROM node:22-alpine AS base
WORKDIR /app
COPY tsconfig.shared.json /tsconfig.shared.json

FROM base AS dev
COPY packages/rich-content /rich-content
COPY packages/frontend/package.json ./
# Railway builds each service in isolation. npm 10 can crash while resolving
# `file:` workspace packages there, so install registry dependencies first and
# then place the copied shared source at the package's normal resolution path.
RUN node -e "const fs=require('fs');const p=require('./package.json');delete p.dependencies['@buildpanda/rich-content'];fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\\n')" \
  && npm install \
  && mkdir -p node_modules/@buildpanda \
  && cp -R /rich-content node_modules/@buildpanda/rich-content
COPY packages/frontend ./
EXPOSE 5173
CMD ["npx", "vite", "--host", "0.0.0.0"]

FROM base AS build
# Vite inlines VITE_* at build time, so the value must reach `vite build` (not runtime).
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY packages/rich-content /rich-content
COPY packages/frontend/package.json ./
RUN node -e "const fs=require('fs');const p=require('./package.json');delete p.dependencies['@buildpanda/rich-content'];fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\\n')" \
  && npm install \
  && mkdir -p node_modules/@buildpanda \
  && cp -R /rich-content node_modules/@buildpanda/rich-content
COPY packages/frontend ./
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
COPY packages/frontend/nginx.conf /etc/nginx/templates/default.conf.template
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
