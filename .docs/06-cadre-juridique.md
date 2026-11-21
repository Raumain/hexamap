# 06 — Cadre juridique applicable à Hexamap (note de cadrage, 2026)

## État de vérification — 21 novembre 2026

**Vérifié à la source** (Légifrance, service-public / entreprendre.gouv.fr) :

- **TVA — seuils de franchise en base applicables en 2026** : **85 000 € / 93 500 €** (ventes de
  biens) et **37 500 € / 41 250 €** (prestations de services). Sources : art. **293 B du CGI** et
  fiche service-public/entreprendre **F21746**.
- **Loi n° 2025-1044 du 3 novembre 2025** : son **article 1** réécrit l'article 293 B du CGI et
  **abroge le 1° du I de l'article 32 de la loi n° 2025-127 du 14 février 2025** (donc le seuil
  unique à 25 000 €). Légifrance, JORF et article :
  `https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000052485808` et
  `https://www.legifrance.gouv.fr/jorf/article_jo/JORFARTI000052485809`.
- **LCEN — articles 1-1 et 1-2** : créés par l'**article 48** de la loi n° 2024-449 du 21 mai
  2024 (SREN), en vigueur depuis le **23 mai 2024** ; versions en vigueur au 21 novembre 2026
  consultées sur Légifrance.
- **Rétractation en ligne — directive (UE) 2023/2673 du 22 novembre 2023** : date d'application
  du **19 juin 2026**.

**Non vérifié à la source — à confirmer avant toute publication :**

- l'existence de l'**ordonnance n° 2026-2** et du **décret n° 2026-3 du 5 janvier 2026**, leur
  siège (L. 221-21 al. 3-4, D. 221-5) et la sanction 15 000 € / 75 000 € ;
- la **portée générale** du bouton de rétractation à tout le e-commerce B2C ;
- l'**abrogation différée de l'art. 293 B au 1er janvier 2027** (réforme du régime en cours) ;
- le **décret n° 2026-60** (JONUM) ;
- les **numéros de texte du PLF 2026 / 2027**.

> **Note de cadrage, pas un avis juridique.** Recherche documentaire vérifiée le **21 novembre
> 2026** sur sources publiques (Légifrance, CNIL, DGCCRF / economie.gouv.fr, service-public,
> Wikimedia, cabinets). Les points marqués **⚠ à confirmer** sont soit évolutifs, soit
> dépendants d'un choix de structure non encore arrêté. Aucune page n'est rédigée ici : c'est
> un périmètre, pas un livrable.

---

## 0. Le cas soumis

Éditeur : **particulier, sans société**. Le service :

- (a) collecte des comptes (courriel + mot de passe + pseudo) ;
- (b) affiche des contenus Open Data (régions, départements, communes, odonymes) et des
  blasons issus de Wikimedia Commons ;
- (c) **envisage** de vendre 4 packs de monnaie virtuelle (« écus », 4,99 € à 44,99 € TTC) via
  Stripe Checkout.

Modèle de jeu : tickets à gratter **gratuits** à charges régénérées, cartes de lieux français,
marché entre joueurs en écus, **tickets jamais vendus**, **aucune conversion écus → euros**.

### Les trois conclusions qui commandent tout le reste

1. **Le site gratuit est juridiquement tenable en « éditeur non professionnel ».** L'article
   1-1, II, de la LCEN permet de ne publier que l'identité de l'hébergeur, à condition de lui
   avoir communiqué la sienne. C'est le seul régime qui préserve l'anonymat.
2. **Ce régime meurt à la première vente.** La qualification de « non professionnel » se perd
   dès qu'il existe une contrepartie économique, même modeste (doctrine constante, cf. §3 des
   sources). Vendre sans immatriculation n'est pas « une zone grise » : c'est du commerce
   habituel sans statut.
3. **Sans numéro d'identification d'entreprise, aucun encaissement.** Il n'existe pas, chez
   Stripe, de catégorie de compte commerçant pour une personne physique dépourvue de numéro
   d'identification d'entreprise : il faut une forme juridique (entreprise individuelle /
   micro-entrepreneur, société, association) et le numéro correspondant (SIRET à 14 chiffres,
   SIREN à 9, RNA). Le triptyque *particulier sans statut + boutique + Stripe* est donc
   **incohérent** : il faut choisir entre gratuité anonyme et vente immatriculée.

---

## 1. Mentions légales — LCEN

> **Le point qui a changé, et que 90 % des guides en ligne ignorent encore.**
> La **loi n° 2024-449 du 21 mai 2024 (SREN)**, en vigueur depuis le **23 mai 2024**, a, par son
> **article 48**, **créé l'article 1-1** (identification de l'éditeur) et l'**article 1-2**
> (sanction). **L'article 6-III n'existe plus** : l'article 6, dans sa rédaction réécrite, traite
> des **services intermédiaires** (accès, hébergement, plateformes) et son III porte sur
> l'**information des abonnés et le contrôle parental** — il n'a plus aucun rapport avec les
> mentions légales. Toute page qui cite « l'article 6-III de la LCEN » pour l'identification de
> l'éditeur est périmée depuis plus de deux ans. *(Vérifié à la source, loi en vigueur au
> 21/11/2026.)*

### (A) Ce qui est obligatoire même en pure gratuité

**Article 1-1, I, LCEN** — si l'édition est professionnelle :

| Éditeur | Mentions |
| :--- | :--- |
| Personne physique (1°) | **nom, prénoms, domicile, numéro de téléphone** ; **numéro d'immatriculation (SIREN)** si elle est assujettie |
| Personne morale (2°) | dénomination, siège social, téléphone, n° RCS/RNE, capital social |
| Directeur de la publication (3°) | **nom du directeur de la publication** (et le responsable de la rédaction le cas échéant) |
| Hébergeur (4°) | **nom/dénomination, adresse et téléphone de l'hébergeur** |
| Stockage délégué (5°, novation SREN) | le cas échéant, **nom/dénomination et adresse des personnes qui assurent, même à titre gratuit, le stockage de données traitées directement dans le cadre de l'édition du service** |

**Le téléphone est obligatoire, et rien ne le remplace.** Pour une personne physique, ni une
adresse électronique ni un formulaire de contact ne tiennent lieu du **numéro de téléphone** exigé
au 1° du I : c'est une mention à publier, pas un canal de contact facultatif.

**La direction de la publication n'est pas une invention de la LCEN.** Le 3° du I renvoie à
l'**article 93-2 de la loi n° 82-652 du 29 juillet 1982**, qui en fixe le régime (désignation,
qualité, responsabilité). Citer « directeur de la publication » sans ce renvoi laisse croire à une
mention libre.

**Le 5° est la vraie nouveauté de la SREN, et elle est facile à rater.** Il ne vise pas
l'hébergeur du site — celui du 4° — mais les **personnes qui stockent, pour le compte de
l'éditeur, des données traitées dans le cadre de l'édition**. Exemple concret : héberger le site
chez OVH ne dispense pas de mentionner le prestataire tiers chez qui vivent la base de données ou
les sauvegardes, dès lors que ce stockage est fait « dans le cadre de l'édition du service ». La
liste se lit service par service, pas comme une clause de style.

**Article 1-1, II, LCEN — le régime du non-professionnel.** Une personne qui édite **à titre
non professionnel** peut ne tenir à disposition du public que le **nom (ou dénomination) et
l'adresse de l'hébergeur**, sous réserve de lui avoir communiqué l'ensemble des éléments
d'identification personnelle prévus au I. Ces éléments ne peuvent être divulgués que sur
**réquisition de l'autorité judiciaire** ; l'hébergeur est tenu au secret professionnel
(art. 226-13 du code pénal).

Autrement dit : **l'anonymat public est possible, l'anonymat vis-à-vis de l'hébergeur ne l'est
pas.** Il n'existe aucun moyen d'éditer un site français sans qu'une personne identifiée soit
joignable par la justice.

**Cette porte se ferme dès qu'apparaît une contrepartie économique, même modeste** : un prix, un
pack, un don sollicité, une publicité. L'éditeur redevient alors professionnel et retombe dans le
I — c'est le basculement décrit au §0.

⚠ **La notion de « non professionnel » est étroite en jurisprudence.** Le TGI de Caen
(9 avril 2018) retient le « contenu de portée personnelle limitée, à un cercle privé, familial
ou amical » ; un blog politique alimenté 17 à 20 fois par mois a été jugé professionnel. Un jeu
public, avec comptes et marché, n'entre pas dans cette définition — même gratuit, il est
**déjà** difficile à défendre comme non professionnel. Le II protège le blog personnel, pas un
service en ligne ouvert à tous.

### (B) Ce qui s'ajoute dès que tu vends

