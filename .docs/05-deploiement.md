# 05 — Runbook de déploiement

> **Procédure, pas preuve.** Chaque case de ce document est une **action à faire sur un hôte
> réel** ; aucune n'est cochée par la présence du code dans le dépôt. Une case cochée ici veut
> dire « vérifié sur l'hôte de production, à cette date », pas « implémenté ».
>
> Ce document **complète** `.docs/01-architecture.md` §6.1, qui décrit la topologie et le
> service des fichiers ; il ne le remplace pas. En cas de contradiction, §6.1 gagne : il décrit
> le code, ce document décrit l'exploitation.
>
> Source : `ROADMAP.md` §2.A.2, constats A1 → A9 de §2.A.
> Dernière mise à jour : 2026-11-20.

## Comment lire les étiquettes

| Étiquette | Sens |
| :--- | :--- |
| **[code]** | fermé ou amorcé dans le dépôt ; la commande le vérifie, mais l'hôte peut encore manquer |
| **[hôte]** | ne peut être fait que sur la machine de production, par un humain avec les accès |
| **[juridique]** | dépend d'une décision ou d'un document qui n'est pas du code |

---

## 1. Calcul et image

- [ ] **[hôte]** Le processeur de l'hôte est en **x86_64**. Sur un poste Apple Silicon, toute
      construction produit une image `arm64` qui ne démarrera pas sur la plupart des hébergeurs.
      Vérifier avec `uname -m` sur l'hôte : `x86_64` attendu. Sinon, construire et pousser
      l'image depuis CI avec :

      ```sh
      docker buildx build --platform linux/amd64 -t <registre>/hexamap:<tag> --push .
      ```

      L'étape `prod` du `Dockerfile` est la seule à publier ; `deps`, `dev` et `build` sont des
      étapes intermédiaires.

- [ ] **[hôte]** Dimensionnement minimum : **2 vCPU / 2 Go de RAM / 20 Go de disque**, PostgreSQL
      colocalisé. 1 Go est insuffisant dès que le référentiel Open Data et la SPA partagent le
      conteneur (l'image de production pèse 180 Mo, le référentiel importé plusieurs centaines de
      Mo de plus).

- [ ] **[code]** Le démarrage est reproductible :

      ```sh
      docker compose -f docker-compose.prod.yml up -d --build
      ```

      Deux services seulement, `db` et `api`, tous deux `restart: unless-stopped`. `api` publie
      `${WEB_HOST_PORT:-8080}` → `3000` et sert **l'API et la SPA** (`SERVE_WEB=true`,
      `WEB_DIST_DIR=/app/public`). Aucun conteneur `web` : ne jamais le réintroduire.
      Vérifier l'état avec `docker compose -f docker-compose.prod.yml ps` — les deux services
      doivent être `healthy`.

## 2. Persistance

- [ ] **[code]** Volume de données PostgreSQL nommé et **préfixé `prod`** :

      ```sh
      PROD_PGDATA_VOLUME=hexamap_prod_pgdata   # défaut
      ```

      Ces variables sont documentées dans `.env.example` et se posent dans le `.env` de l'hôte
      (jamais dans git). Les surcharger ne sert qu'à rattacher un volume existant.

- [ ] **[code]** Volumes d'assets, également préfixés `prod` depuis le constat A7 :

      ```sh
      BLASONS_VOLUME=hexamap_prod_blasons           # défaut
      IMPORT_STATUS_VOLUME=hexamap_prod_importstatus # défaut
      ```

      Avant A7, leurs valeurs par défaut étaient `hexamap_blasons` et `hexamap_importstatus`,
      soit **exactement** les noms des volumes du projet de développement : un hôte pouvait
      rattacher les données d'un environnement à l'autre sans que rien ne le signale. Ne les
      remettre à ces valeurs que pour partager volontairement un volume.

      L'API les monte en **lecture seule** (`:ro`). Seul le pipeline d'import
      (`docker compose --profile tools run --rm dev …`) les écrit.

