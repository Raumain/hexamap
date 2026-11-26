/**
 * Projection d'atlas — le seul endroit du dépôt qui transforme un `geom` en
 * `path_d`.
 *
 * **Deux valeurs sont figées ici, et nulle part ailleurs.**
 *
 * 1. La projection est un **Mercator sphérique (EPSG:3857)** cadré sur l'emprise
 *    **métropolitaine** (lon −5,5 → 9,9 ; lat 41,2 → 51,3), avec `R = 6 378 137`.
 *    Quatre lignes de calcul, aucune dépendance, aucune reprojection inverse, et
 *    les formes sont conservées localement — ce qu'un simple `lon`/`lat` linéaire
 *    ne donnerait pas (la France se replierait en haut).
 * 2. Le rendu se fait dans le `viewBox` **`0 0 1000 1000`**, `y` inversé, échelle
 *    uniforme (`1000 / max(largeur, hauteur)`) et centrage sur l'axe le plus
 *    court. Une seule emprise pour les trois niveaux : région, département et
 *    commune se superposent donc exactement.
 *
 * **L'outre-mer sort du cadre métropolitain, et se range dans le sien.** Une
 * emprise qui contiendrait la Réunion et les Antilles multiplierait l'échelle par
 * dix et rendrait la métropole illisible ; une entité dont la géométrie est
 * disjointe du cadre demandé est donc classée `out_of_viewbox` et ne rend aucun
 * tracé. Pour la métropole, ce cadre est `0 0 1000 1000` ; pour un groupe
 * d'outre-mer, il est la bbox rembourrée de ses points projetés — la projection
 * reste la même, seul le `viewBox` choisit la fenêtre. La règle est géométrique,
 * jamais une liste de codes de département à maintenir.
 *
 * **Ce module est pur** : aucune entrée-sortie, aucun import, aucun
 * `process.env`, aucun aléatoire, aucune date. Deux appels sur la même géométrie
 * rendent la même chaîne, octet pour octet.
 */

export const ATLAS_VIEWBOX = 1000;

/** Cadre d'affichage métropolitain : valeur par défaut de `ref_*.view_box`. */
export const ATLAS_METROPOLE_VIEW_BOX = '0 0 1000 1000';

/** Rembourrage du cadre d'un groupe : 2 % de sa plus grande dimension, au moins 1 unité. */
export const ATLAS_VIEW_BOX_PADDING_RATIO = 0.02;

export interface AtlasViewBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const ATLAS_PROJECTION = 'mercator-spherical-epsg3857-metropole';

export const ATLAS_METROPOLE_BOUNDS = {
  lonMin: -5.5,
  lonMax: 9.9,
  latMin: 41.2,
  latMax: 51.3,
} as const;

export type AtlasLevel = 'REGION' | 'DEPARTEMENT' | 'COMMUNE';

/**
 * Epsilons Douglas-Peucker, en unités de `viewBox` : plus l'entité est petite,
 * plus la simplification doit être fine. Une commune de quatre kilomètres ne
 * supporte pas l'epsilon d'une région.
 */
export const ATLAS_EPSILON: Record<AtlasLevel, number> = {
  REGION: 0.6,
  DEPARTEMENT: 0.35,
  COMMUNE: 0.2,
};

/**
 * Plafond de sommets d'un tracé communal. Une commune littorale très découpée
 * peut produire des milliers de sommets pour un gain visuel nul à cette échelle ;
 * au-delà, l'epsilon est doublé jusqu'à tenir.
 */
export const ATLAS_COMMUNE_MAX_POINTS = 700;

export type AtlasPoint = { x: number; y: number };

export type AtlasGeometryVerdict = 'ok' | 'invalid' | 'out_of_viewbox';

const EARTH_RADIUS = 6378137;
const DEG_TO_RAD = Math.PI / 180;
const MAX_EPSILON_DOUBLINGS = 12;

interface ProjectedFrame {
  readonly xMin: number;
  readonly yMax: number;
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

/** Deux décimales, et `-0` rendu `0`. */
function roundCoordinate(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return rounded === 0 ? 0 : rounded;
}

/** Mercator sphérique brut, en mètres. */
function mercatorMetres(lon: number, lat: number): AtlasPoint {
  const latRad = lat * DEG_TO_RAD;
  return {
    x: EARTH_RADIUS * lon * DEG_TO_RAD,
    y: EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + latRad / 2)),
  };
}

let cachedFrame: ProjectedFrame | null = null;

/**
 * Le cadre est dérivé des quatre coins de `ATLAS_METROPOLE_BOUNDS`, jamais d'une
 * constante écrite à la main : changer l'emprise suffit à recadrer la carte.
 * Le cache ne porte aucune donnée : la valeur est la même à chaque appel.
 */
