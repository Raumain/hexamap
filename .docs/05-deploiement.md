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
      `env.ts` refuse moins de 32 caractères **et** la valeur d'exemple `change-me` (même
      allongée) ; il ne peut pas juger de l'entropie — c'est le constat A4.

- [ ] **[hôte]** `POSTGRES_PASSWORD` et `DATABASE_URL` sont **obligatoires** : la pile de
      production refuse de démarrer sans elles (`${POSTGRES_PASSWORD:?…}`), au lieu de retomber
      silencieusement sur `hexamap`. Changer le mot de passe depuis la valeur de développement.
      Le port de la base n'est jamais publié en production : `db` reste sur `backend`
      (`internal: true`).

- [ ] **[code]** `AUTH_COOKIE_SECURE=false` est refusé dès que `NODE_ENV=production` : la
      dérogation n'existe que pour un banc servi en HTTP simple.

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
      TRUSTED_PROXIES=10.0.0.0/8,2001:db8::/32  # IPv4 et IPv6 acceptés
      ```

      Le CIDR est celui de la **bordure qui écrit `X-Forwarded-For`**, jamais une plage de
      clients. En production, une liste vide produit **un** avertissement bruyant au démarrage
      (« rate limiting d'authentification réduit à un unique seau partagé ») : ce n'est pas un
      échec, une bordure peut légitimement terminer TLS sans produire d'en-tête, mais la limite
      devient alors globale et un attaquant peut épuiser la connexion de tous les joueurs.

      **La vérification est hôte, pas code.** Sans `TRUSTED_PROXIES` renseigné et sans en-tête
      transmis par la bordure, Better Auth retombe sur ce seau partagé et journalise
      l'avertissement applicatif. Contrôle après déploiement :

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

- [x] **[hôte]** Référentiel importé (**A2**) — *fait le 2026-11-22, déclaration du titulaire* :
      `ref_regions`, `ref_departements`, `ref_communes`,
      `ref_odonymes`, `commune_odonymes`. Sans lui, la génération d'un ticket répond
      `503 REFERENCE_DATA_MISSING` — et, par construction, la charge n'est pas consommée. Le
      constat A2 n'est pas un défaut : le référentiel n'est pas dans l'image, c'est volontaire.

      ```sh
      docker compose --profile tools run --rm dev bun run import --lite   # ou l'import complet
      ```

- [ ] **[hôte]** Blasons importés et attribués. `blason_credit` est servi avec chaque carte : une
      carte sans attribution est un manquement, pas un détail d'affichage.

- [ ] **[juridique]** Mentions légales, politique de confidentialité et information sur les
      cookies — un cookie de session reste un cookie. Le dépôt ne livre que la **structure** :
      `/mentions-legales` et `/confidentialite` rendent deux documents dont chaque section porte
      un repère `[À COMPLÉTER — …]`, et un bandeau « Texte provisoire — à compléter avant la
      mise en vente. » reste affiché tant qu'un repère subsiste. Le **texte juridique** est le
      livrable du titulaire du site, rédigé par un professionnel ; ce dépôt ne contient aucune
      prose juridique et aucune des deux pages ne doit être considérée comme publiée avant
      remplacement des repères. **La page de conditions générales de vente a été retirée de
      l'interface** (retour R-004, phase 46) : aucune URL `/cgv` n'existe plus, et la boutique
      étant fermée, aucune vente n'a lieu.

- [ ] **[hôte]** Après le texte, le Dashboard Stripe : enregistrer l'URL publique des conditions
      générales de vente (Settings → Business → Public details) **avant** de poser
      `SHOP_REQUIRE_TOS_CONSENT=true`. Cette URL ne peut plus désigner une page du jeu : la page
      CGV a été retirée de l'interface (retour R-004, phase 46) et la boutique est fermée, donc
      le document devrait être publié ailleurs — l'interrupteur reste éteint en attendant.
      Tant que cette URL manque, Stripe refuse `terms_of_service: 'required'` et le checkout
      échoue ; le consentement aux CGV n'est donc pas recueilli au paiement. Le texte de
      renoncement au droit de rétractation, lui, est déjà transmis au paiement
      (`custom_text.submit`) quel que soit l'état de l'interrupteur.

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

- [ ] **[hôte]** Interrupteurs du compte, posés sur le service `api` :

      | Variable | Défaut | Rôle |
      | :--- | :--- | :--- |
      | `ACCOUNT_DELETION_ENABLED` | `true` | Ouvre `DELETE /api/v1/account`. **Ouverte par défaut** depuis la publication des pages légales définitives, qui décrivent la suppression et son effet : la fonctionnalité n'attend plus d'interrupteur. La poser à `false` la referme — c'est l'échappatoire d'exploitation, sans migration et sans retirer les pages. La variable est relue à chaque appel, donc un redéploiement n'est pas nécessaire pour l'éteindre. |
      | `MAIL_OUTBOX_DIR` | absente | Transport de courriel : chaque message de vérification est écrit en JSON dans ce répertoire, sans aucun envoi réseau. Absente, `POST /api/v1/account/email` répond `503 EMAIL_VERIFICATION_DISABLED` et l'écran `/compte` désactive le formulaire au lieu d'annoncer un envoi. |

      Le courriel n'est donc pas un service : c'est un fichier. Une vraie remise suppose un
      prestataire (A9 ci-dessus), pas un dossier. `GET /api/v1/account/capabilities` rend ces
      deux états à l'interface, qui ne propose jamais une action vouée au `503`.

---

## 8. Déploiement sur un VPS avec Dokploy

> Dokploy exécute une pile Docker Compose et place **Traefik** devant elle : Traefik termine
> le TLS et joint les services par le réseau externe `dokploy-network`, sur le **port du
> conteneur**, pas sur un port publié de l'hôte.
>
> Le dépôt porte deux fichiers : `docker-compose.prod.yml` (suffisant à un VPS nu) et
> `docker-compose.dokploy.yml` (**override** de la variante Dokploy, jamais monté seul). La
> commande exacte est rappelée en §8.1.
>
> Une case **[vérif VPS]** signale une valeur ou un comportement qui ne peut pas être constaté
> depuis le dépôt. Aucune n'est affirmée ici.

### 8.1 Le réseau et le port — fichiers livrés

```sh
# VPS nu
docker compose -f docker-compose.prod.yml up -d --build