- [ ] **[hôte]** Alerte d'occupation disque à **80 %**. Les seuls écrivains non bornés sont
      PostgreSQL et les journaux — ces derniers étant désormais plafonnés (voir §5).

- [ ] **[hôte]** Si un PostgreSQL managé est préféré au service `db` : retirer le service `db`
      de `docker-compose.prod.yml` et pointer `DATABASE_URL` sur l'instance. Le réseau `backend`
      (`internal: true`) perd alors sa raison d'être, `api` restant sur `public`.

## 3. Sauvegarde et restauration

Le constat **A5** : aucune sauvegarde n'existait, et une sauvegarde de la base seule serait
incomplète — les blasons et l'état d'import ne sont pas dans PostgreSQL.

- [ ] **[code]** Le script `scripts/backup.sh` (POSIX `sh`, `set -eu`) produit, dans
      `${BACKUP_DIR:-./backups}` et pour un même horodatage UTC :

      | Fichier | Contenu |
      | :--- | :--- |
      | `hexamap-<horodatage>.dump` | `pg_dump -Fc` de `${POSTGRES_DB:-hexamap}` |
      | `hexamap-<horodatage>-blasons.tar.gz` | volume `${BLASONS_VOLUME}` |
      | `hexamap-<horodatage>-importstatus.tar.gz` | volume `${IMPORT_STATUS_VOLUME}` |

      Il échoue avec un code non nul et un message français explicite si le service `db` de la
      pile de production ne tourne pas, si le dump est vide ou si une archive sort vide. Il ne
      modifie jamais la pile et n'écrit aucun secret (les identifiants restent dans
      l'environnement de `docker compose`).

- [ ] **[hôte]** Planification quotidienne, par exemple :

      ```sh
      # crontab -e  (03:15 UTC, sauvegardes conservées 7 jours)
      15 3 * * * cd /srv/hexamap && BACKUP_DIR=/srv/backups ./scripts/backup.sh >> /var/log/hexamap-backup.log 2>&1
      ```

      Rétention : `BACKUP_RETENTION_DAYS` (défaut 7). Les fichiers d'un même horodatage portent
      le même préfixe et sont purgés ensemble.

- [ ] **[hôte]** **Exercice de restauration**, à faire une fois avant l'ouverture et à consigner
      avec sa date. Sur un hôte de test, jamais sur la production :

      ```sh
      # 1. Base de travail isolée
      docker compose -f docker-compose.prod.yml up -d db
      docker compose -f docker-compose.prod.yml exec -T db \
        createdb -U hexamap hexamap_restore

      # 2. Restauration (--clean --if-exists rend l'exercice rejouable)
      docker compose -f docker-compose.prod.yml exec -T db \
        pg_restore -U hexamap -d hexamap_restore --clean --if-exists --no-owner < hexamap-<h>.dump

      # 3. Contrôle : les 24 tables et les 6 clés de game_config
      docker compose -f docker-compose.prod.yml exec -T db \
        psql -U hexamap -d hexamap_restore -c '\dt' 
      docker compose -f docker-compose.prod.yml exec -T db \
        psql -U hexamap -d hexamap_restore -c 'select count(*) from game_config;'  # attendu 6

      # 4. Volumes
      docker run --rm -v hexamap_prod_blasons:/data alpine:3 \
        sh -c 'rm -rf /data/* && tar -xzf - -C /data' < hexamap-<h>-blasons.tar.gz
      ```

      `--clean --if-exists` supprime les objets existants avant de les recréer : sans lui, un
      second essai échoue sur des collisions. `--no-owner` évite un échec si le rôle de
      restauration diffère de celui de production.

- [ ] **[hôte]** Copie hors site des archives. Un `pg_dump` stocké sur le disque qu'il sauvegarde
      ne protège de rien.

## 4. Réseau et TLS

