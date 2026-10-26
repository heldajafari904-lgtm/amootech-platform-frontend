FROM node:22-alpine AS dependencies
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ARG NPM_CONFIG_REGISTRY=https://registry.npmjs.org
ENV NPM_CONFIG_REGISTRY=${NPM_CONFIG_REGISTRY}
RUN chown node:node /app
COPY --chown=node:node package.json package-lock.json ./
USER node
RUN npm ci --no-audit --no-fund \
    && sha256sum package.json package-lock.json | sha256sum | cut -d ' ' -f 1 > node_modules/.amootech-dependencies

FROM dependencies AS development
ENV NODE_ENV=development
COPY --chown=node:node . .
RUN mkdir -p .next && chown node:node .next
COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/amootech-frontend-entrypoint
USER node
EXPOSE 3000
ENTRYPOINT ["amootech-frontend-entrypoint"]
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]