# Dokploy
docker compose -f docker-compose.prod.yml -f docker-compose.dokploy.yml up -d
```

- [x] **[code]** `docker-compose.dokploy.yml` rattache `api` au réseau de la bordure :
      `dokploy-network` (`external: true`, `name: dokploy-network`), en plus de `backend`.
      `db` **reste** sur `backend` seul (`docker-compose.prod.yml:46`) : il n'est jamais
      joignable depuis le réseau de Traefik. `external: true` n'est **pas** dans le fichier de
      base : un VPS nu ne déclare pas ce réseau et n'en dépend donc pas.

- [x] **[code]** Le port. `docker-compose.prod.yml:62` publie
      `"${WEB_BIND_ADDRESS:-0.0.0.0}:${WEB_HOST_PORT:-8080}:3000"` et déclare
      `expose: ["3000"]` (`:66`). L'override **remplace** la liste (`!override`) par une
      liaison sur la boucle locale : Compose concatène les séquences `ports` d'un override, et
      deux liaisons sur le même port d'hôte échoueraient au démarrage.

      | Contexte | `WEB_BIND_ADDRESS` | Effet |
      | :--- | :--- | :--- |
      | VPS nu, non posée | `0.0.0.0` (défaut) | port joignable depuis l'extérieur ; un proxy en amont le vise (§4) |
      | VPS nu, firewall fermé | `127.0.0.1` | le port n'écoute que sur la boucle locale ; un proxy local le vise |
      | Dokploy | `127.0.0.1` (défaut de l'override) | Traefik joint le conteneur par `dokploy-network`, **port 3000** ; le port publié n'est pas un chemin d'accès |

      Un port publié sur `0.0.0.0` sous Dokploy contourne le TLS : le cookie de session étant
      `Secure` (`auth.ts:43`), une connexion en HTTP clair semble réussir sans jamais persister.
      C'est la seule raison du `127.0.0.1`, pas un confort.

- [x] **[code]** Le routage appartient au **dépôt**, pas à l'interface Dokploy. Le
      déploiement Compose de Dokploy n'injecte **aucun** label Traefik : sans labels, le
      conteneur est sain et présent sur `dokploy-network`, mais aucun routeur n'est créé et
      Traefik répond `404` sur le domaine. `docker-compose.dokploy.yml` porte donc un bloc
      `labels` qui déclare trois objets, tous préfixés `hexamap` pour qu'aucun nom généré par
      Dokploy ne puisse entrer en collision :

      | Objet | Nom | Rôle |
      | :--- | :--- | :--- |
      | routeur | `hexamap-websecure` | `Host(${PUBLIC_HOST})` sur `websecure`, `tls=true`, `tls.certresolver=letsencrypt` |
      | routeur | `hexamap-web` | `Host(${PUBLIC_HOST})` sur `web`, middleware `hexamap-redirect` |
      | middleware | `hexamap-redirect` | `redirectscheme.scheme=https` |
      | service | `hexamap` | `loadbalancer.server.port=3000` (port du **conteneur**) |

      `traefik.docker.network=dokploy-network` est **obligatoire** : le conteneur est sur trois
      réseaux (`backend`, `public`, `dokploy-network`) et, sans cette épingle, Traefik peut élire
      l'IP d'un réseau qu'il ne partage pas — la requête n'aboutit alors jamais, sans erreur.

      Les deux routeurs portent en revanche une **priorité explicite de `100`**
      (`traefik.http.routers.hexamap-web*.priority`). La priorité par défaut d'un routeur
      Traefik est la **longueur de sa règle** : deux `Host()` identiques ont donc la même
      priorité, et l'arbitrage entre eux est indéterminé. C'est un incident réel, pas une
      hypothèse — quatre routeurs sur la même règle (`hexamap-web` / `hexamap-websecure` plus une
      paire `hexamap-app-*-*` générée par l'onglet « Domains ») ont produit un
      `ROUTE_NOT_FOUND` sur `/api/v1/health`, le routeur de Dokploy réécrivant le chemin selon
      l'ordre de lecture. `100` dépasse la longueur de tout `Host()` plausible : même si une
      entrée de domaine réapparaît dans l'interface, le routeur du dépôt reste **autoritaire**.
      C'est un verrou, pas la correction de fond — supprimer l'entrée reste le geste correct.

      Les noms `web`, `websecure` et `letsencrypt` sont ceux qu'expose un Dokploy standard. Ils
      ne sont pas constatables depuis le dépôt : si l'instance utilise d'autres entrées ou un
      autre résolveur, ce sont ces trois valeurs du bloc `labels` qu'il faut aligner.

- [x] **[code]** `PUBLIC_HOST` est la seule source de vérité du nom d'hôte, exigée par `:?` :
      une valeur absente arrête `docker compose` au lieu de produire un `Host()` vide qui ne
      correspond à aucune requête. Contrôle, sans démarrer la pile :

      ```sh
      docker compose -f docker-compose.prod.yml -f docker-compose.dokploy.yml config \
        | grep -E 'Host\(|traefik.docker.network|server.port'
      # attendu : Host(`hexamap.example.fr`), dokploy-network, "3000"
      docker compose -f docker-compose.prod.yml -f docker-compose.dokploy.yml config >/dev/null
      # sans PUBLIC_HOST : code 1 et « required variable PUBLIC_HOST is missing a value »
      ```

- [ ] **[vérif VPS]** **Ne pas** déclarer le domaine dans l'onglet « Domains » de Dokploy.
      Deux routeurs sur la même règle `Host(...)` rendent le comportement indéfini (le certificat
      peut être demandé deux fois, et l'un des deux routeurs peut ne jamais recevoir de trafic).
      Si l'opérateur préfère l'interface, il doit **retirer** le bloc `labels` de
      `docker-compose.dokploy.yml` — jamais le laisser en place à côté.

      Un seul domaine, une seule origine : ne jamais créer un `api.example.fr` à côté de
      `example.fr` (§4, et `.docs/01-architecture.md` §4.5).

      **Diagnostic — quels routeurs existent réellement ?** Le conteneur ne doit porter que les
      deux routeurs du dépôt. Toute paire `hexamap-app-*-*` prouve qu'une entrée de domaine
      subsiste dans l'interface :

      ```sh
      docker inspect <conteneur-api> --format '{{json .Config.Labels}}' | tr ',' '\n' \
        | grep -i 'traefik.http.routers.*rule'
      # attendu : seulement hexamap-web et hexamap-websecure
      # une paire hexamap-app-n2bjiy-2-web / -websecure => supprimer le domaine
      #   dans l'onglet « Domains », puis redéployer
      docker inspect <conteneur-api> --format '{{json .Config.Labels}}' | tr ',' '\n' \
        | grep -i 'traefik.http.routers.*priority'
      # attendu : "100" pour hexamap-web et hexamap-websecure
      ```

      Tant qu'une paire `hexamap-app-*-*` existe, la priorité `100` garde le dépôt devant, mais
      l'entrée est un défaut à corriger : elle demande un certificat de plus et survivra au
      prochain redéploiement de l'interface.

- [ ] **[vérif VPS]** Diagnostic d'un `404` de Traefik alors que `api` est sain : **conteneur sain
      sur `dokploy-network` + `404` Traefik = aucun routeur**. Confirmer que les labels sont bien
      arrivés jusqu'au conteneur :

      ```sh
      docker inspect <conteneur-api> --format '{{json .Config.Labels}}' | grep traefik
      # vide ou absent : le compose déployé ne portait pas le bloc labels
      docker network inspect dokploy-network -f '{{range .Containers}}{{.Name}} {{end}}'
      # le conteneur api doit y figurer
      ```


- [ ] **[vérif VPS]** Constater que le port publié n'est pas un chemin d'accès, depuis
      l'extérieur du VPS :

      ```sh
      curl -s -o /dev/null -w '%{http_code}\n' --max-time 5 http://<ip-du-vps>:8080/
      # attendu : 000 (connexion refusée) ; un 200 signifie que la liaison n'est pas sur 127.0.0.1
      ```

### 8.2 Les variables d'environnement

Le compose **impose** les noms `PROD_*` et **refuse de démarrer** sans eux : `APP_URL`,
`BETTER_AUTH_URL` et `FRONTEND_URL` s'écrivent `${PROD_APP_URL:?…}`, `${PROD_BETTER_AUTH_URL:?…}`
et `${PROD_FRONTEND_URL:?…}` (`docker-compose.prod.yml:84-86`). Injecter `FRONTEND_URL` depuis
Dokploy **n'a aucun effet** : la variable lue par le compose est `PROD_FRONTEND_URL`. Le `:?`
est volontaire — le repli `http://localhost:…` retiré satisfaisait `z.url()` (`env.ts:8-13`) et
l'application démarrait avec une liste blanche CORS limitée à l'hôte local, sans aucune erreur.