**Article 19 de la LCEN** (activité de commerce électronique au sens de l'art. 14) — accès
« facile, direct et permanent » à :

1. nom et prénoms (personne physique) ou raison sociale ;
2. **adresse d'établissement**, **adresse électronique** et **coordonnées téléphoniques
   permettant d'entrer effectivement en contact** ;
3. n° d'inscription au RCS/RNE, capital, siège si assujetti ;
4. **n° de TVA intracommunautaire** si assujetti et identifié ;
5. autorité d'autorisation si régime d'autorisation ;
6. règles professionnelles si profession réglementée.

Le même article impose que **tout prix mentionné soit clair et non ambigu**, en précisant si
taxes et frais sont inclus. ⚠ À compter du **1er janvier 2027**, le 4° renverra au **code des
impositions sur les biens et services** (art. L. 215-27) et non plus au CGI : le contenu affiché
ne change pas.

S'ajoutent, pour un site marchand : **coordonnées du médiateur de la consommation** (§4),
**CGV** et informations précontractuelles, **politique de confidentialité** (§5), et depuis le
**19 juin 2026** la **fonctionnalité de rétractation en ligne** (§4).

Compléments d'identification : mention **RCS + ville du greffe** (art. R. 123-237 C. com.) ;
pour un entrepreneur individuel, la mention **« entrepreneur individuel »** ou **« EI »** à côté
du nom (art. R. 526-27 C. com.).

### Sanctions

- **Art. 1-2 LCEN** *(vérifié à la source)* : un an d'emprisonnement et **75 000 €** d'amende
  pour l'éditeur personne physique ou le dirigeant ; **375 000 €** pour une personne morale
  (art. 131-38 C. pén.), outre les peines complémentaires de l'art. 131-39 (interdiction
  d'exercer, dissolution).
- ⚠ Le non-respect de l'**article 19** relève, selon les sources, des amendes administratives
  du code de la consommation (DGCCRF) plus que de l'art. 1-2 : **référence exacte à
  confirmer** avant de la citer dans une page publique.

### Conséquence pratique

Un particulier qui reste **gratuit** publie : *« Site édité à titre non professionnel. Hébergeur :
[nom, adresse, téléphone]. »* — et c'est conforme. Le jour où la boutique ouvre, la page doit
porter **nom, prénom, domicile, téléphone, courriel, SIREN/SIRET, mention EI, directeur de la
publication, hébergeur, médiateur**. Le domicile devient public : c'est le premier argument
concret en faveur d'une **domiciliation** (60 à 300 €/an) ou d'une adresse de mairie.

---

## 2. Statut juridique pour vendre

### (B) La règle

La seule exception à l'immatriculation est la **vente occasionnelle entre particuliers** :
revente de **biens personnels usagés**, ponctuelle, sans intention lucrative. Dès que l'activité
est **habituelle, organisée et à but lucratif**, elle est commerciale et doit être **déclarée et
immatriculée** (art. L. 121-1 C. com. ; art. L. 110-1 C. com. pour les actes de commerce).

Une boutique de packs, avec un catalogue, un prix, un moyen de paiement et une récurrence,
n'a **aucun** des caractères de la vente occasionnelle. Il n'existe **aucun seuil de chiffre
d'affaires** en dessous duquel l'immatriculation serait facultative : le critère est qualitatif.
Vendre sans statut expose à : travail dissimulé (art. L. 8221-3 et L. 8221-5 C. trav.),
redressement URSSAF et fiscal, requalification des encaissements, et impossibilité d'émettre
une facture conforme.

### Les options réalistes

| Option | Ce que ça change | Adéquation |
| :--- | :--- | :--- |
| **Micro-entrepreneur (EI)** via le **guichet unique** (`formalites.entreprises.gouv.fr`, opéré par l'INPI) | Gratuit, immatriculation en ligne, SIRET sous quelques jours, comptabilité allégée | **La bonne porte d'entrée.** Plafonds 2026 : **203 100 €** (vente de marchandises) / **83 600 €** (services) ; cotisations de l'ordre de 21 à 26 % du CA selon la nature (BIC services / BNC) ⚠ *taux à confirmer* ; CFE exonérée l'année de création |
| **EI au régime réel** | Mêmes formalités, comptabilité complète, TVA possiblement due | Inutile au démarrage |
| **EURL / SASU** | Responsabilité limitée, capital, statuts, annonce légale | Surdimensionné, sauf si le marché devient le cœur du produit |
| **Association loi 1901** | Personne morale à **but non lucratif** ; possible SIRET ; activité commerciale **accessoire** admise si la gestion reste désintéressée et qu'aucun bénéfice n'est distribué | **Mauvais outil ici.** Vendre des packs pour financer le jeu est exactement ce que l'administration fiscalise (impôts commerciaux, TVA, concurrence déloyale). Une asso qui vend régulièrement des packs à des consommateurs perd sa « gestion désintéressée » |

Code d'activité indicatif : **58.21Z** (édition de jeux électroniques), **62.01Z** (programmation),
**47.91B** (vente à distance sur catalogue). Un micro-entrepreneur peut exercer plusieurs
activités (activité mixte).

### (B) Ce que Stripe exige précisément

Vérifié dans la documentation Stripe France (2026) :

- **Une forme juridique et son numéro.** Il n'existe pas de catégorie de compte commerçant pour
  une personne physique dépourvue de numéro d'identification d'entreprise. Stripe demande une
  forme juridique — entreprise individuelle ou micro-entrepreneur, société, association — et le
  numéro correspondant : **SIRET à 14 chiffres**, **SIREN à 9** ou **RNA**. Le numéro est vérifié
  via les bases publiques ; sans lui, l'activation reste bloquée en mode test.
- **KYC / KYB.** Pièce d'identité, **date de naissance**, adresse, **preuve d'adresse
  professionnelle** (bail, facture d'énergie, avis d'imposition), **IBAN au nom de l'entité**,
  **URL du site décrivant les biens vendus**, documents d'enregistrement ; pour une société,
  Kbis. Stripe est soumis à la LCB-FT (art. L. 561-1 et s. du code monétaire et financier).
- **Adresse professionnelle vérifiée.** Une simple boîte postale ne passe pas ; une domiciliation
  passe si le courrier y est réellement traité.
- **Aucun compte commerçant pour un particulier non immatriculé.** Stripe propose des comptes
  Standard/Express pour des **entités** ; le compte personnel n'existe pas comme voie
  d'encaissement B2C.
- **Stripe Connect n'est pas un contournement.** Les comptes « recipient » servent à faire
  **sortir de l'argent** vers des tiers (vendeurs, prestataires, ayants droit), jamais à encaisser
  pour son propre compte. Ouvrir un compte Connect pour y recevoir ses propres ventes ne résout
  donc pas l'absence d'immatriculation.
- **Politique d'usage acceptable** : jeux d'argent et crypto sont restreints, la monnaie
  virtuelle non convertible est en revanche un cas courant (jeux, apps) — mais la catégorie est
  scrutée, et un descriptif produit honnête (« packs de monnaie virtuelle, non remboursables,
  sans valeur monétaire ») évite une suspension.

**Conséquence :** la boutique impose la micro-entreprise. Le choix n'est donc pas « quel
prestataire », mais « quel statut » — il n'y a pas de contournement par le compte.

---

## 3. TVA

### (A/B) Le régime : franchise en base, et les seuils réellement en vigueur en 2026

La franchise en base (art. **293 B du CGI**) dispense de facturer et de déclarer la TVA sous
deux conditions : CA de l'année précédente sous le **seuil de base**, et CA de l'année en cours
sous le **seuil majoré**.

| Activité | Seuil de base (N-1) | Seuil majoré (N) |
| :--- | ---: | ---: |
| Ventes de biens, à consommer sur place, hébergement | **85 000 €** | **93 500 €** |
| **Prestations de services** (dont contenus numériques) | **37 500 €** | **41 250 €** |
| Avocats / auteurs, activité principale | 50 000 € | 55 000 € |

**Le feuilleton du seuil unique à 25 000 € est terminé, et il faut le dire avec les mots du
texte (vérifié à la source) :**

1. La **loi n° 2025-127 du 14 février 2025** (loi de finances pour 2025) a voté, à son
   **article 32, I, 1°**, un seuil unique de **25 000 €**, dont l'application était prévue au
   **1er mars 2025**.
2. Ce dispositif a été **suspendu avant son entrée en vigueur** : le seuil n'a donc jamais
   produit d'effet. Parler d'« abrogation rétroactive » est inexact — il n'y a pas eu d'effet à
   annuler.
3. La **loi n° 2025-1044 du 3 novembre 2025** a réglé la suite par son **article 1** : son
   **II, 1° abroge le 1° du I de l'article 32 de la loi n° 2025-127**, et son **III, A** fait
   courir l'application de son **I** — la réécriture de l'article 293 B du CGI — **à compter du
   1er mars 2025**. Sources : JORF `JORFTEXT000052485808` et article `JORFARTI000052485809`.
4. Le **projet de loi de finances pour 2026** a retenté un seuil unique de 37 500 € (25 000 €
   pour les travaux immobiliers) : l'article a été **supprimé** par l'Assemblée (20 novembre
   2025) puis rejeté par le Sénat (nuit du 1er au 2 décembre 2025). La loi de finances pour 2026
   **ne modifie aucun seuil**. *(Numéros de texte du PLF 2026 : non vérifié à la source.)*
5. Le **projet de loi de finances pour 2027** (déposé le 1er octobre 2026, texte n° 3210) ne
   contient **aucune** disposition sur la franchise en base. *(Numéro de texte du PLF 2027 : non
   vérifié à la source.)*

**Donc, en 2026 : 85 000 € / 93 500 € (ventes de biens) et 37 500 € / 41 250 € (prestations de
services). Le seuil unique à 25 000 € n'a jamais produit d'effet.** Les pages qui l'annoncent
encore sont périmées. ⚠ Depuis le 1er janvier 2025, on ne peut plus dépasser le seuil de base
deux années consécutives : un dépassement rend redevable au 1er janvier suivant.

⚠ **À surveiller, non vérifié à la source.** La version de l'article 293 B en vigueur porterait
une **abrogation différée au 1er janvier 2027**, la matière passant alors dans le **code des
impositions sur les biens et services** (CIBS). Ce point n'a pas été confirmé au texte : il
conditionne pourtant le libellé des mentions 2027 et ne doit donc pas être affirmé en l'état.

### La mention obligatoire

Tant que la franchise s'applique : **« TVA non applicable, art. 293 B du CGI »** sur chaque
facture (art. 293 E CGI). ⚠ Une mention de transition vers le CIBS serait prévue à partir de
2027 — *non vérifié à la source*.

### (B) Le piège des contenus numériques vendus à des consommateurs

Le lieu de taxation des services fournis par voie électronique à un non-assujetti est celui du
**client** (art. **259 D du CGI** ; art. 58 de la directive 2006/112/CE). Un régime de
simplification existe : tant que le total annuel des ventes B2C transfrontalières (services
électroniques + ventes à distance de biens) vers **l'ensemble des autres États membres** reste
sous **10 000 € HT**, la TVA du pays d'établissement s'applique. Au-delà, c'est la TVA du pays
du client, déclarée via le **guichet unique OSS** (déclaration trimestrielle, `impots.gouv.fr`).

**Ce que cela implique pour un micro-entrepreneur en franchise :**

- ventes **en France** : franchise, aucune TVA, mention 293 B ;
- ventes **vers un autre État membre** sous 10 000 € : reste en franchise, aucune TVA ;
- ventes **au-delà de 10 000 €** : la franchise française **ne couvre plus** ces opérations. Il
  faut facturer la TVA du pays du client et s'inscrire à l'OSS.
- ⚠ Depuis 2025, la **franchise en base « européenne »** (art. 293 B bis et 293 B ter CGI)
  permet, sous conditions (CA UE ≤ 100 000 €, notification préalable, pas d'inscription OSS
  non-UE/IOSS), d'appliquer la franchise dans un autre État membre. **Articulation exacte avec
  l'OSS : à faire trancher par un expert-comptable**, c'est le point le plus technique du
  dossier.

⚠ **Facturation électronique** : réception obligatoire pour toutes les entreprises dès
**septembre 2026**, émission et e-reporting pour les PME/TPE au **1er septembre 2027**. Les
ventes B2C ne relèvent pas de la facturation électronique mais de l'**e-reporting** : à
surveiller, pas à implémenter aujourd'hui.

---

## 4. CGV et droit de la consommation

### (B) Informations précontractuelles — art. L. 221-5

⚠ **Texte modifié, selon la transposition alléguée, par l'ordonnance n° 2026-2 du 5 janvier
2026, en vigueur depuis le 19 juin 2026** *(existence de l'ordonnance non vérifiée à la source)*.
La liste s'est allongée selon cette version. Doivent être fournis « de manière lisible et
compréhensible », avant la conclusion :

1. caractéristiques essentielles du bien / service / **contenu numérique** ;
2. prix (art. L. 112-1 à L. 112-4) ;
3. date ou délai de fourniture ;
4. identité, coordonnées postales, **téléphoniques et électroniques**, modalités de résiliation,
   modes de règlement des litiges, autres conditions ;
5. **garanties légales**, et pour un contenu numérique : **fonctionnalités, compatibilité,
   interopérabilité**, restrictions d'installation ;
6. **possibilité de recourir à un médiateur de la consommation** ;
7. conditions, délai et modalités du droit de rétractation + **formulaire type** + existence et
   emplacement de la **fonctionnalité de rétractation** (L. 221-21) ;
8. (10°) **lorsque le droit de rétractation ne peut être exercé**, l'information selon laquelle
   le consommateur n'en bénéficie pas, ou les circonstances dans lesquelles il le perd ;
9. (11°) l'application d'un prix personnalisé sur décision automatisée, le cas échéant.

Détail des mentions : art. **R. 221-1 et R. 221-2** C. conso. (adresse géographique — une boîte
postale ne suffit pas —, adresse de réclamation si différente, etc.).

### Forme et acceptation

- Les **CGV ne sont pas, en elles-mêmes, obligatoires en B2C** (elles le sont en B2B, art.
  L. 441-1 C. com.). Mais les informations de L. 221-5 doivent être **fournies avant la
  commande** et **confirmées sur support durable** (art. L. 221-13) : la CGV est le véhicule
  normal de cette confirmation.
- **Bouton de commande** : le consommateur n'est engagé que si le bouton porte une mention
  claire, du type **« commande avec obligation de paiement »** (art. **L. 221-14**, al. 2).
  Un bouton « Continuer » ou « Payer » ambigu fragilise l'engagement.
- **Preuve de l'acceptation** : archiver la version des CGV acceptée, horodatée, par commande.

### Rétractation de 14 jours et sa renonciation

- Principe : **14 jours** (art. **L. 221-18**).
- **Exception 13° de l'art. L. 221-28** : *fourniture d'un contenu numérique sans support
  matériel dont l'exécution a commencé avant la fin du délai*, lorsque **cumulativement** :
  a) le consommateur a donné son **consentement exprès** à l'exécution immédiate ;
  b) il a **reconnu perdre son droit de rétractation** ;
  c) le professionnel a **confirmé cet accord** (art. L. 221-13, al. 2).

  Pour un pack d'écus crédité immédiatement : la voie est praticable, mais les trois conditions
  sont **cumulatives et à la charge du professionnel**. En pratique : case à cocher **distincte**
  (jamais pré-cochée), libellé explicite (« Je demande la livraison immédiate de mes écus et
  reconnais perdre mon droit de rétractation »), courriel de confirmation reprenant
  l'acceptation, horodatage conservé.

  ⚠ Qualification du pack : « **contenu numérique** » (13°) ou « **service numérique** » (1° :
  service pleinement exécuté) ? Les deux lectures existent ; le 13° est la plus protectrice et
  la plus lisible. À trancher et à écrire dans les CGV.

