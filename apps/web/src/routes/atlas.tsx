import type {
  AtlasCommune,
  AtlasDepartementDetail,
  AtlasSummary,
  AtlasSummaryDepartement,
  AtlasSummaryRegion,
} from '@hexamap/shared';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, Navigate } from '@tanstack/react-router';
import { type ReactNode, type Ref, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SessionUnavailable } from '../components/ui/session-unavailable';
import {
  ATLAS_ROOM,
  coveragePercent,
  departementSummary,
  nationalSummary,
  regionSummary,
} from '../content/atlas';
import {
  atlasDepartementQueryOptions,
  atlasErrorMessage,
  atlasSummaryQueryOptions,
} from '../lib/atlas';
import { FRANCE_CORSICA_PATH, FRANCE_MAINLAND_PATH, FRANCE_VIEWBOX } from '../lib/france-outline';
import { useSessionState } from '../lib/session';

const retryButtonClass =
  'inline-flex min-h-11 items-center justify-center rounded-[2px] border border-brass/50 px-4 font-mono text-[10px] uppercase tracking-[0.14em] text-brass transition-colors duration-150 hover:border-brass hover:text-brass-pale';

const backButtonClass =
  'inline-flex min-h-11 items-center rounded-[2px] border border-brass/50 px-4 font-mono text-[10px] uppercase tracking-[0.14em] text-brass transition-colors duration-150 hover:border-brass hover:text-brass-pale';

const rowHeadClass = 'break-words py-2 pl-3 pr-2 text-left font-normal';
const cellClass = 'break-words py-2 pr-2';
const numericCellClass =
  'whitespace-nowrap py-2 pr-3 text-right font-mono tabular-nums text-vellum/70';
const headClass = 'py-2 pl-3 pr-2 text-left font-normal text-vellum/60';
const numericHeadClass = 'whitespace-nowrap py-2 pr-3 text-right font-normal text-vellum/60';
const linkClass = 'text-brass underline decoration-brass/40 underline-offset-2';
const entityButtonClass = 'text-left underline decoration-brass/40 underline-offset-2';

interface OpenDepartement {
  code: string;
  nom: string;
}

interface OpenRegion {
  code: string;
  nom: string;
}

/**
 * Les trois niveaux de la descente, empilés : une entrée par pas franchi, la
 * dernière fait foi. Remonter dépile d'exactement un niveau, ce qui rend le
 * retour vrai depuis n'importe quelle profondeur.
 *
 * `box` mémorise le cadre **recadré** de l'entité ouverte : c'est lui que la
 * remontée restaure, sans avoir à recalculer une boîte dans un SVG qui ne
 * contient plus l'entité.
 */
type AtlasLevel =
  | { kind: 'national' }
  | { kind: 'region'; code: string; nom: string; box: string }
  | { kind: 'departement'; code: string; nom: string; box: string };

/** Un niveau réduit à ce qui décide de son cadre : son type et son code. */
type AtlasTarget =
  | { kind: 'national' }
  | { kind: 'region'; code: string }
  | { kind: 'departement'; code: string };

type MapEntityKind = 'region' | 'departement' | 'commune';

interface MapEntity {
  key: string;
  kind: MapEntityKind;
  code: string;
  name: string;
  pathD: string;
  viewBox: string;
  coverage: number;
  possessed: boolean;
}

/** Le cadre de la carte principale, ou celui d'un encart d'outre-mer. */
type MapFrame = 'metropole' | 'groupe';

/**
 * Le contour de l'entité **ouverte**, tracé au-dessus de ses enfants : entrer
 * dans une région cadre ses départements, entrer dans un département cadre ses
 * communes. Aucun `data-entity-code` : la parité entre les lignes de la table
 * et les tracés cliquables reste vraie.
 */
interface MapOutline {
  pathD: string;
  kind: 'region' | 'departement';
  code: string;
}

/** Durée du recadrage : assez long pour lire le mouvement, assez court pour rester un geste. */
const ATLAS_ZOOM_MS = 480;

/** Marge du recadrage, en fraction du plus grand côté de la boîte cliquée. */
const FOCUS_PADDING = 0.12;

/**
 * L'état transitoire d'un recadrage. `from` est aussi le `viewBox` **rendu par
 * React** pendant l'animation : la prop ne bouge donc pas, et un re-rendu (le
 * détail du département qui arrive) ne réécrit pas l'attribut en cours de route.
 */
interface AtlasTransition {
  from: string;
  to: string;
  ghosts: MapEntity[];
  ghostOutline: MapOutline | null;
  /**
   * Jeton de génération, posé dès `applyViewBox` : une frame tardive d'une
   * animation précédente ne peut pas annuler la transition qui vient de naître.
   */
  run: number;
}

