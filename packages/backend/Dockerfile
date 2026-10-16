# Build from the repository root: docker build -f packages/backend/Dockerfile .
FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates libstdc++6 zlib1g \
      libfreetype6 fontconfig libfontconfig1 \
    && rm -rf /var/lib/apt/lists/*
# npm 10's Arborist can crash with `edgesOut` while resolving this dependency
# graph on Railway's isolated builders. npm 11 supports Node 22 and fixes it.
RUN npm install -g npm@11.19.0
ENV _JAVA_OPTIONS="-Djava.awt.headless=true"
COPY tsconfig.shared.json /tsconfig.shared.json

FROM base AS dev
COPY packages/rich-content /rich-content
COPY packages/voice-actions /voice-actions
COPY packages/backend/package.json ./
# Railway builds each service in isolation. npm 10 can crash while resolving
# `file:` workspace packages there, so install registry dependencies first and
# then place the copied shared source at the package's normal resolution path.
RUN node -e "const fs=require('fs');const p=require('./package.json');delete p.dependencies['@buildpanda/rich-content'];delete p.dependencies['@buildpanda/voice-actions'];fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\\n')" \
  && npm install --include=optional --os=linux --cpu=x64 --libc=glibc --legacy-peer-deps \
  && mkdir -p node_modules/@buildpanda \
  && cp -R /rich-content node_modules/@buildpanda/rich-content \
  && cp -R /voice-actions node_modules/@buildpanda/voice-actions
COPY packages/backend ./
EXPOSE 3000
CMD ["npx", "tsx", "watch", "src/server.ts"]

FROM base AS build
COPY packages/rich-content /rich-content
COPY packages/voice-actions /voice-actions
COPY packages/backend/package.json ./
RUN node -e "const fs=require('fs');const p=require('./package.json');delete p.dependencies['@buildpanda/rich-content'];delete p.dependencies['@buildpanda/voice-actions'];fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\\n')" \
  && npm install --include=optional --os=linux --cpu=x64 --libc=glibc --legacy-peer-deps \
  && mkdir -p node_modules/@buildpanda \
  && cp -R /rich-content node_modules/@buildpanda/rich-content \
  && cp -R /voice-actions node_modules/@buildpanda/voice-actions
COPY packages/backend ./
# No entry list here: a positional argument replaces the `entry` map in
# tsup.config.ts, which is what silently dropped the calculation worker from a
# deployed image. `--no-dts` only skips declarations nothing in the image reads.
RUN npx tsup --no-dts
RUN node -e "const f=require('fs');const missing=['cluster.js','server.js','worker-entry.js','workbook-engine.js'].filter(n=>!f.existsSync('dist/'+n));if(missing.length){console.error('build is missing dist entries:',missing.join(', '));process.exit(1)}console.log('build entries ok')"
RUN node -e "const p=require('path'),f=require('fs');const pkg=require.resolve('@byteink/mppjs-linux-x64/package.json');const bin=p.join(p.dirname(pkg),'bin','mpxj-convert');if(!f.existsSync(bin)){console.error('missing native binary',bin);process.exit(1)}f.accessSync(bin,f.constants.X_OK);console.log('mppjs native binary ok',bin)"

FROM base AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /rich-content /rich-content
COPY --from=build /voice-actions /voice-actions
RUN npm install --omit=dev --include=optional --os=linux --cpu=x64 --libc=glibc \
  && rm -rf node_modules/@buildpanda \
  && mkdir -p node_modules/@buildpanda
COPY --from=build /app/node_modules/@buildpanda/rich-content ./node_modules/@buildpanda/rich-content
COPY --from=build /app/node_modules/@buildpanda/voice-actions ./node_modules/@buildpanda/voice-actions
COPY --from=build /app/dist ./dist
COPY --from=build /app/knexfile.ts ./knexfile.ts
COPY --from=build /app/src ./src
EXPOSE 3000
CMD ["sh", "-c", "npm run db:migrate && node dist/cluster.js"]
