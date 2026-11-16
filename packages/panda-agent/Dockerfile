# Build from the repository root; the app imports existing frontend atoms/styles.
FROM node:22-alpine AS build
WORKDIR /app
RUN npm install -g npm@11.19.0

ARG VITE_API_BASE_URL
ARG VITE_BUILDPANDA_APP_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_BUILDPANDA_APP_URL=$VITE_BUILDPANDA_APP_URL

COPY packages/rich-content/package.json /rich-content/package.json
COPY packages/rich-content/src /rich-content/src
COPY packages/rich-text-editor/package.json /rich-text-editor/package.json
COPY packages/rich-text-editor/src /rich-text-editor/src
COPY packages/panda-agent/package.json ./package.json
# Keep registry installation consistent with the existing frontend image.
RUN node -e "const fs=require('fs');const p=require('./package.json');const editor=require('/rich-text-editor/package.json');Object.assign(p.dependencies,editor.dependencies);delete p.dependencies['@buildpanda/rich-content'];delete p.dependencies['@buildpanda/rich-text-editor'];fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\\n')" \
  && npm install \
  && mkdir -p node_modules/@buildpanda \
  && cp -R /rich-content node_modules/@buildpanda/rich-content \
  && cp -R /rich-text-editor node_modules/@buildpanda/rich-text-editor

COPY tsconfig.shared.json ./tsconfig.shared.json
COPY packages/frontend/src ./packages/frontend/src
COPY packages/panda-agent/package.json packages/panda-agent/index.html packages/panda-agent/tsconfig.json packages/panda-agent/vite.config.ts ./packages/panda-agent/
COPY packages/panda-agent/src ./packages/panda-agent/src
WORKDIR /app/packages/panda-agent
RUN test -n "$VITE_API_BASE_URL" && test -n "$VITE_BUILDPANDA_APP_URL" && npm run build

FROM nginx:stable-alpine AS prod
COPY --from=build /app/packages/panda-agent/dist /usr/share/nginx/html
ENV PORT=8080
# Limit substitution so nginx keeps its own $uri variable.
ENV NGINX_ENVSUBST_FILTER=PORT
COPY packages/panda-agent/nginx.conf /etc/nginx/templates/default.conf.template
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
