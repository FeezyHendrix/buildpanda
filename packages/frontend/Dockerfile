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
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
