# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Hexamap — image applicative unique (API Elysia + SPA React compilée).
#
# `deps`   : installation des dépendances (cache Docker partagé par tous les stades).
# `dev`    : cible utilisée par `compose.yml` pour `api` ET `web` (code monté en
#            volume, rechargement Bun / Vite ; `web` surcharge la commande).
# `build`  : compilation de l'API, de la SPA et du script de migration.
# `prod`   : image finale, minimale, sans code source ni outillage de build.
#            Un seul conteneur sert l'API et les fichiers statiques du web.
# ---------------------------------------------------------------------------

FROM oven/bun:1 AS deps
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/spec/package.json packages/spec/package.json
COPY packages/e2e/package.json packages/e2e/package.json
COPY scripts/import/package.json scripts/import/package.json
RUN bun install --frozen-lockfile

COPY . .

# --------------------------------------------------------------------------
# Développement local (compose.yml) : code monté en volume.
# Ce stade sert les deux services : `api` garde la CMD par défaut, `web`
# remplace la commande par le serveur Vite (`--host 0.0.0.0`).
# --------------------------------------------------------------------------
FROM deps AS dev
RUN chmod +x scripts/docker-entrypoint.sh
# Points de montage des volumes `blasons` et `importstatus` : créés au build avec
# les droits du runtime (UID/GID 1000, cf. compose) pour que les volumes soient
# inscriptibles dès leur première initialisation (copy-up Docker).
RUN mkdir -p /data/blasons /data/import-status && chown 1000:1000 /data/blasons /data/import-status
ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
CMD ["bun", "run", "--cwd", "apps/api", "dev"]

# --------------------------------------------------------------------------
# Compilation : bundle autonome et SPA statique (aucune dépendance à installer
# au runtime).
# --------------------------------------------------------------------------
FROM deps AS build
RUN bun run --cwd apps/api build
# La SPA est compilée dans `apps/web/dist`, copiée en `./public` dans l'image prod.
RUN bun run --cwd apps/web build
# Script de migration embarqué : même bundle, pas besoin des sources TS en prod.
RUN bun build packages/db/src/migrate.ts --outdir apps/api/dist-db --target bun

# --------------------------------------------------------------------------
# Production : un seul conteneur, à la fois API et serveur de la SPA.
# --------------------------------------------------------------------------
FROM oven/bun:alpine AS prod
WORKDIR /app

# `SERVE_WEB` active le service des fichiers statiques ; `WEB_DIST_DIR` pointe
# vers la SPA copiée ci-dessous.
ENV NODE_ENV=production \
    PORT=3000 \
    WEB_DIST_DIR=/app/public \
    SERVE_WEB=true

# L'application est bundlée : ni node_modules ni sources ne sont nécessaires.
COPY --from=build --chown=bun:bun /app/apps/api/dist/index.js ./dist/index.js
COPY --from=build --chown=bun:bun /app/apps/api/dist-db/migrate.js ./db-migrate.js
# Sortie Vite : servie par l'API sous `/`.
COPY --from=build --chown=bun:bun /app/apps/web/dist ./public
COPY --chown=bun:bun scripts/prod-entrypoint.sh ./prod-entrypoint.sh

# Volumes : `blasons` en lecture seule côté API, `importstatus` en lecture.
RUN mkdir -p /data/blasons /data/import-status \
  && chown -R bun:bun /app /data/blasons /data/import-status \
  && chmod +x /app/prod-entrypoint.sh

USER bun
EXPOSE 3000

# Sonde sur la route publique : n'exige ni curl ni wget dans l'image.
# `start-period` à 30 s : les migrations s'exécutent sur ce même conteneur avant
# l'écoute du port, et peuvent dépasser 15 s sur une base déjà peuplée.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["bun", "-e", "const res = await fetch('http://127.0.0.1:3000/api/v1/health'); process.exit(res.ok ? 0 : 1)"]

ENTRYPOINT ["/app/prod-entrypoint.sh"]
CMD ["bun", "/app/dist/index.js"]