- [ ] **[hôte]** **Une seule origine** sert l'API et la SPA sur **443**. Jamais
      `api.example.com` à côté de `example.com` : CORS, cookies et service worker supposent tous
      une origine unique (`.docs/01-architecture.md` §4.5 et §6.1).

- [ ] **[hôte]** DNS `A`/`AAAA` vers l'hôte et renouvellement de certificat automatisé.

- [ ] **[code]** Les trois variables d'origine pointent sur `https://…` :

      ```sh
      PROD_APP_URL=https://hexamap.example.com
      PROD_BETTER_AUTH_URL=https://hexamap.example.com
      PROD_FRONTEND_URL=https://hexamap.example.com
      TRUSTED_ORIGINS=          # vide si une seule origine ; sinon les origines réelles, séparées par des virgules
      ```

      Le préfixe `PROD_` évite la collision avec les valeurs de développement du `.env`.

- [ ] **[hôte]** **TLS terminé en amont.** En production, `useSecureCookies` est forcé : sur du
      HTTP simple, la connexion semble réussir mais aucune session ne persiste (constat A8). Le
      reverse proxy doit donc répondre en `https://` et transmettre
      `X-Forwarded-For` **et** `X-Forwarded-Proto`.

- [ ] **[hôte]** Si `WEB_HOST_PORT` n'est pas `8080`, le proxy en amont doit viser le port
      réellement publié ; `8080` reste le défaut.

## 5. Secrets et accès

- [ ] **[hôte]** `BETTER_AUTH_SECRET` : au moins 32 octets aléatoires, **unique par
      environnement**, jamais dans git. Générer avec `openssl rand -base64 48`. Le schéma
      `env.ts` refuse moins de 32 caractères ; il ne peut pas juger de l'entropie — c'est le
      constat A4.

- [ ] **[hôte]** `POSTGRES_PASSWORD` changé depuis la valeur par défaut `hexamap`. Le port de la
      base n'est jamais publié en production : `db` reste sur `backend` (`internal: true`).

- [ ] **[hôte]** Secrets injectés par la plateforme ou par le `.env` de l'hôte, jamais figés
      dans l'image. `.env.example` ne contient aucune valeur réelle : c'est un modèle.

- [ ] **[hôte]** SSH limité à une clé d'administration, pas de mot de passe.

- [ ] **[code]** IP cliente résolue derrière mandataire (**A3**). `apps/api/src/auth.ts` configure
      `advanced.ipAddress.ipAddressHeaders: ['x-forwarded-for']` et
      `advanced.ipAddress.trustedProxies`, alimenté par `TRUSTED_PROXIES`. La valeur par défaut est
      **vide** : tant que la bordure d'hébergement n'est pas connue, aucun en-tête n'est cru et
      aucune IP ne peut être falsifiée par un client.

      ```sh
      TRUSTED_PROXIES=            # défaut : aucun mandataire de confiance
      TRUSTED_PROXIES=172.18.0.0/16   # adresse ou CIDR du reverse proxy, séparés par des virgules
      ```

      **La vérification est hôte, pas code.** Sans `TRUSTED_PROXIES` renseigné et sans en-tête
      transmis par la bordure, Better Auth retombe sur un seau de rate limiting partagé et
      journalise un avertissement. Contrôle après déploiement :

      ```sh
      # 1. Aucun avertissement « shared per-path bucket » au démarrage
      docker compose -f docker-compose.prod.yml logs api | grep -i 'bucket'

      # 2. Une session créée derrière le proxy porte une adresse non vide
      docker compose -f docker-compose.prod.yml exec -T db \
        psql -U hexamap -d hexamap -c \
        'select "ipAddress", "userAgent" from session order by "createdAt" desc limit 5;'
      ```

      `ipAddress` doit afficher l'adresse réelle du client, jamais `''` ni l'adresse du proxy.

## 6. Exploitation

- [ ] **[code]** Sonde de santé sur `GET /api/v1/health`. Le `HEALTHCHECK` de l'image
      (`--start-period=30s`) laisse le temps des migrations au démarrage.

