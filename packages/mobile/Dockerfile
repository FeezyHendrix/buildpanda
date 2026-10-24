# Web build of the field app. Build from the repository root:
#   docker build -f packages/mobile/Dockerfile --build-arg EXPO_PUBLIC_API_URL=https://api.buildpanda.io .
FROM node:22-alpine AS build
RUN npm install -g npm@11.19.0
# Metro only resolves files under the workspace it detects, and voice-actions
# imports rich-content, so the image keeps the repository layout the CI
# workflows build from rather than flattening the shared packages.
WORKDIR /app
COPY package.json pnpm-workspace.yaml tsconfig.shared.json ./
COPY packages/rich-content packages/rich-content
COPY packages/voice-actions packages/voice-actions
COPY packages/mobile packages/mobile
WORKDIR /app/packages/mobile
# The lock was generated with legacy peer deps, as ota-update.yml and release-apk.yml install it.
ENV NPM_CONFIG_LEGACY_PEER_DEPS=true
RUN npm ci
# Inlined into the bundle like the APK and OTA workflows do; a build with no
# backend would ship a site that reaches nothing.
ARG EXPO_PUBLIC_API_URL
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL
ARG EXPO_PUBLIC_SENTRY_DSN
ENV EXPO_PUBLIC_SENTRY_DSN=$EXPO_PUBLIC_SENTRY_DSN
ENV EXPO_NO_TELEMETRY=1
RUN test -n "$EXPO_PUBLIC_API_URL" || { echo "EXPO_PUBLIC_API_URL is empty" >&2; exit 1; }
RUN npx expo export --platform web

FROM nginx:stable-alpine AS prod
COPY --from=build /app/packages/mobile/dist /usr/share/nginx/html
# Same template/envsubst arrangement as packages/frontend/Dockerfile.
ENV PORT=8080
ENV NGINX_ENVSUBST_FILTER=PORT
COPY packages/mobile/nginx.conf /etc/nginx/templates/default.conf.template
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
