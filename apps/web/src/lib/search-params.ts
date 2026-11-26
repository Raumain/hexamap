// La sérialisation des paramètres d'URL appartient au routeur, pas à une route.
//
// Le décodeur par défaut de TanStack Router passe chaque valeur par `JSON.parse` :
// `?departement=99` arrive dans `validateSearch` en `number` `99`, et le validateur
// du Cadastre, qui n'accepte que du texte, l'écarte. Ici, toute valeur relue est une
// chaîne, sans exception.

/**
 * Rend une chaîne de requête **avec** son `?`, ou `''` quand elle est vide.
 *
 * Le routeur ne préfixe rien : `buildLocation` concatène tel quel le retour de cette
 * fonction au chemin (`href = pathname + searchStr`). C'est aussi ce que fait le
 * décodeur par défaut de TanStack (`searchStr ? '?' + searchStr : ''`). Rendre
 * `categorie=REGION` sans `?` fabriquait `/collectioncategorie=REGION`, que le routeur
 * relisait comme un chemin inconnu — la salle disparaissait donc à chaque navigation.
 *
 * Le paramètre est `object` et non `Record<string, unknown>` pour accepter aussi les
 * formes de transport déclarées en interface (`CollectionSearchWire`), qui n'ont pas
 * de signature d'index.
 */
export function stringifySearch(search: object): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(search)) {
    if (value === undefined) continue;

    for (const entry of Array.isArray(value) ? value : [value]) {
      if (entry === undefined) continue;
      // La virgule est le séparateur de liste du domaine, pas un caractère réservé :
      // la restaurer garde l'adresse lisible et la forme canonique stable.
      const encodedKey = encodeURIComponent(key).replace(/%2C/gi, ',');
      const encodedValue = encodeURIComponent(String(entry)).replace(/%2C/gi, ',');
      parts.push(`${encodedKey}=${encodedValue}`);
    }
  }

  return parts.length === 0 ? '' : `?${parts.join('&')}`;
}

/**
 * Relit une chaîne de requête, avec ou sans `?` initial. Une clé répétée rend un
 * `string[]`, une occurrence unique rend un `string`.
 */
export function parseSearch(searchStr: string): Record<string, unknown> {
  const search: Record<string, unknown> = {};
  const params = new URLSearchParams(searchStr.replace(/^\?/, ''));

  for (const [key, value] of params) {
    const existing = search[key];
    if (existing === undefined) {
      search[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      search[key] = [existing, value];
    }
  }

  return search;
}