### ⚠ La nouveauté de 2026 : la fonctionnalité de rétractation en ligne

**Date confirmée à la source** : la directive **(UE) 2023/2673 du 22 novembre 2023** impose une
fonction de rétractation en ligne, applicable **à partir du 19 juin 2026**. *(Directive vérifiée ;
sa transposition française, non.)*

**Transposition alléguée — non vérifiée à la source.** **Art. L. 221-21, al. 3 et 4, C. conso.**
(ordonnance n° **2026-2 du 5 janvier 2026**, art. 3 ; décret n° **2026-3 du 5 janvier 2026** ;
art. **D. 221-5**), en vigueur le **19 juin 2026** :

> « Pour les contrats conclus à distance au moyen d'une interface en ligne, le professionnel met
> à la disposition du consommateur, sans frais pour ce dernier, une fonctionnalité lui permettant
> d'exercer gratuitement son droit de rétractation avant l'expiration du délai. »

Exigences du décret :

- bouton identifié par **« renoncer au contrat ici »** ou formule analogue non ambiguë ;
- **visible** et **directement et facilement accessible**, disponible **pendant tout le délai** ;
- formulaire en ligne permettant de saisir nom, prénom, identification du contrat, moyen de
  réception de l'accusé ;
- bouton de confirmation **« confirmer la rétractation »** ;
- **accusé de réception** sur support durable, mentionnant le contenu de la déclaration, **la
  date et l'heure** d'envoi.

⚠ **Incertitude assumée, à écrire plus fort qu'avant.** La directive (UE) **2023/2673** est
intitulée « **services financiers à distance** » : c'est son objet littéral. Le législateur
français aurait inséré l'obligation dans le **régime général** des contrats à distance
(L. 221-21), et la lecture extensive — extension à **tout le commerce électronique B2C**, sans
seuil de taille — est celle des praticiens cités (Haas Avocats, CCI Hauts-de-France, Village de
la Justice). **Cette portée générale ne doit pas être présentée comme acquise** : elle est
discutée, et l'existence même de l'ordonnance n° 2026-2 et du décret n° 2026-3 n'a pas été
vérifiée au texte. À confirmer par la doctrine administrative ou une réponse ministérielle ; en
attendant, la prudence commande de l'implémenter.