function frame(): ProjectedFrame {
  if (cachedFrame !== null) {
    return cachedFrame;
  }

  const basGauche = mercatorMetres(ATLAS_METROPOLE_BOUNDS.lonMin, ATLAS_METROPOLE_BOUNDS.latMin);
  const hautDroite = mercatorMetres(ATLAS_METROPOLE_BOUNDS.lonMax, ATLAS_METROPOLE_BOUNDS.latMax);
  const largeur = hautDroite.x - basGauche.x;
  const hauteur = hautDroite.y - basGauche.y;
  const scale = ATLAS_VIEWBOX / Math.max(largeur, hauteur);

  cachedFrame = {
    xMin: basGauche.x,
    yMax: hautDroite.y,
    scale,
    offsetX: (ATLAS_VIEWBOX - largeur * scale) / 2,
    offsetY: (ATLAS_VIEWBOX - hauteur * scale) / 2,
  };

  return cachedFrame;
}

/** WGS84 → unités de `viewBox`, arrondies à deux décimales. */
export function projectLonLat(lon: number, lat: number): AtlasPoint {
  const cadre = frame();
  const metres = mercatorMetres(lon, lat);

  return {
    x: roundCoordinate((metres.x - cadre.xMin) * cadre.scale + cadre.offsetX),
    y: roundCoordinate(cadre.offsetY + (cadre.yMax - metres.y) * cadre.scale),
  };
}

function formatCoordinate(value: number): string {
  return String(roundCoordinate(value));
}

/** `'0 0 1000 1000'` → nombres. `null` si la valeur n'est pas un viewBox exploitable. */
export function parseViewBox(value: string): AtlasViewBox | null {
  const parts = value.trim().split(/[\s,]+/);

  if (parts.length !== 4) {
    return null;
  }

  const numbers = parts.map((part) => Number(part));
  if (numbers.some((number) => !Number.isFinite(number))) {
    return null;
  }

  const [x, y, width, height] = numbers;
  if (
    x === undefined ||
    y === undefined ||
    width === undefined ||
    height === undefined ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }

  return { x, y, width, height };
}

/** Un viewBox SVG, quatre nombres à deux décimales au plus. */
export function formatViewBox(box: AtlasViewBox): string {
  return `${formatCoordinate(box.x)} ${formatCoordinate(box.y)} ${formatCoordinate(
    box.width,
  )} ${formatCoordinate(box.height)}`;
}

function segmentDistanceSquared(point: AtlasPoint, start: AtlasPoint, end: AtlasPoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    const ex = point.x - start.x;
    const ey = point.y - start.y;
    return ex * ex + ey * ey;
  }

  const projection = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
  const clamped = Math.max(0, Math.min(1, projection));
  const px = start.x + clamped * dx - point.x;
  const py = start.y + clamped * dy - point.y;

  return px * px + py * py;
}

/**
 * Douglas-Peucker sur une polyligne **ouverte**. La pile est explicite : un
 * anneau de cinq mille sommets quasi alignés ferait déborder une récursion.
 */
export function simplifyPath(points: readonly AtlasPoint[], epsilon: number): AtlasPoint[] {
  const count = points.length;

  if (count <= 2) {
    return points.map((point) => ({ x: point.x, y: point.y }));
  }

  const kept = new Uint8Array(count);
  kept[0] = 1;
  kept[count - 1] = 1;

  const epsilonSquared = epsilon * epsilon;
  const stack: Array<[number, number]> = [[0, count - 1]];

  while (stack.length > 0) {
    const range = stack.pop();
    if (range === undefined) {
      break;
    }

    const [start, end] = range;
    const startPoint = points[start];
    const endPoint = points[end];
    if (startPoint === undefined || endPoint === undefined) {
      continue;
    }

    let farthestIndex = -1;
    let farthestDistance = -1;

    for (let index = start + 1; index < end; index++) {
      const point = points[index];
      if (point === undefined) {
        continue;
      }

      const distance = segmentDistanceSquared(point, startPoint, endPoint);
      if (distance > farthestDistance) {
        farthestDistance = distance;
        farthestIndex = index;
      }
    }

    if (farthestIndex !== -1 && farthestDistance > epsilonSquared) {
      kept[farthestIndex] = 1;
      stack.push([start, farthestIndex], [farthestIndex, end]);
    }
  }

  const simplified: AtlasPoint[] = [];
  for (let index = 0; index < count; index++) {
    const point = points[index];
    if (kept[index] === 1 && point !== undefined) {
      simplified.push({ x: point.x, y: point.y });
    }
  }

  return simplified;
}

function samePoint(left: AtlasPoint, right: AtlasPoint): boolean {
  return left.x === right.x && left.y === right.y;
}