Le secret d'exemple reste refusé même allongé (`env.ts:50-57`) : `change-me` et ses répétitions
échouent, quelle que soit leur longueur. Et `AUTH_COOKIE_SECURE=false` est refusé dès
`NODE_ENV=production` (`env.ts:70-77`).

Les six `STRIPE_*` sont désormais **exigées** : la boutique ouvre au lancement, et une clé
absente doit arrêter la pile plutôt que dégrader en `503 SHOP_DISABLED` pendant que l'opérateur
croit la boutique en ligne. Le schéma de `apps/api/src/env.ts:37-43` les garde optionnelles à
dessein : un conteneur de développement sans Stripe continue de tourner.

Liste à poser dans l'environnement du service `api` (ou dans le `.env` du déploiement Dokploy,
jamais dans git) :

| Variable | Valeur attendue | Lue par |
| :--- | :--- | :--- |
| `PROD_APP_URL` | `https://hexamap.example.com` | compose `:84` → `APP_URL` (`env.ts:8`, requis) |
| `PROD_BETTER_AUTH_URL` | `https://hexamap.example.com` | compose `:85` → `BETTER_AUTH_URL` (`env.ts:9`, requis) |
| `PROD_FRONTEND_URL` | `https://hexamap.example.com` | compose `:86` → `FRONTEND_URL` (`env.ts:13`, **obligatoire en prod** — `FRONTEND_URL` seule ne sert à rien) |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 48` | compose `:87` (≥ 32, anti-`change-me`) |
| `POSTGRES_PASSWORD` | mot de passe unique | compose `:28` (`:?` — refus de démarrer sans) |
| `DATABASE_URL` | `postgres://hexamap:<mdp>@db:5432/hexamap` | compose `:76`, `env.ts:7` |
| `TRUSTED_ORIGINS` | **vide** si une seule origine | `env.ts:15` |
| `TRUSTED_PROXIES` | CIDR de `dokploy-network` (§8.3) — **vide** si aucune bordure | compose `:97` → `env.ts:20` → `auth.ts:133`. Doit figurer dans le fichier d'environnement de la **pile** : la poser dans le shell de l'opérateur ne l'envoie pas au conteneur |
| `AUTH_COOKIE_SECURE` | **ne pas poser** | `auth.ts:43` : `NODE_ENV=production` suffit à forcer `Secure` |
| `RUN_MIGRATIONS` | `1` (défaut) — voir §8.4 | compose `:100` |
| `WEB_BIND_ADDRESS` | `127.0.0.1` (défaut de l'override Dokploy) | compose `:62`, `docker-compose.dokploy.yml:28` |
| `PUBLIC_HOST` | `hexamap.example.fr` — **hôte nu**, sans schéma, sans barre oblique finale | `docker-compose.dokploy.yml` (`:?` — règle `Host()`) |
| `BLASONS_VOLUME` | `hexamap_prod_blasons` (défaut) | compose `:154` |
| `IMPORT_STATUS_VOLUME` | `hexamap_prod_importstatus` (défaut) | compose `:156` |
| `PROD_PGDATA_VOLUME` | `hexamap_prod_pgdata` (défaut) | compose `:144` |
| `STRIPE_SECRET_KEY` | `sk_live_…` (ou `sk_test_…` avant ouverture) | compose `:107` (`:?`) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` de l'endpoint (§8.7) | compose `:108` (`:?`) |
| `STRIPE_PRICE_PACK_500` | `price_…` du pack 500 | compose `:109` (`:?`) |
| `STRIPE_PRICE_PACK_1200` | `price_…` du pack 1 200 | compose `:110` (`:?`) |
| `STRIPE_PRICE_PACK_2500` | `price_…` du pack 2 500 | compose `:111` (`:?`) |
| `STRIPE_PRICE_PACK_6000` | `price_…` du pack 6 000 | compose `:112` (`:?`) |

`DATABASE_URL` garde `db` comme hôte : le nom du service Compose est résolu sur `backend`.
Contrôle immédiat, sans démarrer la pile : `docker compose -f docker-compose.prod.yml config`
échoue en listant exactement les variables manquantes (douze).

### 8.3 Le mandataire et l'IP cliente

Traefik écrit `X-Forwarded-For`. `apps/api/src/auth.ts:131-133` ne le croit que si l'émetteur
appartient à `TRUSTED_PROXIES`.

- [ ] **[vérif VPS]** Obtenir le sous-réseau de `dokploy-network` :

      ```sh
      docker network inspect dokploy-network -f '{{range .IPAM.Config}}{{.Subnet}} {{end}}'
      ```

      Porter cette valeur (par exemple `10.0.1.0/24`) dans `TRUSTED_PROXIES`. C'est le CIDR de
      la **bordure**, jamais une plage de clients : croire une plage d'où vient le client
      laisserait n'importe qui choisir son IP et contourner le rate limiting.

- [ ] **[code]** Laissée vide en production, la variable produit **un** avertissement au
      démarrage (`auth.ts:51-53`) : le rate limiting d'authentification retombe sur « un unique
      seau partagé par chemin ». Ce n'est pas un échec, mais un attaquant peut alors épuiser la
      limite de connexion de **tous** les joueurs, et `session.ipAddress` reste vide. Contrôle
      en §8.7.

### 8.4 Le contrôle des volumes

Les trois volumes sont **explicitement nommés** (`:143`, `:153`, `:155`) : ils portent donc des
noms globaux (`hexamap_prod_*`) et non des noms préfixés par le projet. C'est ce qui les rend
stables alors que Dokploy régénère son nom de projet à chaque déploiement.

- [ ] **[vérif VPS]** Après le premier déploiement, constater les trois noms :

      ```sh
      docker volume ls | grep hexamap_prod
      # hexamap_prod_pgdata  hexamap_prod_blasons  hexamap_prod_importstatus
      ```

- [ ] **[vérif VPS]** Relever le nom de projet réel de la pile — il n'est pas `hexamap-prod`
      sous Dokploy. `docker compose ls` l'affiche en première colonne ; la procédure et son
      usage par `scripts/backup.sh` sont en §8.8. **Ne pas** redéployer en supprimant les
      volumes : ce sont eux qui portent la base, les blasons et l'état d'import.

### 8.5 Migrations au démarrage

`Dockerfile:88` installe `/app/prod-entrypoint.sh` en point d'entrée ; celui-ci exécute
`bun /app/db-migrate.js` quand `RUN_MIGRATIONS=1` (`scripts/prod-entrypoint.sh:8-10`), puis
`exec` le serveur. Les 13 migrations sont **rejouables** (`.docs/02-database.md` §1 règle 8) :
un redémarrage ne casse rien.

- [ ] **[code]** Laisser `RUN_MIGRATIONS=1` sur **exactement un** conteneur. Deux réplicas ou
      un déploiement bleu/vert se disputeraient le verrou de Kysely : poser `0` sur les
      instances et jouer les migrations comme une étape séparée (déjà noté en §6).

- [ ] **[vérif VPS]** `HEALTHCHECK --start-period=30s --retries=3` (`Dockerfile:85-86`). Sur
      base vierge, les migrations tenaient dans ce délai ; sur une base déjà peuplée, la
      création d'index peut le dépasser. Surveiller le premier démarrage :

      ```sh
      docker logs <conteneur-api> 2>&1 | grep -i 'migration\|error'
      ```

      Si le conteneur est marqué `unhealthy` alors que le port écoute, augmenter
      `--start-period` dans le `Dockerfile` plutôt que de désactiver la sonde. À noter : un
      healthcheck en échec ne redémarre pas le conteneur sous Docker ; c'est la plateforme qui
      décide de le remplacer.

### 8.6 Le référentiel (A2) — levé, mais hors de l'image

Import réalisé en production le 2026-11-22 (déclaration du titulaire ; non revérifié depuis cette
machine). L'image ne contient toujours aucune donnée : un volume neuf, une restauration ou un
changement d'hôte exige `scripts/import` avant d'ouvrir, et la sauvegarde couvre déjà ces volumes.

Sans référentiel, la génération d'un ticket répond `503 REFERENCE_DATA_MISSING` et, par
construction, la charge n'est **pas** consommée. La commande de §7
(`docker compose --profile tools run --rm dev …`) ne s'applique pas ici : le service `dev`
n'existe que dans `compose.yml`, et l'image `prod` ne contient **aucune source**
(`Dockerfile:68-72`).

- [ ] **[vérif VPS]** Créer, sur le VPS et **hors du dépôt**, un fichier d'override qui bâtit la
      cible `dev` (elle seule porte `bun install` et les sources) et la rattache au réseau de la
      base **et** à un réseau avec sortie Internet — `backend` est `internal: true`
      (`:99-100`), donc les API Open Data y sont inatteignables :

      ```yaml
      # docker-compose.import.yml
      services:
        import:
          profiles: ["tools"]
          build:
            context: .
            target: dev
          working_dir: /app/scripts/import
          entrypoint: ["bun"]
          command: ["src/index.ts", "--lite"]
          environment:
            DATABASE_URL: ${DATABASE_URL}
            BLASONS_DIR: /data/blasons
            IMPORT_STATUS_DIR: /data/import-status
          volumes:
            - blasons:/data/blasons                 # écriture : l'API, elle, monte :ro
            - importstatus:/data/import-status      # écriture
          networks:
            - backend
            - dokploy-network
      ```

- [ ] **[vérif VPS]** Jouer les deux étapes, dans cet ordre :

      ```sh
      # 1. Référentiel (valider d'abord le câblage avec --lite)
      docker compose -f docker-compose.prod.yml -f docker-compose.import.yml \
        --profile tools run --rm import
      # 2. Blasons, une fois le référentiel en place
      docker compose -f docker-compose.prod.yml -f docker-compose.import.yml \
        --profile tools run --rm import src/index.ts --blasons
      ```

      Ordres de grandeur mesurés sur la base de développement : `commune_odonymes`
      ≈ **2 178 763 lignes**, blasons ≈ **251 Mo** (`.docs/03-active-task.md`). Le référentiel
      complet pèse plusieurs centaines de Mo (§1). **Durée d'import : non mesurée sur un VPS**
      — prévoir une fenêtre large, lancer `--lite` d'abord, et surveiller l'espace disque
      (§2 : alerte à 80 %).

- [ ] **[vérif VPS]** Contrôler le résultat avant d'ouvrir :

      ```sh
      docker compose -f docker-compose.prod.yml exec -T db psql -U hexamap -d hexamap -c \
        'select (select count(*) from ref_regions) regions,
                (select count(*) from ref_departements) departements,
                (select count(*) from ref_communes) communes,
                (select count(*) from ref_odonymes) odonymes,
                (select count(*) from commune_odonymes) liens;'
      ```

      Aucune ligne à zéro, et la génération d'un ticket cesse de répondre `503`.

### 8.7 Le webhook Stripe

Le chemin est **public** et l'est par construction : `shopWebhookRoutes` est monté dans
`buildPublicRoutes` (`apps/api/src/app.ts:46`), donc hors `authPlugin` — Stripe appelle depuis
l'extérieur, sans session.

- [ ] **[code]** URL à déclarer chez Stripe :

      ```
      https://hexamap.example.com/api/v1/shop/webhook
      ```

      Décomposition : préfixe `/api/v1` (`app.ts:46`) + préfixe `/shop` et route `/webhook`
      (`apps/api/src/routes/shop.ts:292-293`).

- [ ] **[code]** Événements à souscrire — exactement deux, ce sont les seuls traités
      (`apps/api/src/services/stripe-payments.ts`) :

      | Événement | Effet |
      | :--- | :--- |
      | `checkout.session.completed` (`:80`) | crédite les écus, `currency_ledger.reason = 'PURCHASE:<session.id>'` |
      | `charge.refunded` (`:97`) | contrepartie négative proportionnelle, `PURCHASE_REFUND:<session.id>` |

- [ ] **[vérif VPS]** Copier le secret de signature de l'endpoint dans `STRIPE_WEBHOOK_SECRET`, la
      clé secrète dans `STRIPE_SECRET_KEY` et les quatre `STRIPE_PRICE_PACK_*`
      (`docker-compose.prod.yml:98-103`). Les six sont exigées par le compose : une seule
      manquante **empêche la pile de démarrer**, au lieu de laisser la boutique répondre
      `503 SHOP_DISABLED` (`routes/shop.ts:186-188`, `:296-298`) sans que personne ne s'en
      aperçoive. Le corps brut est conservé par `parse: 'text'` : ne jamais placer devant ce
      chemin un mandataire qui re-encode le corps, la signature deviendrait invalide
      (`400 INVALID_SIGNATURE`).

### 8.8 La sauvegarde

`scripts/backup.sh` accepte un nom de projet — `-p <projet>`, `--project-name <projet>`, ou le
repli `COMPOSE_PROJECT_NAME` — et le passe à **toutes** ses invocations `docker compose` (garde-fou
et `exec`). C'était nécessaire : `docker-compose.prod.yml:16` porte un `name:` (`hexamap-prod`),
que `docker compose` préfère à `COMPOSE_PROJECT_NAME`, et Dokploy déploie sous un nom qu'il
génère. Sans `-p`, `docker compose ps` ne voyait aucun service et le garde-fou échouait alors que
la pile tournait. Les volumes, eux, sont adressés par leur nom global (`:43-44`) et fonctionnent
déjà.

- [ ] **[vérif VPS]** Relever le nom de projet réel — c'est la colonne `NAME`, pas `hexamap-prod` :

      ```sh
      docker compose ls
      # NAME              STATUS       CONFIG FILES
      # <projet-dokploy>  running(2)   /etc/dokploy/compose/…/docker-compose.yml
      ```

      Il se lit aussi sur les conteneurs :

      ```sh
      docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' \
        "$(docker ps --filter name=api --format '{{.ID}}' | head -1)"
      ```

      **Ne pas** redéployer en supprimant les volumes : ce sont eux qui portent la base, les
      blasons et l'état d'import.

- [ ] **[vérif VPS]** Lancer la sauvegarde avec ce nom :

      ```sh
      ./scripts/backup.sh -p <projet-dokploy>
      # ou, par variable :
      COMPOSE_PROJECT_NAME=<projet-dokploy> BACKUP_DIR=/srv/backups ./scripts/backup.sh
      ./scripts/backup.sh -h        # aide en français
      ```

      Le garde-fou est conservé : si le service `db` de **cette** pile ne tourne pas, le script
      s'arrête bruyamment, affiche le fichier compose et le nom de projet, et n'écrit aucun
      fichier vide. Éprouvé contre une pile arrêtée avant livraison.

- [ ] **[hôte]** L'équivalent manuel, si le script n'est pas sur le VPS :

      ```sh
      docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$(docker ps -qf name=db)" \
        pg_dump -U hexamap -d hexamap -Fc > /srv/backups/hexamap-$(date -u +%Y%m%dT%H%M%SZ).dump
      ```

      et les deux volumes par le conteneur jetable de `scripts/backup.sh:162-165`
      (`hexamap_prod_blasons`, `hexamap_prod_importstatus`).

### 8.9 Vérification après déploiement

À jouer dans cet ordre, sur le VPS, **après** le premier démarrage réussi et **après**
l'import du §8.6.

| # | Contrôle | Commande | Attendu |
| :--- | :--- | :--- | :--- |
| 1 | Santé | `curl -s https://hexamap.example.com/api/v1/health` | `{"status":"ok","service":"hexamap-api"}` (`app.ts:127`) |
| 2 | Santé base | `curl -s https://hexamap.example.com/api/v1/health/db` | réponse 200 (`app.ts:128`) |
| 3 | Route profonde (SPA) | `curl -s -o /dev/null -w '%{http_code} %{content_type}\n' https://hexamap.example.com/cadastre` | `200 text/html` (repli SPA, `static.ts:217-223`) |
| 4 | Asset absent | `curl -s -w '\n%{http_code}\n' https://hexamap.example.com/assets/nope.js` | `404` + `{"code":"ROUTE_NOT_FOUND"}` (`static.ts:123-126`, `:35-36`) |
| 5 | Route API inconnue | `curl -s -o /dev/null -w '%{http_code}\n' https://hexamap.example.com/api/nope` | `404`, **jamais du HTML** (`static.ts:101-104`) |
| 6 | Avertissement mandataire | `docker logs <api> 2>&1 \| grep -i 'seau partagé'` | **aucune sortie** (`auth.ts:51-53`) |
| 7 | IP cliente réelle | `... psql -c 'select "ipAddress" from session order by "createdAt" desc limit 5;'` (cf. §5) | adresse du client, jamais `''` ni celle du proxy |
| 8 | Une génération réelle | inscription → génération d'un ticket dans l'interface | un ticket de 16 cases, **pas** `503 REFERENCE_DATA_MISSING` |
| 9 | Migrations | `docker logs <api> 2>&1 \| grep -i migration` | 13 migrations appliquées, aucune erreur |
| 10 | Webhook | Stripe → « envoyer un événement de test » sur `checkout.session.completed` | réponse `200 {"received":true}` ; un `400` signale un secret ou un corps re-encodé |

Si le contrôle 8 renvoie `503`, le référentiel n'est pas importé : revenir au §8.6. Si le
contrôle 3 renvoie du JSON, le SPA n'est pas dans l'image (`WEB_DIST_DIR`, `SERVE_WEB`) — mais
ces deux variables sont déjà posées par le `Dockerfile:62-65`.

---

## Porte de sortie

L'ouverture est verte quand :

1. le référentiel et les blasons sont importés sur l'hôte (A2) — fait le 2026-11-22 ;
2. A3 est **vérifié sur l'hôte** — `session.ipAddress` non vide derrière le proxy ;
3. A4, A8, A9 sont tranchés sur l'hôte ou juridiquement ;
4. A6 et A7 sont en place (code livré, `docker compose config` le montre) ;
5. une sauvegarde a été prise **et restaurée** au moins une fois (A5) ;
6. `ci:check` est vert sur le commit déployé ;
7. une boucle réelle — inscription → ticket → grattage → tableau — a été jouée **sur l'hôte**,
   pas sur un portable.
