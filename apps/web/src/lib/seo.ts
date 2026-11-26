/**
 * Métadonnées de page — le propriétaire unique des titres, descriptions,
 * canoniques et directives d'indexation (I-005, `.docs/09-idees.md`).
 *
 * **Pourquoi pas `head()` de TanStack Router.** Le routeur ne monte aucun
 * `<HeadContent />` (`apps/web/src/main.tsx` ne rend que `RouterProvider`), donc
 * une option `head` n'aurait aucun effet. En monter un ferait hoister un second
 * `<title>` à côté de celui d'`index.html`, que le brief exige comme repli — et
 * `document.title` lit le premier `<title>` du document, donc le repli
 * l'emporterait. L'application est écrite ici, une fois, contre `document.head` :
 * déterministe, sans dépendre de l'ordre de fusion d'une bibliothèque.
 *
 * Aucune URL absolue n'est écrite en dur : l'origine arrive en paramètre —
 * `window.location.origin` au rendu (`currentOrigin`), et `PUBLIC_ORIGIN` côté
 * API pour `robots.txt` et `sitemap.xml`. Ce module n'importe rien : il est
 * lisible par le banc E2E, qui vérifie la table sans navigateur.
 */

export const SITE_NAME = 'Hexamap';

export const BRAND_TITLE = 'Hexamap — Cabinet de cartographie';

export const BRAND_DESCRIPTION =
  'Hexamap — le cabinet de cartographie. Collectionnez les régions, départements, communes et rues de France.';

const INDEX = 'index, follow';
const NOINDEX = 'noindex, nofollow';

export interface SeoDescriptor {
  title: string;
  description: string;
  /** URL absolue, ou `null` quand la page ne désigne aucune originale. */
  canonical: string | null;
  /** Contenu de `meta[name=robots]`. */
  robots: string;
}

/** L'origine servie, lue au rendu : jamais une constante de build à maintenir. */
export function currentOrigin(): string {
  return typeof window === 'undefined' ? '' : window.location.origin;
}

/**
 * Une page publique : titre, description, canonique absolue et `index, follow`.
 * `path` est le chemin seul (`/rarete`) ; l'origine est concaténée ici, en un
 * seul endroit.
 */
export function publicHead(input: {
  title: string;
  description: string;
  path: string;
  origin: string;
}): SeoDescriptor {
  return {
    title: input.title,
    description: input.description,
    canonical: `${input.origin}${input.path}`,
    robots: INDEX,
  };
}

/**
 * Une page qui ne doit pas être indexée. `canonical` reste possible : la racine
 * du jeu porte `noindex` (c'est une salle derrière session) **et** une canonique
 * unique, les deux ne s'excluant pas.
 */
export function noindexHead(input: {
  title: string;
  description?: string;
  canonical?: string;
}): SeoDescriptor {
  return {
    title: input.title,
    description: input.description ?? BRAND_DESCRIPTION,
    canonical: input.canonical ?? null,
    robots: NOINDEX,
  };
}

interface RouteSeo {
  title: string;
  description: string;
  indexed: boolean;
}