/**
 * Anneau fermé : le point de fermeture est retiré, la polyligne est simplifiée,
 * puis refermée. Un résultat sous trois points n'est pas un anneau — il conserve
 * donc sa version **projetée non simplifiée**, sinon un petit polygone
 * disparaîtrait de la carte.
 */
export function simplifyRing(ring: readonly AtlasPoint[], epsilon: number): AtlasPoint[] {
  if (ring.length === 0) {
    return [];
  }

  const first = ring[0];
  const last = ring[ring.length - 1];
  const open =
    first !== undefined && last !== undefined && ring.length > 1 && samePoint(first, last)
      ? ring.slice(0, -1)
      : [...ring];

  const simplified = simplifyPath(open, epsilon);

  if (simplified.length < 3) {
    return open.map((point) => ({ x: point.x, y: point.y }));
  }

  return simplified;
}

interface ParsedRing {
  readonly positions: ReadonlyArray<readonly [number, number]>;
}

function parsePosition(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length < 2) {
    return null;
  }

  const lon = value[0];
  const lat = value[1];

  if (typeof lon !== 'number' || typeof lat !== 'number') {
    return null;
  }

  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    return null;
  }

  // `±90` est exclu, pas seulement `> 90` : Mercator y rend `±Infinity`, et
  // l'entité serait alors classée `out_of_viewbox` (« outre-mer ») au lieu de
  // `invalid`. Une géométrie polaire n'est pas hors du cadre, elle est fausse.
  if (Math.abs(lon) > 180 || Math.abs(lat) >= 90) {
    return null;
  }

  return [lon, lat];
}

function parsePolygon(coordinates: unknown): ParsedRing[] | null {
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    return null;
  }

  const rings: ParsedRing[] = [];

  for (const candidate of coordinates) {
    if (!Array.isArray(candidate) || candidate.length < 4) {
      return null;
    }

    const positions: Array<readonly [number, number]> = [];
    for (const position of candidate) {
      const parsed = parsePosition(position);
      if (parsed === null) {
        return null;
      }
      positions.push(parsed);
    }

    rings.push({ positions });
  }

  return rings;
}

/**
 * Aplatit Polygon, MultiPolygon, Feature et GeometryCollection en une liste
 * d'anneaux. Tout autre type — y compris un `Point` ou un `GeometryCollection`
 * qui contiendrait un `Point` — rend `null` : le module ne devine pas, il refuse.
 */
function collectRings(geometry: unknown): ParsedRing[] | null {
  if (geometry === null || typeof geometry !== 'object') {
    return null;
  }

  const candidate = geometry as {
    type?: unknown;
    coordinates?: unknown;
    geometry?: unknown;
    geometries?: unknown;
  };

  switch (candidate.type) {
    case 'Polygon':
      return parsePolygon(candidate.coordinates);

    case 'MultiPolygon': {
      if (!Array.isArray(candidate.coordinates) || candidate.coordinates.length === 0) {
        return null;
      }

      const rings: ParsedRing[] = [];
      for (const polygon of candidate.coordinates) {
        const parsed = parsePolygon(polygon);
        if (parsed === null) {
          return null;
        }
        rings.push(...parsed);
      }

      return rings;
    }

    case 'Feature':
      return collectRings(candidate.geometry);

    case 'GeometryCollection': {
      if (!Array.isArray(candidate.geometries) || candidate.geometries.length === 0) {
        return null;
      }

      const rings: ParsedRing[] = [];
      for (const child of candidate.geometries) {
        const parsed = collectRings(child);
        if (parsed === null) {
          return null;
        }
        rings.push(...parsed);
      }

      return rings;
    }

    default:
      return null;
  }
}

/**
 * Le cadre d'un groupe : la bbox des points **projetés** de toutes ses géométries,
 * rembourrée. `null` si aucune géométrie n'est exploitable. C'est la seule fonction
 * qui décide d'un `view_box` d'outre-mer ; elle ne reprojette rien.
 */
export function viewBoxOfGeometries(geometries: readonly unknown[]): string | null {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let found = false;

  for (const geometry of geometries) {
    const rings = collectRings(geometry);
    if (rings === null) {
      continue;
    }

    for (const ring of rings) {
      for (const [lon, lat] of ring.positions) {
        const point = projectLonLat(lon, lat);
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
          continue;
        }

        found = true;
        if (point.x < minX) minX = point.x;
        if (point.x > maxX) maxX = point.x;
        if (point.y < minY) minY = point.y;
        if (point.y > maxY) maxY = point.y;
      }
    }
  }

  if (!found) {
    return null;
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const pad = Math.max(1, ATLAS_VIEW_BOX_PADDING_RATIO * Math.max(width, height));

  return formatViewBox({
    x: minX - pad,
    y: minY - pad,
    width: width + 2 * pad,
    height: height + 2 * pad,
  });
}