Sanction **alléguée, non vérifiée à la source** : **amende administrative de 15 000 €** (personne
physique) / **75 000 €** (personne morale), outre la prolongation du délai de rétractation.

> **Articulation avec la renonciation du 13°.** Si le droit de rétractation n'existe pas
> (contenu numérique fourni immédiatement avec renonciation valable), la fonctionnalité n'a pas
> d'objet — mais l'information « vous ne disposez pas du droit de rétractation » reste
> **obligatoire** (L. 221-5, 10°). Position recommandée : afficher malgré tout un point d'entrée
> « Gérer ma rétractation » qui explique le régime applicable et permet, le cas échéant, de
> renoncer. C'est peu coûteux et supprime le débat.

**Conclusion pratique, pour Hexamap.** Un pack d'écus est un contenu numérique fourni
immédiatement, avec renoncement exprès : le droit de rétractation est alors écarté (13° de
l'art. L. 221-28), donc cette obligation est **sans effet pratique** sur la boutique d'écus — un
point d'entrée explicatif suffit à couvrir le débat. Elle redeviendrait contraignante si un jour
un **bien** ou un **service non numérique** (prestation, objet physique, abonnement portant sur
autre chose qu'un contenu fourni immédiatement) était vendu : à réexaminer à ce moment-là, pas
avant.

### Médiateur de la consommation

- **Art. L. 612-1** : tout professionnel garantit au consommateur le **recours effectif** à un
  médiateur, gratuitement.
- **Art. L. 616-1 et R. 616-1** : coordonnées du médiateur communiquées **de manière visible et
  lisible** sur le **site internet**, dans les **CGV** et sur les documents contractuels, avec
  l'adresse de son site.
- Le médiateur doit être **inscrit sur la liste CECMC** (art. L. 615-1). L'adhésion est
  **payante** — quelques dizaines à quelques centaines d'euros par an selon le médiateur ⚠ *à
  chiffrer* : c'est un coût fixe réel pour un micro-éditeur, à intégrer au budget.
- Sanction : amende administrative (**3 000 €** personne physique / **15 000 €** personne
  morale selon les sources consultées ; ⚠ *référence exacte — L. 641-1 ou L. 156-3 C. conso. — à
  vérifier*).

### Garanties légales

- **Conformité** : art. **L. 217-3 et suivants** (biens) ; pour les **contenus et services
  numériques**, art. **L. 224-25-1 et suivants** (transposition de la directive (UE) 2019/770
  par l'ordonnance n° 2021-1247). ⚠ Durée et point de départ **à vérifier selon la qualification
  retenue** (contenu vs service numérique, fourniture continue vs ponctuelle).
- **Vices cachés** : art. 1641 et suivants du code civil.
- Mention des garanties légales obligatoire dans les informations précontractuelles
  (L. 221-5, 5°), et **garantie commerciale** éventuelle clairement distinguée.
- **Prix TTC** obligatoire (art. L. 112-1) ; prix de référence pour toute promotion
  (L. 112-1-1) ; **pas de compte à rebours fictif** — le compte à rebours de régénération des
  charges est réel, donc licite, mais toute « offre limitée » doit l'être vraiment.

---

## 5. RGPD et CNIL

### (A) Ce qui s'applique même en pure gratuité

Ouvrir des comptes suffit à déclencher le RGPD, quel que soit le statut de l'éditeur et
l'absence de monétisation. **Aucune formalité préalable** n'existe (la déclaration CNIL a
disparu avec le RGPD) : tout est documentaire.

| Obligation | Référence | Application ici |
| :--- | :--- | :--- |
| **Bases légales** | art. 6 RGPD | exécution du contrat (compte, parties, achats) ; obligation légale (comptabilité) ; intérêt légitime (sécurité, anti-triche, anti-fraude) ; **consentement** pour les traceurs non essentiels et le marketing |
| **Information** | art. **13** (et 12 : clair et simple) | politique de confidentialité accessible depuis chaque formulaire et le pied de page : identité, finalités, bases, destinataires, transferts, durées, droits, réclamation CNIL |
| **Registre des traitements** | art. **30** | **obligatoire**. ⚠ L'exemption « moins de 250 salariés » (art. 30.5) ne joue pas : les traitements ne sont pas occasionnels et présentent un risque (comptes, paiements). Modèle ODS de la CNIL |
| **Durées de conservation** | art. 5.1.e | compte : durée d'activité + **3 ans** après la dernière connexion (référence CNIL prospection/comptes) ; **factures : 10 ans** (art. L. 123-22 C. com.) ; **logs de connexion : 1 an** (décret n° 2011-219) ; consentement aux traceurs : **13 mois** max, preuve conservée 13 mois |
| **Droits** | art. 15 à 22 | accès, rectification, effacement, limitation, opposition, portabilité, retrait du consentement ; **réponse sous 1 mois**, gratuité |
| **Sous-traitants** | art. **28** | **contrat de sous-traitance** obligatoire pour l'**hébergeur**, **Stripe**, tout service de courriel transactionnel ; registre des sous-traitants |
| **Sécurité** | art. **32** | chiffrement en transit (TLS), hachage des mots de passe (Better Auth), moindre privilège, sauvegardes |
| **Violation de données** | art. **33** / **34** | **notification CNIL sous 72 h** si risque ; information des personnes si risque élevé ; **registre des violations** (art. 33.5) |

**DPO / DPD : non obligatoire ici.** L'art. 37 ne l'impose que pour un traitement à grande
échelle, un suivi régulier et systématique à grande échelle, ou des données sensibles. Un jeu de
cartes géographiques n'entre dans aucun de ces cas. Désigner un « référent protection des
données » informel est possible et suffit.

**AIPD (art. 35) : a priori non requise** — pas de profilage à grande échelle, pas de données
sensibles. **À réévaluer** si un analytics comportemental ou un ciblage publicitaire apparaît.

**Transferts hors UE** : Stripe Payments Europe (Irlande) mais maison mère américaine →
**clauses contractuelles types** et/ou **décision d'adéquation UE–États-Unis** (Data Privacy
Framework, 10 juillet 2023). Si l'hébergement reste sur un VPS européen (Dokploy, OVH, Hetzner),
aucun transfert pour les données de jeu. À documenter dans la politique de confidentialité
(art. 13.1.f et art. 44 et s.).

**Sanctions** : art. **83** RGPD — jusqu'à **20 M€ ou 4 % du CA mondial** (le plus élevé) ;
10 M€ / 2 % pour les manquements « procéduraux ». La CNIL proportionne à la taille : des
personnes physiques et de très petites structures ont déjà été sanctionnées de quelques milliers
d'euros (manquements aux droits, défaut de sécurité). Aucune immunité pour un particulier.

### (A) Cookies et traceurs — art. 82 de la loi Informatique et Libertés

Régime : **consentement préalable**, sauf traceurs **strictement nécessaires** à la fourniture
d'un service expressément demandé, ou destinés exclusivement à permettre une communication
électronique. Recommandation CNIL du 17 septembre 2020 (délib. 2020-091 et 2020-092), **modifiée
par la délibération n° 2025-131 du 18 décembre 2025** (recommandation consolidée publiée en
janvier 2026).

**Exemptés, sans consentement :**

- traceurs d'**authentification** (cookie de session Better Auth, y compris anti-bruteforce) — y
  compris en « univers logué » : être authentifié **ne dispense pas** du consentement pour les
  autres traceurs ;
- traceurs de **panier / facturation** ;
- traceurs de **personnalisation d'interface** lorsque celle-ci est un élément intrinsèque et
  attendu du service — c'est le cas de la préférence de son (`localStorage`,
  `hexamap.scratch.sound`) : exemptée, mais **à documenter** dans la politique de confidentialité ;
- **mesure d'audience** strictement anonyme, pour le compte exclusif de l'éditeur, sans
  recoupement ni identifiant inter-sites.

**Conséquence pour Hexamap :** s'il n'y a **ni** Google Analytics, **ni** pixel publicitaire,
**ni** bouton social tiers, alors **aucun bandeau de consentement n'est nécessaire**. C'est un
avantage de conception à préserver explicitement : ajouter un seul traceur non essentiel fait
apparaître tout l'appareil (bandeau, refus aussi simple que l'acceptation, preuve, retrait,
13 mois).

### (A) Âge de consentement numérique

**Art. 45 de la loi n° 78-17** : un mineur peut consentir **seul** à un traitement de données
dans le cadre de l'**offre directe de services de la société de l'information** à partir de
**15 ans**. En dessous, le traitement n'est licite que si le consentement est donné
**conjointement** par le mineur et le(s) titulaire(s) de l'autorité parentale. Les informations
doivent être rédigées « en des termes clairs et simples, aisément compréhensibles par le
mineur ».

CNIL, recommandation n° 4 (9 juin 2021) : le consentement **d'un seul** parent suffit (acte
usuel), l'autre devant pouvoir s'y opposer.

