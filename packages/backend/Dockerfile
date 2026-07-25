FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates libstdc++6 zlib1g \
      libfreetype6 fontconfig libfontconfig1 \
    && rm -rf /var/lib/apt/lists/*
ENV _JAVA_OPTIONS="-Djava.awt.headless=true"

FROM base AS dev
COPY package.json ./
# RUN npm install --include=optional --os=linux --cpu=x64 --libc=glibc
RUN npm install --include=optional --os=linux --cpu=x64 --libc=glibc --legacy-peer-deps
COPY . ./
EXPOSE 3000
CMD ["npx", "tsx", "watch", "src/server.ts"]

FROM base AS build
COPY package.json ./
# RUN npm install --include=optional --os=linux --cpu=x64 --libc=glibc
RUN npm install --include=optional --os=linux --cpu=x64 --libc=glibc --legacy-peer-deps
COPY . ./
RUN npx tsup src/cluster.ts src/server.ts --format esm
RUN node -e "const p=require('path'),f=require('fs');const pkg=require.resolve('@byteink/mppjs-linux-x64/package.json');const bin=p.join(p.dirname(pkg),'bin','mpxj-convert');if(!f.existsSync(bin)){console.error('missing native binary',bin);process.exit(1)}f.accessSync(bin,f.constants.X_OK);console.log('mppjs native binary ok',bin)"

FROM base AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
RUN npm install --omit=dev --include=optional --os=linux --cpu=x64 --libc=glibc
COPY --from=build /app/dist ./dist
COPY --from=build /app/knexfile.ts ./knexfile.ts
COPY --from=build /app/src ./src
EXPOSE 3000
CMD ["sh", "-c", "npm run db:migrate && node dist/cluster.js"]