interface AnalysedGeometry {
  readonly verdict: AtlasGeometryVerdict;
  /** Anneaux projetés, deux décimales, ordre d'entrée conservé. */
  readonly rings: ReadonlyArray<ReadonlyArray<AtlasPoint>>;
}

/**
 * Un recouvrement, même partiel, suffit : **aucune découpe**. Une entité à cheval
 * sur le bord du cadre est rendue telle quelle et le `viewBox` rogne le dessin ;
 * découper demanderait une librairie de clipping (Greiner-Hormann, Sutherland-
 * Hodgman) et ne servirait aucun cas métropolitain. Seule une bbox entièrement
 * disjointe est classée `out_of_viewbox`.
 */
function overlapsViewbox(
  rings: ReadonlyArray<ReadonlyArray<AtlasPoint>>,
  box: AtlasViewBox,
): boolean {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const ring of rings) {
    for (const point of ring) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        return false;
      }
      if (point.x < minX) minX = point.x;
      if (point.x > maxX) maxX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.y > maxY) maxY = point.y;
    }
  }

  if (minX === Number.POSITIVE_INFINITY) {
    return false;
  }

  return !(maxX < box.x || minX > box.x + box.width || maxY < box.y || minY > box.y + box.height);
}

function analyseGeometry(geometry: unknown, viewBox: string): AnalysedGeometry {
  const box = parseViewBox(viewBox) ?? {
    x: 0,
    y: 0,
    width: ATLAS_VIEWBOX,
    height: ATLAS_VIEWBOX,
  };
  const rings = collectRings(geometry);

  if (rings === null || rings.length === 0) {
    return { verdict: 'invalid', rings: [] };
  }

  const projected: AtlasPoint[][] = [];
  for (const ring of rings) {
    const points: AtlasPoint[] = [];
    for (const [lon, lat] of ring.positions) {
      points.push(projectLonLat(lon, lat));
    }
    projected.push(points);
  }

  if (!overlapsViewbox(projected, box)) {
    return { verdict: 'out_of_viewbox', rings: [] };
  }

  return { verdict: 'ok', rings: projected };
}

function renderRing(points: ReadonlyArray<AtlasPoint>): string {
  const first = points[0];
  if (first === undefined) {
    return '';
  }

  let path = `M${formatCoordinate(first.x)} ${formatCoordinate(first.y)}`;
  for (let index = 1; index < points.length; index++) {
    const point = points[index];
    if (point === undefined) {
      continue;
    }
    path += `L${formatCoordinate(point.x)} ${formatCoordinate(point.y)}`;
  }

  return `${path}Z`;
}

function renderPath(
  rings: ReadonlyArray<ReadonlyArray<AtlasPoint>>,
  epsilon: number,
): { path: string; points: number } {
  const segments: string[] = [];
  let points = 0;

  for (const ring of rings) {
    const simplified = simplifyRing(ring, epsilon);
    if (simplified.length === 0) {
      continue;
    }
    segments.push(renderRing(simplified));
    points += simplified.length;
  }

  return { path: segments.join(' '), points };
}

/**
 * GeoJSON → `path_d`, ou `null`. Le niveau décide de l'epsilon et du plafond, et
 * de rien d'autre : la classe (`ok`, `invalid`, `out_of_viewbox`) est la même
 * quel que soit le niveau.
 */
export function geometryToPathD(
  geometry: unknown,
  level: AtlasLevel,
  viewBox: string = ATLAS_METROPOLE_VIEW_BOX,
): string | null {
  const analysed = analyseGeometry(geometry, viewBox);

  if (analysed.verdict !== 'ok') {
    return null;
  }

  let epsilon = ATLAS_EPSILON[level];
  let rendered = renderPath(analysed.rings, epsilon);

  if (level === 'COMMUNE') {
    let doublings = 0;
    while (rendered.points > ATLAS_COMMUNE_MAX_POINTS && doublings < MAX_EPSILON_DOUBLINGS) {
      epsilon *= 2;
      doublings += 1;
      rendered = renderPath(analysed.rings, epsilon);
    }
  }

  return rendered.path;
}

export function classifyGeometry(
  geometry: unknown,
  level: AtlasLevel,
  viewBox: string = ATLAS_METROPOLE_VIEW_BOX,
): AtlasGeometryVerdict {
  // Le niveau ne change pas la classe : seules l'epsilon et le plafond diffèrent.
  void level;
  return analyseGeometry(geometry, viewBox).verdict;
}

/** Nombre de sommets d'un `path_d` : un `M` d'ouverture et un `L` par sommet. */
export function pathPointCount(pathD: string): number {
  const commands = pathD.match(/[ML]/g);
  return commands === null ? 0 : commands.length;
}