⚠ **L'art. 45 ne règle pas la capacité contractuelle** (§6) : il ne dit rien de la validité d'un
achat. C'est une confusion fréquente.

---

## 6. Mineurs et achats intégrés

### (A) Ce qui s'applique

- **Capacité** : le mineur non émancipé est **incapable de contracter** (art. **1123** et
  **1124** du code civil, rédaction issue de l'ordonnance n° 2016-131) ; ses actes sont frappés
  d'une **nullité relative**, qui peut être demandée par lui ou son représentant légal. Les actes
  de la vie courante accomplis seuls sont admis par la jurisprudence. ⚠ *Numérotation précise
  des articles sur la nullité (1145 et s. dans la rédaction 2016) à vérifier avant citation.*
- **CNIL, recommandation n° 1** : les mineurs peuvent être considérés, « en fonction de leur
  niveau de maturité et en tout état de cause à partir de 15 ans », comme capables de conclure
  des contrats portant sur le traitement de leurs données dans un service en ligne — **à quatre
  conditions** : service adapté aux mineurs, minimisation, information claire et adaptée,
  **voie de recours parentale pour demander la suppression du compte**. Ce n'est explicitement
  « ni un laissez-passer général, ni un blanc-seing ».

### (B) Ce qui s'ajoute avec les achats

- Un achat effectué par un mineur est **annulable** ; le remboursement peut être exigé, et la
  monnaie déjà dépensée ne se récupère pas. La **charge de la preuve** de l'âge pèse sur
  l'éditeur s'il prétend l'avoir vérifié.
- Le **représentant légal** exerce les droits du mineur, y compris la rétractation.
- **Pratiques commerciales** : l'incitation à la dépense chez les mineurs est un axe de contrôle
  de la DGCCRF et du réseau CPC. Le 30 septembre 2026, le réseau CPC a lancé une action
  coordonnée sur les **loot boxes** ; le Parlement européen a demandé en novembre 2025
  l'interdiction des coffres payants pour les mineurs dans le futur **Digital Fairness Act**
  (annoncé pour le 4e trimestre 2026). Rien de contraignant aujourd'hui, mais la direction est
  claire.
- **Dark patterns** : l'art. **25 DSA** interdit les interfaces qui altèrent l'autonomie de
  décision, **quelle que soit la taille** du fournisseur. Un compte à rebours honnête est licite ;
  une pression artificielle sur un public jeune ne l'est pas.
- **PEGI** : depuis octobre 2026, les jeux qui vendent des objets aléatoires payants sont
  reclassés **PEGI 16** avec la mention « Paid random items ». Hexamap ne vend pas d'objet
  aléatoire : le reclassement ne le vise pas. La classification PEGI/IARC n'est pas une
  obligation légale française pour un jeu web, mais elle devient un repère de marché.

### Recommandations de cadrage

1. **Âge minimum 15 ans** pour créer un compte (aligné sur l'art. 45), **18 ans** pour acheter —
   ou 15 ans avec **autorisation parentale déclarative** et plafond de dépense.
2. Case de déclaration d'âge, **non pré-cochée**, horodatée ; pas de vérification d'identité
   (disproportionnée), mais une procédure de **remboursement sur réclamation parentale** écrite
   dans les CGV.
3. Information du mineur en termes simples (obligation de l'art. 45, al. 3).
4. Pas de relance marketing, pas de « dernière chance », pas de rareté artificielle.
5. Si un contrôle parental existe un jour (SREN, majorité numérique), il ne vise pas ce type de
   service — **ne pas l'inventer**.

---

## 7. Jeu d'argent, coffre à butin, ANJ

### (C) Pourquoi Hexamap sort a priori du champ

**Article L. 320-1 du code de la sécurité intérieure** : les jeux d'argent et de hasard sont
**interdits**, sauf dérogation légale (art. L. 320-6). La qualification retient **quatre
éléments cumulatifs** :

1. **offre au public** (largement entendue : sur inscription ou abonnement suffit) ;
2. **sacrifice financier** du participant (une avance, même remboursable, suffit) ;
3. **espérance d'un gain** (appréciée en valeur patrimoniale) ;
4. intervention du **hasard**, même partielle (l'habileté n'exclut pas la qualification).

Sanctions : **art. L. 324-1 CSI** — trois ans d'emprisonnement et **90 000 €** d'amende, portés à
sept ans et **200 000 €** en bande organisée. L'ANJ peut faire **bloquer** un site accessible
depuis la France.

**Application au modèle Hexamap :**

| Critère | Statut | Pourquoi |
| :--- | :--- | :--- |
| Offre au public | **Rempli** | service ouvert, gratuit ou non |
| Sacrifice financier | **Non rempli** pour le ticket | la charge est **gratuite** et se régénère dans le temps ; aucune contrepartie pour gratter |
| Espérance de gain | **Non rempli** | les cartes n'ont **aucune valeur monétaire extractible** : pas de conversion écus → euros, pas de rachat par l'éditeur, pas de retrait, pas de NFT, pas de transfert hors du jeu |
| Hasard | **Rempli** | tirage serveur |
| **Qualification** | **Hors champ a priori** | il manque deux éléments sur quatre |

### Pourquoi vendre le ticket ferait basculer

Un ticket payant réunirait le **sacrifice financier** (le prix), le **hasard** (le tirage) et
l'**espérance de gain** dès lors que le contenu est valorisable — et il l'est, puisque les cartes
s'échangent contre des écus sur le marché, et que les écus **s'achètent en euros**. La boucle
« euros → écus → cartes → écus » n'est pas fermée : elle est monétisable à l'entrée. C'est
exactement le raisonnement qui vise les **coffres à butin payants** et les boosters numériques
dont le contenu se revend.

**Position de l'ARJEL devenue ANJ** (rapport d'activité 2017-2018) : une loot box payante
n'entre **pas** en principe dans les jeux d'argent **tant que son contenu n'a pas de valeur
monétaire** ; la question change dès que l'éditeur permet de le transférer ou de le revendre hors
du jeu. **Aucune décision de justice française n'a tranché** à ce jour : c'est une position
d'autorité, pas une jurisprudence.

### Le point de vigilance réel du modèle actuel

Le risque ne vient pas du ticket, il vient du **marché**. Trois garde-fous à tenir et à écrire :

1. **Aucune conversion inverse** : les écus ne sortent jamais du jeu, aucun rachat, aucun bon
   d'achat, aucun virement, aucune crypto.
2. **Aucun transfert de valeur hors du service** : pas de NFT, pas de portefeuille externe, pas
   de don entre comptes.
3. **Aucune vente d'objet aléatoire** : les packs vendent des **écus d'un montant connu à
   l'avance**. C'est ce qui distingue un pack d'écus d'un coffre à butin, et c'est le choix
   structurant du produit — il doit être **documenté comme tel**, pas seulement respecté.

### (C) Ce qui n'est pas applicable

- **Régime JONUM** (« jeux à objets numériques monétisables ») : créé par l'**article 40 de la
  loi n° 2024-449 du 21 mai 2024**, expérimentation de **trois ans** (jusqu'en mai 2027),
  réservée aux **majeurs**, **sans gain monétaire**, **sans revente à l'éditeur**, après
  **déclaration à l'ANJ** ; les catégories de jeux seraient fixées par le **décret n° 2026-60 du
  4 février 2026** *(décret non vérifié à la source)*. Hexamap n'émet pas d'objets numériques
  revendables : **hors JONUM**, et il n'a donc **rien à déclarer**.
- **Loterie publicitaire** (vente à prime) : hors sujet tant qu'aucun tirage n'est associé à un
  achat.
- **Agrément ANJ** : aucun.

⚠ **Évolution à surveiller** : Digital Fairness Act (T4 2026), reclassement PEGI 16 des objets
aléatoires payants (octobre 2026), action CPC du 30 septembre 2026. Un durcissement européen sur
les « mécaniques addictives » pourrait toucher le rythme de régénération des charges s'il était
présenté comme une incitation à acheter. La conception actuelle (pas de pression, pas de
publicité, pas de vente de charges) est le meilleur argument.

---

## 8. Accessibilité numérique

### (C) European Accessibility Act : non applicable, et doublement

- **Texte** : directive (UE) **2019/882** du 17 avril 2019, applicable depuis le **28 juin 2025**.
  Transposition française : **art. 16 de la loi n° 2023-171 du 9 mars 2023** (qui crée l'**art.
  L. 412-13 du code de la consommation**), **décret n° 2023-931 du 9 octobre 2023** (liste des
  produits en D. 412-49, des services en **D. 412-50**), **arrêté du 9 octobre 2023**. Norme de
  référence : **EN 301 549** (le RGAA n'est **pas** la norme de l'EAA).
- **Le commerce électronique est un service visé** : un site qui permet à des particuliers de
  conclure un contrat en ligne entre dans le champ.
- **Exemption micro-entreprise de services** : **moins de 10 personnes** employées **et** CA
  annuel **ou** total de bilan **≤ 2 M€** → **aucune obligation**, sans justification à fournir.
  Le critère est cumulatif.
- **Un particulier sans société n'est pas un « opérateur économique »** au sens de la
  recommandation 2003/361/CE : il est hors champ par construction. Devenu micro-entrepreneur
  seul, sans salarié et sous 2 M€, il reste **exempté**.
- La DGCCRF a ouvert une **démarche en ligne d'invocation d'exemption** (Démarches simplifiées,
  « Déclaration de non-conformité ou invocation d'une exemption aux obligations d'accessibilité
  numérique », depuis novembre 2025). ⚠ Son caractère obligatoire pour un micro-éditeur n'est pas
  net : **à vérifier** avant de s'en dispenser.

### (C) RGAA : non obligatoire

Le **RGAA** est opposable au **secteur public** et à certains acteurs privés délégataires
(art. 47 de la loi n° 2005-102 ; décrets n° 2019-768 et 2023-778), ainsi qu'aux entreprises
réalisant un chiffre d'affaires **supérieur à 250 M€**. Hexamap n'entre dans aucun de ces cas :
**aucune obligation de conformité RGAA, aucune déclaration d'accessibilité obligatoire**.

**Mais** : l'accessibilité reste un choix de qualité défendable (contrastes ≥ 4,5:1 déjà tenus
par le design system, navigation clavier, `aria-live`, libellés français). Elle devient
**obligatoire** au franchissement des seuils (10 salariés, ou 2 M€ — puis, pour le RGAA,
250 M€). Le jour où l'activité passe en société avec un salarié, l'exemption tient encore ; le
jour où elle atteint 10 personnes, elle tombe.

---

## 9. DSA, DMA, SREN

### (A) DSA — applicable, mais allégé

**Règlement (UE) 2022/2065**, applicable depuis le **17 février 2024**.

**Qualification.** Un site qui **stocke et diffuse publiquement des contenus fournis par des
destinataires** est un **service d'hébergement** (art. 3(g)), et une **plateforme en ligne**
(art. 3(i)) s'il diffuse ces contenus au public — sauf si la fonction est « mineure et purement
accessoire » au service principal. Le **marché entre joueurs** (annonces visibles par d'autres)
n'est pas accessoire : c'est une salle du produit. **Hexamap est donc une plateforme en ligne**
au sens du DSA.

**Obligations qui s'appliquent quelle que soit la taille** (les « étages 1 et 2 ») :

| Obligation | Référence |
| :--- | :--- |
| **Point de contact** unique pour les autorités et les utilisateurs | art. 11 et 12 |
| **CGU claires** : restrictions imposées aux contenus, règles de modération, langage clair | art. **14** |
| **Mécanisme de notification et d'action** : signalement électronique facile, motifs, URL exacte, identité du notifiant, bonne foi ; suite donnée et information du notifiant | art. **16** |
| **Exposé des motifs** de toute restriction (retrait, blocage, suspension de compte) | art. **17** |
| **Signalement aux autorités** des indices d'infraction pénale menaçant la vie ou la sécurité | art. 18 |
| **Interdiction des interfaces trompeuses** (dark patterns) | art. **25** |
| Nombre de destinataires sur demande du coordinateur | art. 24.3 |

**Exemptions micro / petite entreprise** (recommandation 2003/361/CE) : **art. 15.2** (rapport
annuel de transparence), **art. 19** (toute la section 3, art. 20 à 28, sauf 24.3), **art. 29**
(art. 30 à 32 pour les places de marché). Seuils : petite entreprise **< 50 personnes et
≤ 10 M€** ; micro-entreprise **< 10 personnes et ≤ 2 M€**. Hexamap est **exempté** de ces
couches.

**La règle des deux exercices.** L'annexe de la recommandation 2003/361/CE (**art. 4**) ne fait
changer de catégorie — micro / petite / moyenne — qu'après **deux exercices consécutifs** : on
n'entre pas dans une catégorie, et l'on n'en sort pas, sur un exercice isolé. En pratique, la
conséquence est asymétrique et mérite d'être anticipée : la **perte** de l'exemption doit être
traitée **dès que le statut bascule** (c'est la catégorie applicable qui commande les
obligations), tandis que le **retour** à l'exemption attend, lui, la stabilisation sur la seconde
année. Seuils rappelés : **micro** = moins de 10 personnes **et** ≤ 2 M€ ; **petite** = moins de
50 personnes **et** ≤ 10 M€ ; le critère financier s'apprécie en chiffre d'affaires **ou** en
total de bilan.

**Nuance importante** : l'**art. 30** (traçabilité des vendeurs professionnels) ne vise que les
places de marché permettant de conclure des contrats avec des **professionnels**. Un marché
**C2C** entre joueurs n'y entre pas, indépendamment de la taille.

**En France** : contrôle tripartite — **Arcom** (coordinateur des services numériques), **CNIL**
(profilage publicitaire), **DGCCRF** (interfaces, places de marché). Sanction maximale :
**6 % du chiffre d'affaires mondial** (art. 52.3) — théorique ici, mais le retrait de
l'exemption de responsabilité pour absence de mécanisme de signalement, lui, est immédiat.

**Conséquence concrète** : un lien « Signaler » sur chaque annonce, une page de règles de
modération, une procédure de retrait documentée, et un point de contact. C'est peu, mais c'est
**obligatoire même gratuitement**, et c'est ce qui conditionne l'exonération de responsabilité
sur les contenus des joueurs.

### (C) DMA — non applicable

Règlement (UE) 2022/1925 : ne vise que les **contrôleurs d'accès désignés** par la Commission
(seuils de l'art. 3 : 7,5 Md€ de CA ou 45 M€… de capitalisation, 45 millions d'utilisateurs
actifs, 10 000 utilisateurs professionnels). **Hors de portée.**

### (C) SREN — marginal

**Loi n° 2024-449 du 21 mai 2024** : elle a réécrit la LCEN (d'où le déplacement de l'art. 6-III
vers l'art. 1-1, §1), créé le régime **JONUM** (§7), et porte des obligations destinées aux
grandes plateformes et aux fournisseurs de systèmes. La **loi n° 2023-566 du 7 juillet 2023**
(« majorité numérique ») impose aux **réseaux sociaux** de refuser les moins de 15 ans sans
consentement parental : Hexamap n'est pas un réseau social. **Rien à faire de spécifique**, sinon
que le contrôle parental par défaut sur les terminaux (art. 17 SREN) n'a pas d'effet sur un jeu
web.

---

## 10. Attributions Open Data et Wikimedia

### (A) Licence Ouverte 2.0 (Etalab) — obligatoire dès l'affichage

Conditions de la **Licence Ouverte / Open Licence 2.0** :

- **attribuer** la source (nom du producteur, mention de la licence, lien) ;
- **mentionner la date de la dernière mise à jour** des données ;
- **ne pas altérer** le sens, ni dénaturer l'information ;
- **ne pas suggérer** que le producteur cautionne le produit ou l'usage qui en est fait.

Compatible **CC BY 4.0**. Produits concernés ici :

| Source | Licence | Mention attendue |
| :--- | :--- | :--- |
| **geo.api.gouv.fr** | Licence Ouverte 2.0 | « Source : geo.api.gouv.fr — Licence Ouverte 2.0 » |
| **Base Adresse Nationale (BAN)** | Licence Ouverte 2.0 | « Base Adresse Nationale (BAN) — Etalab » + date de mise à jour |
| **INSEE** (population municipale) | Licence Ouverte 2.0 (depuis 2016) | « Source : INSEE » + millésime du recensement |
| **IGN** (Admin Express, contours) | Licence Ouverte 2.0 | « IGN » + millésime |
| **Wikidata** (données) | **CC0** | aucune attribution obligatoire, mais courtoise |

### (A) Wikimedia Commons — le vrai piège

**Commons n'a pas de licence unique.** Chaque fichier porte la sienne, et **seules les licences
libres sont acceptées** (CC BY, CC BY-SA, CC0, domaine public ; **pas** de CC BY-NC ni CC BY-ND).
Un blason est donc, selon le fichier :

- **domaine public** (armoiries anciennes, blasons héraldiques non protégeables en tant qu'idée) ;
- **CC BY 3.0 / 4.0** (attribution seule) ;
- **CC BY-SA 3.0 / 4.0** (attribution **+ partage à l'identique**).

**Obligations CC BY-SA, précisément :**

1. **Attribuer l'auteur** — pas « Wikimedia Commons », qui n'est **pas** ayants droit. Le crédit
   doit nommer le dessinateur (ou le projet), avec **lien vers la licence** et **indication des
   modifications** éventuelles.
2. **Partager à l'identique** : « si vous modifiez, transformez ou adaptez l'œuvre, vous devez
   diffuser l'œuvre modifiée sous la même licence ». **Reproduire** une image (l'afficher,
   la redimensionner, la convertir) n'est **pas** une adaptation : cela **n'oblige pas** à placer
   tout le site en BY-SA. **Adapter** (recadrer, recolorer, recomposer, vectoriser, superposer à
   une autre œuvre) crée une **œuvre dérivée** qui doit être publiée sous BY-SA.
3. **Pas de cautionnement implicite** : ne pas laisser croire que l'auteur ou Wikimedia soutient
   le jeu.

**Ce que cela impose à Hexamap, concrètement :**

- **une ligne de crédit par fichier**, pas une mention générique en pied de page : auteur,
  licence, lien vers la page Commons, indication de modification ;
- **ne pas modifier les SVG** (le design system sépare déjà le blason de la gravure, ce qui est
  la bonne décision) ; un recadrage CSS agressif ou une recoloration via `filter` serait une
  adaptation ;
- **préférer les fichiers en domaine public** quand ils existent, pour supprimer toute
  obligation de partage à l'identique ;
- **conserver la provenance** en base : le champ `blason_credit` existe déjà
  (`.docs/02-database.md` §5) et doit porter **licence · auteur · page source**, pas seulement
  « Wikimedia Commons » ;
- **page « Crédits »** listant, par catégorie, les sources et licences.

**Sanctions** : **art. L. 335-2 du code pénal** — contrefaçon : **trois ans** d'emprisonnement et
**300 000 €** d'amende (personnes physiques). S'y ajoute le **droit moral** (art. L. 121-1 CPI) :
une attribution erronée ou une dénaturation reste attaquable même sous licence libre. En pratique,
le risque est faible et l'exposition réputationnelle immédiate — mais une omission d'attribution
sur un blason CC BY-SA est une contrefaçon caractérisée.

---

## 11. Divers obligatoires

| Sujet | Statut | Détail |
| :--- | :--- | :--- |
| **Déclaration au préfet** | **(C) non** | Depuis la LCEN de 2004, aucune déclaration préalable n'est exigée pour éditer un service de communication au public en ligne. La déclaration CNIL a disparu avec le RGPD (2018). Il ne reste que la **déclaration d'activité** au guichet unique **si** l'on vend (§2) |
| **Déclaration de cryptologie** | **(C) non** | L'**art. 30 de la LCEN** soumet à déclaration/autorisation la **fourniture de prestations de cryptologie**, pas l'usage d'une bibliothèque TLS standard. Un site en HTTPS n'a aucune formalité ANSSI |
| **Nom de domaine** | **(A) oui, indirectement** | Aucun dépôt obligatoire, mais l'identification de l'éditeur et de l'hébergeur est obligatoire ; choisir un registrar UE (données WHOIS/RDAP conformes au RGPD) ; vérifier la disponibilité de la marque « Hexamap » auprès de l'INPI avant d'investir sur le nom |
| **Paiement sécurisé** | **(B) oui** | Pas d'obligation autonome de « sécuriser » au-delà de la **DSP2** (authentification forte du client, art. **L. 133-44** du code monétaire et financier) et de l'**art. 32 RGPD**. En pratique : **Stripe Checkout hébergé** = périmètre **PCI-DSS SAQ A** minimal, aucune donnée de carte sur le serveur, TLS, en-têtes de sécurité |
| **Signalement des contenus** | **(A) oui si UGC** | **Art. 16 DSA** (mécanisme), **art. 17** (exposé des motifs), **art. 6 LCEN** (rédaction SREN) pour le régime français des hébergeurs. Un lien « Signaler » par annonce et une procédure écrite suffisent pour un service de cette taille |
| **Loi « influenceurs »** | **(B) si promotion** | **Loi n° 2023-451 du 9 juin 2023** : mention « Publicité » / « Collaboration commerciale » obligatoire, contrat écrit, interdiction de promouvoir certains produits (dont les jeux d'argent), responsabilité de l'annonceur. Applicable dès qu'un créateur est rémunéré ou avantagé pour parler du jeu |
| **Parrainage entre joueurs** | **(B) vigilance** | Licite si l'identification est claire et si le parrainage **n'exige aucun achat** : une récompense conditionnée à un achat glisse vers la **vente à prime / loterie**, donc vers l'art. L. 320-1 CSI (§7). Récompense en cartes ou en charges, jamais en écus achetés |
| **Assurance RC professionnelle** | **(C) non obligatoire**, fortement recommandée | Couverture éditeur de logiciel / service en ligne ; certaines mutuelles couvrent l'activité numérique pour quelques dizaines d'euros par mois |
| **Comptabilité** | **(B) oui** | Micro-entreprise : livre des recettes, registre des achats, conservation **10 ans** des pièces (art. L. 123-22 C. com.) ; factures conformes (art. L. 441-9 C. com. et art. 242 nonies A ann. II CGI) — le **SIRET** doit y figurer, Stripe ne l'imprime pas nativement |

---

## 12. Tableau de synthèse A / B / C

**(A)** obligatoire même en pure gratuité — **(B)** obligatoire dès que tu vends — **(C)** inexistant / non applicable

| # | Sujet | A — gratuit | B — commercial | C — non applicable |
| :-- | :--- | :--- | :--- | :--- |
| 1 | Mentions légales | identité communiquée à l'hébergeur + nom/adresse/téléphone de l'hébergeur (art. 1-1, II) | mentions complètes + art. 19 (courriel, téléphone, SIREN, TVA) + directeur de la publication + médiateur (art. 1-1, I) | anonymat public (perdu dès la vente) |
| 2 | Statut | — | **immatriculation obligatoire** (micro-entreprise via guichet unique INPI) + SIRET pour Stripe | vente occasionnelle (inapplicable ici) ; association 1901 (inadaptée) |
| 3 | TVA | — | franchise 293 B (37 500 € services / 85 000 € ventes), mention obligatoire ; OSS au-delà de 10 000 € UE | seuil 25 000 € (abrogé) |
| 4 | CGV / conso | — | L. 221-5 (modifié 2026), L. 221-14, rétractation 14 j + renonciation 13°, **fonctionnalité de rétractation en ligne depuis le 19/06/2026**, médiateur (L. 612-1, R. 616-1), garanties L. 217-3 / L. 224-25-1 | — |
| 5 | RGPD / CNIL | information art. 13, registre art. 30, durées, droits, sous-traitants art. 28, violation art. 33/34 ; cookies : aucun bandeau si aucun traceur non essentiel ; **15 ans** (art. 45 LIL) | données de paiement, DPA Stripe, transferts (SCC / DPF) | DPO (art. 37), AIPD (art. 35) |
| 6 | Mineurs | information claire et simple (art. 45 al. 3), consentement parental < 15 ans | capacité (art. 1123-1124 C. civ.), remboursement sur réclamation, pas de dark patterns (art. 25 DSA) | vérification d'identité (disproportionnée) |
| 7 | Jeu d'argent | vigilance : ne jamais introduire de sacrifice financier sur un tirage | idem, plus : pack d'écus **d'un montant connu** (pas de coffre à butin) | **qualification jeu d'argent** (a priori hors champ), **JONUM** (pas d'objet monétisable), agrément ANJ |
| 8 | Accessibilité | — | exemption **< 10 salariés et ≤ 2 M€** ; déclaration d'exemption possible | **EAA** (exempté), **RGAA** (réservé au public et aux > 250 M€) |
| 9 | DSA / DMA / SREN | **socle DSA** : point de contact, CGU (art. 14), signalement (art. 16), exposé des motifs (art. 17), art. 25 | idem | art. 15.2, 19, 29 (exemption micro/petite) ; **DMA** ; **majorité numérique** |
| 10 | Attributions | **Licence Ouverte 2.0** (attribution + date + non-altération) ; **CC BY-SA** des blasons (auteur + lien + partage à l'identique si adaptation) | idem | CC0 (Wikidata) ; mention générique « Wikimedia Commons » (insuffisante) |
| 11 | Divers | signalement si UGC ; nom de domaine / marque | paiement DSP2, factures avec SIRET, RC pro, loi influenceurs si promotion | déclaration préfet ; déclaration de cryptologie |

---

## 13. Incertitudes et points à trancher

À traiter **avant** d'écrire une ligne de page légale, dans cet ordre :

1. **Structure ou gratuité.** La décision « vendre ou non » commande les points 1 à 4. Il n'y a
   pas de solution intermédiaire : pas de boutique sans SIRET, pas de SIRET sans statut.
2. **Domicile publié.** Un éditeur personne physique doit publier son **domicile** (art. 1-1, I,
   a). Domiciliation ou adresse de mairie à arbitrer — c'est un choix de vie, pas de code.
3. **⚠ Portée de la fonctionnalité de rétractation (19 juin 2026).** La directive (UE) 2023/2673
   est intitulée « services financiers à distance » ; le législateur aurait inséré l'obligation
   dans le régime **général** (L. 221-21). Lecture extensive : extension à tout le e-commerce —
   **discutée, non acquise**, et l'existence même de l'ordonnance n° 2026-2 et du décret
   n° 2026-3 n'a pas été vérifiée à la source. Implémenter reste la position prudente.
4. **⚠ Qualification du pack d'écus** : « contenu numérique » (13° de L. 221-28) ou « service
   numérique » (1°) ? Détermine la rédaction de la renonciation et la fonctionnalité de
   rétractation.
5. **⚠ Franchise française vs OSS au-delà de 10 000 € UE.** Le point le plus technique du
   dossier : la franchise ne couvre pas les ventes transfrontalières au-delà du seuil. À faire
   trancher par un expert-comptable, avec la franchise européenne (293 B bis / ter, 2025) en
   toile de fond.
6. **⚠ Médiateur de la consommation** : coût réel, adhésion obligatoire, sanction exacte
   (3 000 € / 15 000 € — référence à vérifier).
7. **⚠ Preuve d'âge** : aucun dispositif proportionné n'existe pour un jeu de cette taille ; la
   voie praticable est déclarative + remboursement sur réclamation. À écrire dans les CGV, pas à
   improviser.
8. **⚠ Numérotation du code civil** sur la nullité des actes du mineur (ordonnance n° 2016-131) :
   à vérifier article par article avant citation publique.
9. **⚠ Calendrier fiscal 2027** : abrogation différée de l'art. 293 B au 1er janvier 2027
   (passage au CIBS — *non vérifié à la source*), bascule de la référence TVA de l'art. 19 LCEN,
   e-invoicing/e-reporting PME au 1er septembre 2027. Rien à coder aujourd'hui, tout à ne pas
   oublier.

---

## Sources vérifiées (21 novembre 2026)

**Textes**
- LCEN, loi n° 2004-575 du 21 juin 2004 : art. **1-1**, **1-2**, **6**, **19**, **30** (Légifrance).
- Loi n° **2024-449 du 21 mai 2024** (SREN) : art. 16, 17, 40, 48.
- Loi n° **2023-171 du 9 mars 2023**, art. 16 ; **décret n° 2023-931 du 9 octobre 2023** ;
  **arrêté du 9 octobre 2023** ; directive (UE) **2019/882**.
- Code de la consommation : **L. 112-1**, **L. 221-5** (mod. ord. **2026-2**), **L. 221-13**,
  **L. 221-14**, **L. 221-18**, **L. 221-21** (mod. ord. 2026-2, **D. 221-5** décr. **2026-3**),
  **L. 221-28** 13°, **L. 224-25-1** et s., **L. 217-3** et s., **L. 612-1**, **L. 615-1**,
  **L. 616-1**, **R. 616-1**, **L. 412-13**, **D. 412-50**.
- Code civil : art. **1123**, **1124** (ord. n° 2016-131) ; art. **1641** et s.
- Code de commerce : **L. 110-1**, **L. 121-1**, **L. 123-22**, **L. 441-1**, **L. 441-9**,
  **R. 123-237**, **R. 526-27**.
- Code de la sécurité intérieure : **L. 320-1**, **L. 320-6**, **L. 324-1**.
- Code monétaire et financier : **L. 133-44**, **L. 561-1** et s.
- Code de la propriété intellectuelle : **L. 121-1**, **L. 335-2**.
- Code du travail : **L. 8221-3**, **L. 8221-5**.
- CGI : **293 B**, **293 B bis**, **293 B ter**, **293 E**, **259 D**, **242 nonies A** ann. II.
- Loi n° **78-17** du 6 janvier 1978 : art. **45** (âge de 15 ans), art. **82** (traceurs).
- RGPD (UE) 2016/679 : art. **6**, **12**, **13**, **28**, **30**, **32**, **33**, **34**, **35**,
  **37**, **44** et s., **83**.
- Règlement (UE) **2022/2065** (DSA) : art. **3**, **11**, **12**, **14**, **15.2**, **16**, **17**,
  **18**, **19**, **24.3**, **25**, **29**, **30**, **52.3**.
- Règlement (UE) **2022/1925** (DMA) : art. 3.
- Loi n° **2025-1044 du 3 novembre 2025**, art. **1** : le II, 1° abroge le 1° du I de l'article
  32 de la loi n° 2025-127 du 14 février 2025 ; le III, A fait courir l'application du I au
  **1er mars 2025**. Légifrance `JORFTEXT000052485808` et `JORFARTI000052485809`.
- Loi n° **2025-127 du 14 février 2025** (loi de finances pour 2025), art. 32, I, 1° (seuil
  unique à 25 000 €).
- PLF 2026 (art. 25 supprimé) et PLF 2027 (texte n° 3210, déposé le 1er octobre 2026) :
  *numéros de texte non vérifiés à la source*.
- Loi n° **82-652 du 29 juillet 1982**, art. **93-2** (direction de la publication, renvoi du
  3° du I de l'article 1-1 LCEN).
- Loi n° **2023-451 du 9 juin 2023** (influenceurs) ; loi n° **2023-566 du 7 juillet 2023**
  (majorité numérique) ; **décret n° 2026-60 du 4 février 2026** (JONUM).

**Autorités et doctrine**
- CNIL : lignes directrices et recommandation « cookies » du 17 septembre 2020 (délib. 2020-091
  et 2020-092), **recommandation consolidée — délibération n° 2025-131 du 18 décembre 2025** ;
  recommandations « mineurs » n° 1 et n° 4 ; fiche « registre des activités de traitement ».
- DGCCRF / economie.gouv.fr : fiches EAA et exemptions (2025), médiation de la consommation,
  délais de rétractation (oct. 2026) ; démarche en ligne d'exemption accessibilité (nov. 2025).
- Service-Public / Entreprendre : franchise en base (**F21746**, seuils 2026 — 85 000 € /
  93 500 € et 37 500 € / 41 250 € — confirmés le 21 novembre 2026), déclaration et paiement de la
  TVA (F23566, 6 novembre 2026), mentions obligatoires d'un site (F37351, 13 octobre 2026).
- impots.gouv.fr : guichet unique OSS, seuil de 10 000 €, franchise en base européenne.
- Stripe : « Informations de l'entreprise nécessaires », « Que dois-je faire pour vérifier mon
  compte », « Numéros SIREN et SIRET » (support.stripe.com, 2026) ; KYC France.
- Wikimedia Commons : `Commons:Reusing content outside Wikimedia`,
  `Commons:Reusing content outside Wikimedia/licenses`, `Commons:Licensing`,
  `Commons:Simple media reuse guide` ; Wikimédia France, « Réutiliser des photos issues de
  Wikipédia ».
- Légifrance : versions en vigueur au 21 novembre 2026 des articles cités.

> **Rappel de méthode** : les seuils chiffrés et les dates ci-dessus sont ceux constatés le
> 21 novembre 2026. Le droit français des seuils a bougé trois fois en quatorze mois ; toute page
> publique doit porter une **date de dernière vérification**.

---

## 14. Décisions retenues pour Hexamap (21 novembre 2026)

Choix arrêtés par le titulaire du produit. Ce ne sont pas des recommandations : ils engagent la
rédaction des pages légales et la configuration du service.

- **Le jeu reste jouable intégralement sans acheter**, et les **packs d'écus restent disponibles à
  l'achat**. Conséquence juridique directe : l'activité est **commerciale**, donc l'éditeur est
  **professionnel** au sens de l'article 1-1, I, de la LCEN. Le régime d'anonymat du II ne
  s'applique pas, y compris pour les parties gratuites du service.
- **Identité publiée** : **nom, prénoms et adresse électronique de contact**.
- **Hébergement** : **VPS OVHcloud**. Le nom de domaine **hexamap.fr** est enregistré chez
  **IONOS**, mais le registrar n'est pas l'hébergeur : c'est **OVH** qui doit être mentionné au
  4° du I.
- **Âge minimum** : **15 ans**.
- **Conservation** : **6 mois après la dernière activité** pour le compte, avec **suppression
  automatique**.

### Points bloquants identifiés

1. **SIREN / SIRET.** Aucune vente encaissable sans immatriculation (micro-entrepreneur, guichet
   unique INPI) ni compte Stripe. C'est le préalable de tout le reste.
2. **Téléphone.** Obligatoire à publier pour un éditeur professionnel personne physique
   (art. 1-1, I, 1°) : un e-mail ne suffit pas.
3. **Domicile.** Également obligatoire (art. 1-1, I, 1°) si l'éditeur est une personne physique
   non immatriculée en société. Deux solutions : publier l'adresse, ou **domicilier** l'activité.

### Points à arbitrer

4. **Mineurs et achat.** Un mineur ne peut pas contracter seul. L'âge minimum de 15 ans doit donc
   être assorti soit d'un **achat réservé aux majeurs** (18 ans), soit d'un **consentement du
   représentant légal** — il faut choisir, les deux ne se cumulent pas par défaut.
5. **Durées de conservation distinctes.** **6 mois** pour le compte de jeu, mais les **pièces
   comptables** liées aux achats (grand-livre, factures) relèvent d'une conservation légale de
   **10 ans** (art. L. 123-22 du code de commerce). La purge automatique ne doit **jamais** les
   supprimer : deux politiques, deux périmètres, dans le même service.

---

Dernière vérification : 21 novembre 2026