- [ ] **[code]** Journaux bornés (constat **A6**) : les services `db` et `api` portent le pilote
      `json-file` avec `max-size: "10m"` et `max-file: "5"`, soit **50 Mio au plus par service**.
      Sans ce plafond, `restart: unless-stopped` plus un conteneur bavard remplissaient le disque et
      arrêtaient l'API. Contrôle :

      ```sh
      docker compose -f docker-compose.prod.yml config | grep -A4 'logging:'
      ```

- [ ] **[hôte]** Moniteur de disponibilité sur `/api/v1/health` et un collecteur d'erreurs. Le
      journal d'événements par requête est la seule observabilité disponible aujourd'hui.

- [ ] **[code]** `RUN_MIGRATIONS` (défaut `1`) : au démarrage, `scripts/prod-entrypoint.sh`
      applique les migrations puis `exec "$@"`. C'est correct pour **exactement un** conteneur qui
      démarre. Pour deux réplicas ou un déploiement bleu/vert, poser `RUN_MIGRATIONS=0` sur les
      instances et appliquer les migrations comme une étape séparée, sinon les conteneurs se
      disputent le verrou de Kysely.

- [ ] **[hôte]** Rotation et fenêtre de rétention des journaux : la borne Docker du point
      précédent est la première moitié ; la seconde est la politique de l'hôte (ou du collecteur).

## 7. Produit et légal

- [ ] **[hôte]** Référentiel importé (**A2**) : `ref_regions`, `ref_departements`, `ref_communes`,
      `ref_odonymes`, `commune_odonymes`. Sans lui, la génération d'un ticket répond
      `503 REFERENCE_DATA_MISSING` — et, par construction, la charge n'est pas consommée. Le
      constat A2 n'est pas un défaut : le référentiel n'est pas dans l'image, c'est volontaire.

      ```sh
      docker compose --profile tools run --rm dev bun run import --lite   # ou l'import complet
      ```

- [ ] **[hôte]** Blasons importés et attribués. `blason_credit` est servi avec chaque carte : une
      carte sans attribution est un manquement, pas un détail d'affichage.

- [ ] **[juridique]** Mentions légales, CGV, politique de confidentialité et information sur les
      cookies — un cookie de session reste un cookie.

- [ ] **[juridique]** DPA signé avec l'hébergeur, résidence des données dans l'UE.

- [ ] **[hôte]** Limitation de débit en bordure devant `/api/auth/*`, **en plus** de celle de
      Better Auth. Better Auth protège la connexion ; il ne protège pas d'un balayage à bas débit
      réparti sur plusieurs comptes.

- [ ] **[juridique]** SMTP (constat **A9**). Décision à prendre **avant** l'ouverture, dans un
      sens ou dans l'autre :

      | Choix | Conséquence |
      | :--- | :--- |
      | Fournir SMTP | Réinitialisation de mot de passe et vérification d'adresse disponibles ; un prestataire de plus dans le DPA |
      | Ne pas fournir SMTP | Aucune réinitialisation de mot de passe : il faut l'écrire dans l'interface et accepter des comptes perdus |

      Tant que rien n'est décidé, ne pas laisser croire qu'une réinitialisation existe.

---

## Porte de sortie

L'ouverture est verte quand :

1. le référentiel et les blasons sont importés sur l'hôte (A2) ;
2. A3 est **vérifié sur l'hôte** — `session.ipAddress` non vide derrière le proxy ;
3. A4, A8, A9 sont tranchés sur l'hôte ou juridiquement ;
4. A6 et A7 sont en place (code livré, `docker compose config` le montre) ;
5. une sauvegarde a été prise **et restaurée** au moins une fois (A5) ;
6. `ci:check` est vert sur le commit déployé ;
7. une boucle réelle — inscription → ticket → grattage → tableau — a été jouée **sur l'hôte**,
   pas sur un portable.