const ROUTE_SEO: Record<string, RouteSeo> = {
  // Publiques : ce sont les pages qui ont un intérêt hors session.
  '/home': {
    title: 'Hexamap — Collectionnez les régions, les communes et les rues de France',
    description:
      'Un ticket à gratter, seize cases, et des lieux réels de France à collectionner : régions, départements, communes et rues. Découvrez les règles d’Hexamap.',
    indexed: true,
  },
  '/rarete': {
    title: 'Les raretés — Hexamap',
    description:
      'Les six paliers de rareté d’Hexamap, leurs poids de tirage, et les formules de score des communes et des rues.',
    indexed: true,
  },
  '/mentions-legales': {
    title: 'Mentions légales — Hexamap',
    description:
      'L’éditeur, l’hébergeur, les sources de données et les attributions du cabinet de cartographie Hexamap.',
    indexed: true,
  },
  '/confidentialite': {
    title: 'Politique de confidentialité — Hexamap',
    description:
      'Ce que le service conserve, pourquoi, combien de temps, et comment exercer ses droits.',
    indexed: true,
  },
  '/login': {
    title: 'Se connecter — Hexamap',
    description: 'Entrez dans le cabinet de cartographie et reprenez votre relevé.',
    indexed: true,
  },
  '/register': {
    title: 'Créer un compte — Hexamap',
    description:
      'Ouvrez votre cabinet de cartographie : un premier ticket, seize cases, et les lieux de France à collectionner.',
    indexed: true,
  },

  // Salles derrière session : aucun intérêt hors session, jamais indexées.
  // Le Relevé est la racine du jeu ; il garde une canonique unique.
  '/': { title: BRAND_TITLE, description: BRAND_DESCRIPTION, indexed: false },
  '/collection': {
    title: 'Le Cadastre — Hexamap',
    description: 'Votre collection de cartes, filtrable par catégorie, rareté et recherche.',
    indexed: false,
  },
  '/tableau': {
    title: 'La Planche — Hexamap',
    description: 'Composez un tableau de quatre cartes et lisez son alignement territorial.',
    indexed: false,
  },
  '/tableaux': {
    title: 'Les Planches — Hexamap',
    description: 'Les tableaux que vous avez soumis.',
    indexed: false,
  },
  '/friends': {
    title: 'Les Amis — Hexamap',
    description: 'Vos demandes d’ami, vos relations acceptées et vos blocages.',
    indexed: false,
  },
  '/guichet': {
    title: 'Le Guichet — Hexamap',
    description: 'Ce qui est arrivé dans votre cabinet.',
    indexed: false,
  },
  '/market': {
    title: 'Le Comptoir — Hexamap',
    description: 'Les annonces ouvertes du marché.',
    indexed: false,
  },
  '/market/mine': {
    title: 'Mes Offres — Hexamap',
    description: 'Vos annonces et vos ventes.',
    indexed: false,
  },
  '/achievements': {
    title: 'Les Médailles — Hexamap',
    description: 'Les médailles obtenues et celles qui restent à décrocher.',
    indexed: false,
  },
  '/atlas': {
    title: 'L’Atlas — Hexamap',
    description: 'Votre collection posée sur la carte de France.',
    indexed: false,
  },
  '/palmares': {
    title: 'Le Palmarès — Hexamap',
    description: 'Les meilleurs tableaux de la semaine.',
    indexed: false,
  },
  '/boutique': {
    title: 'La Boutique — Hexamap',
    description: 'Les packs d’écus.',
    indexed: false,
  },
  '/boutique/succes': {
    title: 'La Boutique — Hexamap',
    description: 'Les packs d’écus.',
    indexed: false,
  },
  '/compte': {
    title: 'Le Compte — Hexamap',
    description: 'Votre pseudo, votre courriel et votre vitrine.',
    indexed: false,
  },
  '/assemblage': {
    title: 'L’Atlas — Hexamap',
    description: 'Votre collection posée sur la carte de France.',
    indexed: false,
  },
};

/** Préfixes : les routes à paramètre n'ont pas de clé exacte. */
const PREFIX_SEO: readonly (readonly [string, RouteSeo])[] = [
  [
    '/card/',
    {
      title: 'Le Cartel — Hexamap',
      description: 'La planche détaillée d’une carte.',
      indexed: false,
    },
  ],
  [
    '/tickets/',
    {
      title: 'Le Relevé — Hexamap',
      description: 'Le bordereau à gratter.',
      indexed: false,
    },
  ],
];

/**
 * Le descripteur d'un chemin. `null` pour `/players/*` : la vitrine nomme le
 * joueur, donc elle est la seule à pouvoir écrire son titre une fois le profil
 * chargé. Un chemin inconnu porte `noindex` — une page introuvable ne
 * s'indexe pas.
 */
export function seoForPath(pathname: string, origin: string): SeoDescriptor | null {
  if (pathname === '/players' || pathname.startsWith('/players/')) {
    return null;
  }

  const exact = ROUTE_SEO[pathname];
  if (exact !== undefined) {
    return exact.indexed
      ? publicHead({
          title: exact.title,
          description: exact.description,
          path: pathname,
          origin,
        })
      : noindexHead({
          title: exact.title,
          description: exact.description,
          // Le Relevé est une salle derrière session, mais la racine du site est
          // une URL unique : sa canonique désigne `${origine}/`, sans quoi deux
          // adresses d'entrée pourraient se disputer l'origine.
          canonical: pathname === '/' ? `${origin}/` : undefined,
        });
  }

  for (const [prefix, entry] of PREFIX_SEO) {
    if (pathname.startsWith(prefix)) {
      return noindexHead({ title: entry.title, description: entry.description });
    }
  }

  return noindexHead({ title: 'Page introuvable — Hexamap' });
}

function upsertMeta(name: string, content: string): void {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (element === null) {
    element = document.createElement('meta');
    element.setAttribute('name', name);
    document.head.append(element);
  }
  element.setAttribute('content', content);
}

function setCanonical(href: string | null): void {
  const existing = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (href === null) {
    existing?.remove();
    return;
  }

  if (existing === null) {
    const link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    link.setAttribute('href', href);
    document.head.append(link);
    return;
  }

  existing.setAttribute('href', href);
}

/**
 * Écrit le descripteur dans `document.head`. Les éléments existants sont
 * réutilisés : `index.html` porte déjà une `meta[name=description]`, qui devient
 * celle de la page au lieu de s'ajouter à elle. Appel idempotent — deux
 * applications du même descripteur laissent un seul jeu de balises.
 */
export function applySeoHead(descriptor: SeoDescriptor): void {
  if (typeof document === 'undefined') {
    return;
  }

  document.title = descriptor.title;
  upsertMeta('description', descriptor.description);
  upsertMeta('robots', descriptor.robots);
  setCanonical(descriptor.canonical);
}