function roundHundredth(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseViewBox(value: string): [number, number, number, number] | null {
  const parts = value
    .trim()
    .split(/[\s,]+/)
    .filter((part) => part.length > 0)
    .map(Number);
  if (parts.length !== 4) return null;
  const [x, y, width, height] = parts as [number, number, number, number];
  if (![x, y, width, height].every(Number.isFinite)) return null;
  if (width <= 0 || height <= 0) return null;
  return [x, y, width, height];
}

/**
 * Interpolation d'un cadre : le **centre** à vitesse constante, la **taille** en
 * logarithme. Une interpolation linéaire des côtés donne une vitesse perçue qui
 * accélère puis ralentit ; ici le plan se resserre régulièrement, comme un
 * objectif qu'on tourne.
 */
function interpolateViewBox(
  from: readonly [number, number, number, number],
  to: readonly [number, number, number, number],
  t: number,
): string {
  const [fromX, fromY, fromWidth, fromHeight] = from;
  const [toX, toY, toWidth, toHeight] = to;
  const centerX = fromX + fromWidth / 2 + (toX + toWidth / 2 - (fromX + fromWidth / 2)) * t;
  const centerY = fromY + fromHeight / 2 + (toY + toHeight / 2 - (fromY + fromHeight / 2)) * t;
  const width = fromWidth * (toWidth / fromWidth) ** t;
  const height = fromHeight * (toHeight / fromHeight) ** t;
  return `${roundHundredth(centerX - width / 2)} ${roundHundredth(centerY - height / 2)} ${roundHundredth(width)} ${roundHundredth(height)}`;
}

/**
 * Le cadre d'une entité, lu sur le tracé réellement rendu : c'est ce qui fait
 * voir ses enfants en grand, la géométrie n'étant jamais recalculée.
 */
function focusBoxFromSvg(
  svg: SVGSVGElement | null,
  kind: 'region' | 'departement',
  code: string,
): string | null {
  if (svg === null) return null;

  const target = Array.from(
    svg.querySelectorAll<SVGPathElement>('path[data-entity-kind][data-entity-code]'),
  ).find(
    (path) =>
      path.getAttribute('data-entity-kind') === kind &&
      path.getAttribute('data-entity-code') === code,
  );
  if (target === undefined) return null;

  try {
    const box = target.getBBox();
    if (box.width <= 0 || box.height <= 0) return null;
    // Un cadre **carré** et centré : le viewport est carré (`aspect-square`) et
    // le `viewBox` national aussi, donc `preserveAspectRatio` ne letterboxe plus
    // et l'échelle perçue, `S / max(width, height)`, reste monotone pendant le vol.
    const side = Math.max(box.width, box.height) * (1 + 2 * FOCUS_PADDING);
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    return [
      roundHundredth(centerX - side / 2),
      roundHundredth(centerY - side / 2),
      roundHundredth(side),
      roundHundredth(side),
    ].join(' ');
  } catch {
    // Un moteur sans rendu (ou un tracé détaché) : pas de recadrage, le cadre
    // du groupe fera l'affaire.
    return null;
  }
}

/** Le `viewBox` du **groupe** d'un niveau — jamais le cadre recadré. */
function frameViewBoxFor(level: AtlasTarget, summary: AtlasSummary): string {
  if (level.kind === 'region') {
    return summary.regions.find((region) => region.code === level.code)?.viewBox ?? summary.viewBox;
  }
  if (level.kind === 'departement') {
    return (
      summary.departements.find((departement) => departement.code === level.code)?.viewBox ??
      summary.viewBox
    );
  }
  return summary.viewBox;
}

/**
 * Le cadre cible d'une entité : recadré sur son tracé en métropole, celui du
 * groupe hors métropole. Un DROM est projeté dans le repère de son groupe ; le
 * recadrer davantage déplacerait ses communes hors de la fenêtre.
 */
function focusViewBoxFor(
  target: AtlasTarget,
  summary: AtlasSummary,
  svg: SVGSVGElement | null,
): string {
  const frame = frameViewBoxFor(target, summary);
  if (frame !== summary.viewBox) return frame;
  if (target.kind === 'national') return frame;
  return focusBoxFromSvg(svg, target.kind, target.code) ?? frame;
}

/** Le cadre sur lequel un niveau se pose : son cadre mémorisé, ou la France. */
function targetBoxFor(level: AtlasLevel, summary: AtlasSummary): string {
  return level.kind === 'national' ? summary.viewBox : level.box;
}

/** Les entités du niveau courant, immédiatement — jamais après l'animation. */
function entitiesFor(
  level: AtlasLevel,
  summary: AtlasSummary,
  detail: AtlasDepartementDetail | undefined,
): MapEntity[] {
  if (level.kind === 'region') {
    return departementMapEntities(
      summary.departements.filter((departement) => departement.codeRegion === level.code),
    );
  }
  if (level.kind === 'departement') {
    if (detail === undefined || detail.code !== level.code) return [];
    return communeMapEntities(detail.communes, detail.viewBox);
  }
  return splitByFrame(nationalMapEntities(summary), summary.viewBox).metropole;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export const Route = createFileRoute('/atlas')({
  component: AtlasPage,
});

function AtlasPage() {
  const session = useSessionState();

  if (session.status === 'loading') {
    return <p className="text-sm text-vellum/70">{ATLAS_ROOM.loadingSession}</p>;
  }

  if (session.status === 'unavailable') {
    return <SessionUnavailable onRetry={session.retry} />;
  }

  if (session.status === 'anonymous') {
    return <Navigate to="/login" />;
  }

  return (
    <section>
      <header>
        <p className="salon-eyebrow">{ATLAS_ROOM.eyebrow}</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-vellum md:text-5xl">
          {ATLAS_ROOM.title}
        </h1>
        <div className="brass-rule mt-5 w-24" />
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-vellum/70">
          {ATLAS_ROOM.subtitle}
        </p>
        <ul className="mt-4 space-y-1 text-xs text-vellum/60">
          <li>{ATLAS_ROOM.legendFill}</li>
          <li>{ATLAS_ROOM.legendFillet}</li>
          <li>{ATLAS_ROOM.legendContour}</li>
          <li>{ATLAS_ROOM.overseasLegend}</li>
        </ul>
      </header>

      <AtlasBoard />
    </section>
  );
}

function AtlasBoard() {
  const [history, setHistory] = useState<AtlasLevel[]>([]);
  const [viewBoxState, setViewBoxState] = useState<string | null>(null);
  const [transition, setTransition] = useState<AtlasTransition | null>(null);
  const levelTitleRef = useRef<HTMLHeadingElement>(null);
  const mapSvgRef = useRef<SVGSVGElement | null>(null);
  const zoomRun = useRef(0);

  const summaryQuery = useQuery(atlasSummaryQueryOptions());

  const current = history.at(-1);
  const level: AtlasLevel = current ?? { kind: 'national' };
  const levelKey = level.kind === 'national' ? 'national' : `${level.kind}-${level.code}`;
  const parent = history.length > 1 ? history[history.length - 2] : undefined;

  const openCode = level.kind === 'departement' ? level.code : null;
  const detailQuery = useQuery({
    ...atlasDepartementQueryOptions(openCode ?? ''),
    enabled: openCode !== null,
  });

  // Le titre de niveau reprend le focus à chaque descente ou remontée : aucune
  // surface de la carte n'est focusable, donc le clavier ne se perd pas dans le SVG.
  // La référence initialisée au niveau courant saute le tout premier rendu.
  const previousLevel = useRef(levelKey);
  useEffect(() => {
    if (previousLevel.current === levelKey) return;
    previousLevel.current = levelKey;
    levelTitleRef.current?.focus();
  }, [levelKey]);

  const summary = summaryQuery.data;
  const detail = detailQuery.data;
  const shownDetail = detail !== undefined && detail.code === openCode ? detail : undefined;

  const region: AtlasSummaryRegion | undefined =
    level.kind === 'region' && summary !== undefined
      ? summary.regions.find((candidate) => candidate.code === level.code)
      : undefined;

  const regionDepartements: AtlasSummaryDepartement[] =
    region !== undefined && summary !== undefined
      ? summary.departements.filter((departement) => departement.codeRegion === region.code)
      : [];

  const regionOwned = regionDepartements.filter(
    (departement) => departement.hasDepartementCard,
  ).length;

  const levelTitle = level.kind === 'national' ? ATLAS_ROOM.nationalTitle : level.nom;

  const backLabel =
    parent !== undefined && parent.kind === 'region'
      ? ATLAS_ROOM.backToRegion(parent.nom)
      : ATLAS_ROOM.backToNational;

  let statusLine = '';
  if (level.kind === 'national') {
    if (summary !== undefined) {
      statusLine = nationalSummary(summary.regions.length, summary.departements.length);
    }
  } else if (level.kind === 'region') {
    if (region !== undefined) {
      statusLine = regionSummary(region.nom, regionDepartements.length, regionOwned);
    }
  } else if (shownDetail !== undefined) {
    statusLine = departementSummary(
      shownDetail.nom,
      shownDetail.communes.length,
      shownDetail.communesOwned,
    );
  } else if (detailQuery.isPending) {
    statusLine = ATLAS_ROOM.loadingDepartement;
  }

  const isEmptyNational =
    summary !== undefined && summary.regions.length === 0 && summary.departements.length === 0;

  // Le contenu suit le niveau immédiatement : seuls le cadre et les fantômes
  // sont transitoires.
  const outline = summary === undefined ? null : outlineOf(level, summary);
  const entities = summary === undefined ? [] : entitiesFor(level, summary, shownDetail);
  const overseasGroups: OverseasGroup[] =
    level.kind === 'national' && summary !== undefined
      ? splitByFrame(nationalMapEntities(summary), summary.viewBox).groups.map(
          ([viewBox, groupEntities]) => ({
            viewBox,
            entities: groupEntities,
            title: groupTitle(groupEntities),
          }),
        )
      : [];
  const mapFrame: MapFrame =
    summary !== undefined && frameViewBoxFor(level, summary) !== summary.viewBox
      ? 'groupe'
      : 'metropole';
  const displayedViewBox = transition?.from ?? viewBoxState ?? summary?.viewBox ?? FRANCE_VIEWBOX;

  /**
   * Pose le cadre d'arrivée — animé quand les deux niveaux partagent le même
   * repère, immédiat sinon (changement de repère, cadre inchangé, mouvement
   * réduit).
   */
  const applyViewBox = (
    from: string,
    to: string,
    fromLevel: AtlasLevel,
    toLevel: AtlasLevel,
    ghosts: MapEntity[],
    ghostOutline: MapOutline | null,
  ): void => {
    if (summary === undefined || prefersReducedMotion()) {
      zoomRun.current += 1;
      setTransition(null);
      setViewBoxState(to);
      return;
    }
    // Métropole ↔ DROM : les deux cadres ne décrivent pas le même espace, une
    // interpolation ferait traverser la carte.
    if (frameViewBoxFor(fromLevel, summary) !== frameViewBoxFor(toLevel, summary) || from === to) {
      zoomRun.current += 1;
      setTransition(null);
      setViewBoxState(to);
      return;
    }
    const run = zoomRun.current + 1;
    zoomRun.current = run;
    setTransition({ from, to, ghosts, ghostOutline, run });
  };

  const openRegion = (region: OpenRegion): void => {
    if (summary === undefined) return;
    const svg = mapSvgRef.current;
    const from = svg?.getAttribute('viewBox') ?? viewBoxState ?? summary.viewBox;
    const box = focusViewBoxFor({ kind: 'region', code: region.code }, summary, svg);
    const entry: AtlasLevel = { kind: 'region', code: region.code, nom: region.nom, box };
    applyViewBox(from, box, level, entry, entities, outline);
    setHistory((stack) => [...stack, entry]);
  };

  const openDepartement = (departement: OpenDepartement): void => {
    if (summary === undefined) return;
    const svg = mapSvgRef.current;
    const from = svg?.getAttribute('viewBox') ?? viewBoxState ?? summary.viewBox;
    const box = focusViewBoxFor({ kind: 'departement', code: departement.code }, summary, svg);
    const entry: AtlasLevel = {
      kind: 'departement',
      code: departement.code,
      nom: departement.nom,
      box,
    };
    applyViewBox(from, box, level, entry, entities, outline);
    setHistory((stack) => [...stack, entry]);
  };

  const goBack = (): void => {
    if (summary === undefined) {
      setHistory((stack) => stack.slice(0, -1));
      return;
    }
    const target: AtlasLevel = parent ?? { kind: 'national' };
    const from = mapSvgRef.current?.getAttribute('viewBox') ?? viewBoxState ?? summary.viewBox;
    // Pas de fantômes en remontée : le contenu du parent est plus large et
    // couvre déjà la zone que le cadre élargit.
    applyViewBox(from, targetBoxFor(target, summary), level, target, [], null);
    setHistory((stack) => stack.slice(0, -1));
  };

  // Le `viewBox` s'anime par `requestAnimationFrame`, jamais par un état React
  // par image : la prop reste `transition.from` pendant tout le vol, donc aucun
  // re-rendu (détail chargé, focus) ne réécrit l'attribut.
  useLayoutEffect(() => {
    if (transition === null) return;

    const svg = mapSvgRef.current;
    const from = parseViewBox(transition.from);
    const to = parseViewBox(transition.to);

    if (svg === null || from === null || to === null) {
      setTransition(null);
      setViewBoxState(transition.to);
      return;
    }

    zoomRun.current = Math.max(zoomRun.current, transition.run);
    const run = transition.run;
    let frame: number | null = null;
    let startedAt: number | null = null;

    const step = (now: number): void => {
      if (zoomRun.current !== run) return;
      startedAt ??= now;
      const progress = Math.min(1, (now - startedAt) / ATLAS_ZOOM_MS);
      const eased = 1 - (1 - progress) ** 3;
      svg.setAttribute('viewBox', interpolateViewBox(from, to, eased));
      if (progress < 1) {
        frame = requestAnimationFrame(step);
        return;
      }
      frame = null;
      setViewBoxState(transition.to);
      setTransition(null);
    };

    frame = requestAnimationFrame(step);

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [transition]);

  return (
    <div className="mt-8 space-y-6">
      <div className="space-y-3">
        {history.length > 0 ? (
          <button type="button" onClick={goBack} className={backButtonClass}>
            {backLabel}
          </button>
        ) : null}
        <h2
          ref={levelTitleRef}
          tabIndex={-1}
          className="font-display text-2xl font-semibold text-vellum focus:outline-none"
        >
          {levelTitle}
        </h2>
        <p role="status" aria-live="polite" className="text-sm text-vellum/70">
          {statusLine}
        </p>
      </div>

      {summaryQuery.isPending ? (
        <div className="space-y-6">
          <AtlasMap viewBox={FRANCE_VIEWBOX} frame="metropole" entities={[]} />
          <p className="text-sm text-vellum/70">{ATLAS_ROOM.loadingSummary}</p>
        </div>
      ) : null}

      {summaryQuery.isError ? (
        <div className="space-y-4 rounded-sheet border border-danger/45 bg-danger/10 p-5 md:p-6">
          <p role="alert" className="text-sm text-vellum">
            {atlasErrorMessage(summaryQuery.error)}
          </p>
          <button
            type="button"
            onClick={() => void summaryQuery.refetch()}
            className={retryButtonClass}
          >
            {ATLAS_ROOM.retry}
          </button>
        </div>
      ) : null}

      {isEmptyNational ? (
        <p className="rounded-sheet border border-veil bg-cabinet-raised p-5 text-sm leading-relaxed text-vellum/70">
          {ATLAS_ROOM.emptyNational}
        </p>
      ) : null}

      {summary !== undefined && !isEmptyNational ? (
        <div className="space-y-6">
          <AtlasMap
            svgRef={mapSvgRef}
            viewBox={displayedViewBox}
            frame={mapFrame}
            entities={entities}
            outline={outline}
            ghosts={transition?.ghosts ?? []}
            ghostOutline={transition?.ghostOutline ?? null}
            onOpenDepartement={openDepartement}
            onOpenRegion={openRegion}
          />

          {overseasGroups.length > 0 ? (
            <OverseasInsets
              groups={overseasGroups}
              onOpenDepartement={openDepartement}
              onOpenRegion={openRegion}
            />
          ) : null}

          {level.kind === 'national' ? (
            <NationalTable summary={summary} onOpen={openDepartement} onOpenRegion={openRegion} />
          ) : null}

          {level.kind === 'region' ? (
            region === undefined || regionDepartements.length === 0 ? (
              <p className="rounded-sheet border border-veil bg-cabinet-raised p-5 text-sm leading-relaxed text-vellum/70">
                {ATLAS_ROOM.emptyRegion}
              </p>
            ) : (
              <RegionTable departements={regionDepartements} onOpen={openDepartement} />
            )
          ) : null}

          {level.kind === 'departement' ? (
            detailQuery.isError ? (
              <div className="space-y-4 rounded-sheet border border-danger/45 bg-danger/10 p-5 md:p-6">
                <p role="alert" className="text-sm text-vellum">
                  {atlasErrorMessage(detailQuery.error)}
                </p>
                <button
                  type="button"
                  onClick={() => void detailQuery.refetch()}
                  className={retryButtonClass}
                >
                  {ATLAS_ROOM.retry}
                </button>
              </div>
            ) : shownDetail === undefined ? (
              <div aria-busy="true" className="space-y-3">
                <p className="text-sm text-vellum/70">{ATLAS_ROOM.loadingDepartement}</p>
              </div>
            ) : shownDetail.communes.length === 0 ? (
              <p className="rounded-sheet border border-veil bg-cabinet-raised p-5 text-sm leading-relaxed text-vellum/70">
                {ATLAS_ROOM.emptyDepartement}
              </p>
            ) : (
              <DepartementTable detail={shownDetail} />
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function coverageRatio(owned: number, total: number): number {
  return total > 0 ? owned / total : 0;
}

/** Le contour de l'entité ouverte, ou `null` quand elle n'a pas de tracé. */
function outlineOf(level: AtlasLevel, summary: AtlasSummary): MapOutline | null {
  if (level.kind === 'region') {
    const region = summary.regions.find((candidate) => candidate.code === level.code);
    if (region?.pathD == null) return null;
    return { pathD: region.pathD, kind: 'region', code: region.code };
  }

  if (level.kind === 'departement') {
    const departement = summary.departements.find((candidate) => candidate.code === level.code);
    if (departement?.pathD == null) return null;
    return { pathD: departement.pathD, kind: 'departement', code: departement.code };
  }

  return null;
}

function departementMapEntities(departements: readonly AtlasSummaryDepartement[]): MapEntity[] {
  const entities: MapEntity[] = [];
  for (const departement of departements) {
    if (departement.pathD === null) continue;
    entities.push({
      key: `departement-${departement.code}`,
      kind: 'departement',
      code: departement.code,
      name: departement.nom,
      pathD: departement.pathD,
      // Le cadre de la **ligne**, jamais celui de la carte : c'est ce qui
      // distingue la métropole des encarts d'outre-mer.
      viewBox: departement.viewBox,
      coverage: coverageRatio(departement.communesOwned, departement.communesTotal),
      possessed: departement.hasDepartementCard,
    });
  }
  return entities;
}

function nationalMapEntities(summary: AtlasSummary): MapEntity[] {
  const entities: MapEntity[] = [];
  for (const region of summary.regions) {
    if (region.pathD === null) continue;
    entities.push({
      key: `region-${region.code}`,
      kind: 'region',
      code: region.code,
      name: region.nom,
      pathD: region.pathD,
      viewBox: region.viewBox,
      coverage: coverageRatio(region.communesOwned, region.communesTotal),
      possessed: region.hasRegionCard,
    });
  }
  entities.push(...departementMapEntities(summary.departements));
  return entities;
}

function communeMapEntities(communes: readonly AtlasCommune[], viewBox: string): MapEntity[] {
  const entities: MapEntity[] = [];
  for (const commune of communes) {
    if (commune.pathD === null) continue;
    entities.push({
      key: `commune-${commune.codeInsee}`,
      kind: 'commune',
      code: commune.codeInsee,
      name: commune.nom,
      pathD: commune.pathD,
      viewBox,
      coverage: 0,
      possessed: commune.hasCommuneCard,
    });
  }
  return entities;
}

/**
 * Découpe les entités nationales : métropole d'un côté, un encart par cadre de groupe.
 *
 * Chaque entité garde le `viewBox` de sa **ligne**, pas celui de la carte : un
 * département d'outre-mer et la région de son groupe partagent le même cadre,
 * donc le découpage se lit dans la réponse et jamais dans une liste de codes.
 */
function splitByFrame(entities: readonly MapEntity[], metropoleViewBox: string) {
  const metropole: MapEntity[] = [];
  const groups = new Map<string, MapEntity[]>();
  for (const entity of entities) {
    if (entity.viewBox === metropoleViewBox) {
      metropole.push(entity);
      continue;
    }
    const list = groups.get(entity.viewBox) ?? [];
    list.push(entity);
    groups.set(entity.viewBox, list);
  }
  return { metropole, groups: [...groups.entries()] };
}

/** Titre d'un encart : les régions du groupe, à défaut ses départements. */
function groupTitle(entities: readonly MapEntity[]): string {
  const regions = entities.filter((entity) => entity.kind === 'region');
  if (regions.length > 0) return regions.map((entity) => entity.name).join(' · ');
  return entities
    .filter((entity) => entity.kind === 'departement')
    .map((entity) => entity.name)
    .join(' · ');
}

interface EntityPaint {
  fillClass: string;
  fillOpacity: number;
  strokeClass: string;
  strokeWidth: number;
}

/**
 * Le niveau décide de l'aplat et du filet, la possession de leur intensité.
 *
 * Une entité possédée s'éclaire d'un fond doré clair, une entité manquante reste
 * dans le vert du cabinet ; la région, elle, n'est jamais qu'un contour. Aucune
 * couleur littérale : uniquement les jetons de `styles.css`.
 */
function entityPaint(entity: MapEntity): EntityPaint {
  if (entity.kind === 'region') {
    return {
      fillClass: 'fill-none',
      fillOpacity: 0,
      strokeClass: entity.possessed ? 'stroke-brass' : 'stroke-foil-hi',
      strokeWidth: entity.possessed ? 3.5 : 2,
    };
  }

  if (entity.kind === 'departement') {
    return entity.possessed
      ? {
          fillClass: 'fill-brass-pale',
          fillOpacity: 0.42 + 0.25 * entity.coverage,
          strokeClass: 'stroke-brass',
          strokeWidth: 3,
        }
      : {
          fillClass: 'fill-verdigris',
          fillOpacity: 0.06 + 0.39 * entity.coverage,
          strokeClass: 'stroke-veil-strong',
          strokeWidth: 1.5,
        };
  }

  return entity.possessed
    ? {
        fillClass: 'fill-brass-pale',
        fillOpacity: 0.4,
        strokeClass: 'stroke-verdigris',
        strokeWidth: 2.5,
      }
    : {
        fillClass: 'fill-vellum-2',
        fillOpacity: 0.06,
        strokeClass: 'stroke-veil-strong',
        strokeWidth: 1.25,
      };
}

interface MapSurfaceProps {
  viewBox: string;
  entities: readonly MapEntity[];
  frame: MapFrame;
  /** Ouvre un département depuis la carte — la même action que sa ligne de table. */
  onOpenDepartement?: (departement: OpenDepartement) => void;
  /** Ouvre une région depuis la carte — la même action que sa ligne de table. */
  onOpenRegion?: (region: OpenRegion) => void;
  /** Le contour de l'entité ouverte, tracé au-dessus de ses enfants. */
  outline?: MapOutline | null;
  /** La carte du niveau précédent, visible sous la nouvelle pendant le zoom. */
  ghosts?: readonly MapEntity[];
  ghostOutline?: MapOutline | null;
  svgRef?: Ref<SVGSVGElement>;
  className?: string;
}

/**
 * La surface SVG nue, sans `<figure>`. Elle ne choisit que son cadre : le `pathD`
 * est passé tel quel, donc aucune géométrie n'est recalculée dans le navigateur.
 *
 * Les fantômes n'ont aucun attribut `data-entity-*` : la parité entre les lignes
 * de la table et les tracés cliquables reste vraie pendant toute la transition.
 */
function MapSurface({
  viewBox,
  entities,
  frame,
  onOpenDepartement,
  onOpenRegion,
  outline = null,
  ghosts = [],
  ghostOutline = null,
  svgRef,
  className = 'h-auto w-full',
}: MapSurfaceProps) {
  return (
    <svg
      ref={svgRef}
      viewBox={viewBox}
      data-map-frame={frame}
      aria-hidden="true"
      focusable="false"
      role="presentation"
      className={className}
    >
      {ghosts.map((ghost) => {
        const paint = entityPaint(ghost);
        return (
          <path
            key={`ghost-${ghost.key}`}
            d={ghost.pathD}
            data-ghost="true"
            fillOpacity={paint.fillOpacity}
            strokeWidth={paint.strokeWidth}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
            className={`${paint.fillClass} ${paint.strokeClass}`}
          />
        );
      })}
      {ghostOutline === null ? null : (
        <path
          d={ghostOutline.pathD}
          data-ghost-outline="true"
          fill="none"
          className="stroke-brass"
          strokeWidth={5}
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      )}
      {entities.length === 0 && outline === null && ghosts.length === 0 ? (
        <>
          <path
            d={FRANCE_MAINLAND_PATH}
            className="fill-vellum-2 stroke-veil-strong"
            fillOpacity={0.06}
            strokeWidth={0.75}
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={FRANCE_CORSICA_PATH}
            className="fill-vellum-2 stroke-veil-strong"
            fillOpacity={0.06}
            strokeWidth={0.75}
            vectorEffect="non-scaling-stroke"
          />
        </>
      ) : (
        entities.map((entity) => {
          const paint = entityPaint(entity);
          const open =
            entity.kind === 'departement'
              ? onOpenDepartement
              : entity.kind === 'region'
                ? onOpenRegion
                : undefined;
          return (
            // biome-ignore lint/a11y/noStaticElementInteractions: le SVG est aria-hidden et purement décoratif ; l'ouverture de l'entité est doublée par le bouton de la table équivalente, seul chemin accessible.
            <path
              key={entity.key}
              d={entity.pathD}
              data-entity-code={entity.code}
              data-entity-kind={entity.kind}
              data-possession={entity.possessed ? 'true' : 'false'}
              fillOpacity={paint.fillOpacity}
              strokeWidth={paint.strokeWidth}
              vectorEffect="non-scaling-stroke"
              onClick={
                open === undefined ? undefined : () => open({ code: entity.code, nom: entity.name })
              }
              className={`${paint.fillClass} ${paint.strokeClass} transition-[fill-opacity,stroke] duration-300 motion-reduce:transition-none ${
                open === undefined ? '' : 'cursor-pointer hover:stroke-brass'
              }`}
            />
          );
        })
      )}
      {outline === null ? null : (
        <path
          d={outline.pathD}
          data-map-outline="true"
          data-map-outline-kind={outline.kind}
          data-map-outline-code={outline.code}
          fill="none"
          className="stroke-brass"
          strokeWidth={5}
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      )}
    </svg>
  );
}

interface AtlasMapProps {
  viewBox: string;
  entities: readonly MapEntity[];
  frame: MapFrame;
  /** Ouvre un département depuis la carte — la même action que sa ligne de table. */
  onOpenDepartement?: (departement: OpenDepartement) => void;
  /** Ouvre une région depuis la carte — la même action que sa ligne de table. */
  onOpenRegion?: (region: OpenRegion) => void;
  /** Le contour de l'entité ouverte, tracé au-dessus de ses enfants. */
  outline?: MapOutline | null;
  ghosts?: readonly MapEntity[];
  ghostOutline?: MapOutline | null;
  svgRef?: Ref<SVGSVGElement>;
}

function AtlasMap({
  viewBox,
  entities,
  frame,
  onOpenDepartement,
  onOpenRegion,
  outline = null,
  ghosts = [],
  ghostOutline = null,
  svgRef,
}: AtlasMapProps) {
  return (
    <figure className="rounded-[2px] border border-veil bg-cabinet-sunk p-3 md:p-6">
      <MapSurface
        svgRef={svgRef}
        viewBox={viewBox}
        entities={entities}
        frame={frame}
        onOpenDepartement={onOpenDepartement}
        onOpenRegion={onOpenRegion}
        outline={outline}
        ghosts={ghosts}
        ghostOutline={ghostOutline}
        // Cadre **stable** : un tracé allongé change le ratio intrinsèque du SVG,
        // et la page sauterait à chaque cadrage. Les encarts d'outre-mer gardent,
        // eux, le ratio de leur groupe (`h-auto w-full` par défaut).
        className="aspect-square w-full"
      />
    </figure>
  );
}

interface OverseasGroup {
  viewBox: string;
  entities: readonly MapEntity[];
  title: string;
}

interface OverseasInsetsProps {
  groups: readonly OverseasGroup[];
  onOpenDepartement?: (departement: OpenDepartement) => void;
  onOpenRegion?: (region: OpenRegion) => void;
}

/**
 * Un encart par groupe d'outre-mer, à côté de la métropole. Chaque encart est un
 * `<svg>` nu — jamais un `<figure>`, pour ne pas troubler la lecture `figure svg`
 * du banc existant — dont le `viewBox` est celui du groupe lu dans la réponse.
 */
function OverseasInsets({ groups, onOpenDepartement, onOpenRegion }: OverseasInsetsProps) {
  return (
    <section className="rounded-[2px] border border-veil/60 p-3">
      <p className="text-xs text-vellum/70">{ATLAS_ROOM.overseasTitle}</p>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {groups.map((group) => (
          <div key={group.viewBox}>
            <h3 className="text-xs font-semibold text-vellum/80">{group.title}</h3>
            <MapSurface
              viewBox={group.viewBox}
              entities={group.entities}
              frame="groupe"
              onOpenDepartement={onOpenDepartement}
              onOpenRegion={onOpenRegion}
            />
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-vellum/60">{ATLAS_ROOM.overseasCaption}</p>
    </section>
  );
}

interface NationalTableProps {
  summary: AtlasSummary;
  onOpen: (departement: OpenDepartement) => void;
  onOpenRegion?: (region: OpenRegion) => void;
}

function NationalTable({ summary, onOpen, onOpenRegion }: NationalTableProps) {
  return (
    <TableFrame>
      <tbody>
        {summary.regions.map((region) => (
          <tr key={`region-${region.code}`} className="border-t border-veil/40 align-top">
            <th scope="row" className={rowHeadClass}>
              {onOpenRegion === undefined ? (
                region.nom
              ) : (
                <button
                  type="button"
                  onClick={() => onOpenRegion({ code: region.code, nom: region.nom })}
                  className={entityButtonClass}
                >
                  <span className="sr-only">{ATLAS_ROOM.openRegion}</span>
                  {region.nom}
                </button>
              )}
            </th>
            <td
              className={`${cellClass} ${region.hasRegionCard ? 'text-brass' : 'text-vellum/70'}`}
            >
              {region.hasRegionCard ? ATLAS_ROOM.possessed : ATLAS_ROOM.missing}
            </td>
            <td className={numericCellClass}>
              {coveragePercent(region.communesOwned, region.communesTotal)}
            </td>
          </tr>
        ))}
        {summary.departements.map((departement) => (
          <tr key={`departement-${departement.code}`} className="border-t border-veil/40 align-top">
            <th scope="row" className={rowHeadClass}>
              <button
                type="button"
                onClick={() => onOpen({ code: departement.code, nom: departement.nom })}
                className={entityButtonClass}
              >
                <span className="sr-only">{ATLAS_ROOM.openDepartment}</span>
                {departement.nom}
              </button>
            </th>
            <td
              className={`${cellClass} ${departement.hasDepartementCard ? 'text-brass' : 'text-vellum/70'}`}
            >
              {departement.hasDepartementCard ? ATLAS_ROOM.possessed : ATLAS_ROOM.missing}
            </td>
            <td className={numericCellClass}>
              <span className="block">
                {coveragePercent(departement.communesOwned, departement.communesTotal)}
              </span>
              <Link
                to="/collection"
                search={{ departement: departement.code }}
                className={linkClass}
              >
                <span className="sr-only">{ATLAS_ROOM.openDepartmentAtCadastre}</span>
                {ATLAS_ROOM.cadastreLink}
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </TableFrame>
  );
}

interface RegionTableProps {
  departements: readonly AtlasSummaryDepartement[];
  onOpen: (departement: OpenDepartement) => void;
}

/** Le niveau région : les seuls départements de la région ouverte. */
function RegionTable({ departements, onOpen }: RegionTableProps) {
  return (
    <TableFrame>
      <tbody>
        {departements.map((departement) => (
          <tr key={departement.code} className="border-t border-veil/40 align-top">
            <th scope="row" className={rowHeadClass}>
              <button
                type="button"
                onClick={() => onOpen({ code: departement.code, nom: departement.nom })}
                className={entityButtonClass}
              >
                <span className="sr-only">{ATLAS_ROOM.openDepartment}</span>
                {departement.nom}
              </button>
            </th>
            <td
              className={`${cellClass} ${departement.hasDepartementCard ? 'text-brass' : 'text-vellum/70'}`}
            >
              {departement.hasDepartementCard ? ATLAS_ROOM.possessed : ATLAS_ROOM.missing}
            </td>
            <td className={numericCellClass}>
              <span className="block">
                {coveragePercent(departement.communesOwned, departement.communesTotal)}
              </span>
              <Link
                to="/collection"
                search={{ departement: departement.code }}
                className={linkClass}
              >
                <span className="sr-only">{ATLAS_ROOM.openDepartmentAtCadastre}</span>
                {ATLAS_ROOM.cadastreLink}
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </TableFrame>
  );
}

/** Le cadre commun des trois tables : même légende, mêmes colonnes, même encre. */
function TableFrame({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-sheet border border-veil bg-cabinet-raised">
      <table className="w-full table-fixed border-collapse text-xs">
        <caption className="sr-only">{ATLAS_ROOM.tableCaption}</caption>
        <colgroup>
          <col className="w-[48%]" />
          <col className="w-[24%]" />
          <col className="w-[28%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-veil">
            <th scope="col" className={headClass}>
              {ATLAS_ROOM.columnEntity}
            </th>
            <th scope="col" className={headClass}>
              {ATLAS_ROOM.columnState}
            </th>
            <th scope="col" className={numericHeadClass}>
              {ATLAS_ROOM.columnCoverage}
            </th>
          </tr>
        </thead>
        {children}
      </table>
    </div>
  );
}

function DepartementTable({ detail }: { detail: AtlasDepartementDetail }) {
  return (
    <div className="overflow-hidden rounded-sheet border border-veil bg-cabinet-raised">
      <table className="w-full table-fixed border-collapse text-xs">
        <caption className="sr-only">{ATLAS_ROOM.tableCaption}</caption>
        <colgroup>
          <col className="w-[50%]" />
          <col className="w-[26%]" />
          <col className="w-[24%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-veil">
            <th scope="col" className={headClass}>
              {ATLAS_ROOM.columnEntity}
            </th>
            <th scope="col" className={headClass}>
              {ATLAS_ROOM.columnState}
            </th>
            <th scope="col" className={numericHeadClass}>
              {ATLAS_ROOM.columnCoverage}
            </th>
          </tr>
        </thead>
        <tbody>
          {detail.communes.map((commune) => (
            <tr key={commune.codeInsee} className="border-t border-veil/40 align-top">
              <th scope="row" className={rowHeadClass}>
                <Link
                  to="/collection"
                  search={{ commune: commune.codeInsee }}
                  className={linkClass}
                >
                  <span className="sr-only">{ATLAS_ROOM.openCommune}</span>
                  {commune.nom}
                </Link>
              </th>
              <td
                className={`${cellClass} ${commune.ownedCards > 0 ? 'text-brass' : 'text-vellum/70'}`}
              >
                {commune.ownedCards > 0
                  ? `${ATLAS_ROOM.possessed} (${ATLAS_ROOM.copies(commune.ownedCards)})`
                  : ATLAS_ROOM.missing}
              </td>
              <td className={numericCellClass}>
                {coveragePercent(commune.ownedCards > 0 ? 1 : 0, 1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
