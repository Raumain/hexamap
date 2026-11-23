import type { AtlasCommune, AtlasDepartementDetail, AtlasSummary } from '@hexamap/shared';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, Navigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { SessionUnavailable } from '../components/ui/session-unavailable';
import { ATLAS_ROOM, coveragePercent, departementSummary, nationalSummary } from '../content/atlas';
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

interface OpenDepartement {
  code: string;
  nom: string;
}

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
  const [openDepartement, setOpenDepartement] = useState<OpenDepartement | null>(null);
  const levelTitleRef = useRef<HTMLHeadingElement>(null);

  const summaryQuery = useQuery(atlasSummaryQueryOptions());
  const openCode = openDepartement?.code ?? null;
  const detailQuery = useQuery({
    ...atlasDepartementQueryOptions(openCode ?? ''),
    enabled: openCode !== null,
  });

  // Le titre de niveau reprend le focus à chaque descente ou remontée : aucune
  // surface de la carte n'est focusable, donc le clavier ne se perd pas dans le SVG.
  // La référence initialisée au niveau courant saute le tout premier rendu.
  const previousLevel = useRef(openCode);
  useEffect(() => {
    if (previousLevel.current === openCode) return;
    previousLevel.current = openCode;
    levelTitleRef.current?.focus();
  }, [openCode]);

  const summary = summaryQuery.data;
  const detail = detailQuery.data;
  const shownDetail = detail !== undefined && detail.code === openCode ? detail : undefined;
  const showCommunes = openDepartement !== null && shownDetail !== undefined;

  const levelTitle = openDepartement === null ? ATLAS_ROOM.nationalTitle : openDepartement.nom;

  let statusLine = '';
  if (openDepartement === null) {
    if (summary !== undefined) {
      statusLine = nationalSummary(summary.regions.length, summary.departements.length);
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

  return (
    <div className="mt-8 space-y-6">
      <div className="space-y-3">
        {openDepartement === null ? null : (
          <button
            type="button"
            onClick={() => setOpenDepartement(null)}
            className={backButtonClass}
          >
            {ATLAS_ROOM.backToNational}
          </button>
        )}
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
          {showCommunes && shownDetail !== undefined ? (
            <AtlasMap
              viewBox={shownDetail.viewBox}
              frame={shownDetail.viewBox === summary.viewBox ? 'metropole' : 'groupe'}
              onOpenDepartement={setOpenDepartement}
              entities={communeMapEntities(shownDetail.communes, shownDetail.viewBox)}
            />
          ) : (
            <NationalMap summary={summary} onOpenDepartement={setOpenDepartement} />
          )}

          {openDepartement === null ? (
            <NationalTable summary={summary} onOpen={setOpenDepartement} />
          ) : detailQuery.isError ? (
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
              <NationalTable summary={summary} onOpen={setOpenDepartement} />
            </div>
          ) : shownDetail.communes.length === 0 ? (
            <p className="rounded-sheet border border-veil bg-cabinet-raised p-5 text-sm leading-relaxed text-vellum/70">
              {ATLAS_ROOM.emptyDepartement}
            </p>
          ) : (
            <DepartementTable detail={shownDetail} />
          )}
        </div>
      ) : null}
    </div>
  );
}

function coverageRatio(owned: number, total: number): number {
  return total > 0 ? owned / total : 0;
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
  for (const departement of summary.departements) {
    if (departement.pathD === null) continue;
    entities.push({
      key: `departement-${departement.code}`,
      kind: 'departement',
      code: departement.code,
      name: departement.nom,
      pathD: departement.pathD,
      viewBox: departement.viewBox,
      coverage: coverageRatio(departement.communesOwned, departement.communesTotal),
      possessed: departement.hasDepartementCard,
    });
  }
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

/** Découpe les entités nationales : métropole d'un côté, un encart par cadre de groupe. */
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

interface MapSurfaceProps {
  viewBox: string;
  entities: readonly MapEntity[];
  frame: MapFrame;
  /** Ouvre un département depuis la carte — la même action que sa ligne de table. */
  onOpenDepartement?: (departement: OpenDepartement) => void;
  className?: string;
}

/**
 * La surface SVG nue, sans `<figure>`. Elle ne choisit que son cadre : le `pathD`
 * est passé tel quel, donc aucune géométrie n'est recalculée dans le navigateur.
 */
function MapSurface({
  viewBox,
  entities,
  frame,
  onOpenDepartement,
  className = 'h-auto w-full',
}: MapSurfaceProps) {
  return (
    <svg
      viewBox={viewBox}
      data-map-frame={frame}
      aria-hidden="true"
      focusable="false"
      role="presentation"
      className={className}
    >
      {entities.length === 0 ? (
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
          // Le niveau décide du remplissage et du filet ; la possession ne
          // fait plus que renforcer le filet.
          const isRegion = entity.kind === 'region';
          const isDepartement = entity.kind === 'departement';
          const fillClass = isRegion
            ? 'fill-none'
            : isDepartement
              ? 'fill-verdigris'
              : 'fill-vellum-2';
          const strokeClass = isRegion
            ? entity.possessed
              ? 'stroke-brass'
              : 'stroke-foil-hi'
            : entity.possessed
              ? isDepartement
                ? 'stroke-brass'
                : 'stroke-verdigris'
              : 'stroke-veil-strong';
          const strokeWidth = isRegion
            ? entity.possessed
              ? 2
              : 1.25
            : entity.possessed
              ? 2
              : 0.75;
          // La région ne remplit pas : c'est un contour. Le département porte
          // la couverture, la commune possédée se lit au filet, plus à l'aplat.
          const fillOpacity = isRegion ? 0 : isDepartement ? 0.06 + 0.39 * entity.coverage : 0.06;
          const open = isDepartement ? onOpenDepartement : undefined;
          return (
            // biome-ignore lint/a11y/noStaticElementInteractions: le SVG est aria-hidden et purement décoratif ; l'ouverture du département est doublée par le bouton de la table équivalente, seul chemin accessible.
            <path
              key={entity.key}
              d={entity.pathD}
              data-entity-code={entity.code}
              data-entity-kind={entity.kind}
              data-possession={entity.possessed ? 'true' : 'false'}
              fillOpacity={fillOpacity}
              strokeWidth={strokeWidth}
              vectorEffect="non-scaling-stroke"
              onClick={
                open === undefined ? undefined : () => open({ code: entity.code, nom: entity.name })
              }
              className={`${fillClass} ${strokeClass} transition-[fill-opacity,stroke] duration-300 motion-reduce:transition-none ${
                open === undefined ? '' : 'cursor-pointer hover:stroke-brass'
              }`}
            />
          );
        })
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
}

function AtlasMap({ viewBox, entities, frame, onOpenDepartement }: AtlasMapProps) {
  return (
    <figure className="rounded-[2px] border border-veil bg-cabinet-sunk p-3 md:p-6">
      <MapSurface
        viewBox={viewBox}
        entities={entities}
        frame={frame}
        onOpenDepartement={onOpenDepartement}
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
}

/**
 * Un encart par groupe d'outre-mer, à côté de la métropole. Chaque encart est un
 * `<svg>` nu — jamais un `<figure>`, pour ne pas troubler la lecture `figure svg`
 * du banc existant — dont le `viewBox` est celui du groupe lu dans la réponse.
 */
function OverseasInsets({ groups, onOpenDepartement }: OverseasInsetsProps) {
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
            />
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-vellum/60">{ATLAS_ROOM.overseasCaption}</p>
    </section>
  );
}

interface NationalMapProps {
  summary: AtlasSummary;
  onOpenDepartement: (departement: OpenDepartement) => void;
}

/**
 * Le niveau national : la métropole d'abord, puis un encart par groupe d'outre-mer.
 * L'ordre DOM suit la lecture, et les deux parts sont découpées sur le `viewBox`
 * lu dans la réponse — jamais sur une liste de codes.
 */
function NationalMap({ summary, onOpenDepartement }: NationalMapProps) {
  const { metropole, groups } = splitByFrame(nationalMapEntities(summary), summary.viewBox);
  return (
    <div className="space-y-6">
      <AtlasMap
        viewBox={summary.viewBox}
        frame="metropole"
        entities={metropole}
        onOpenDepartement={onOpenDepartement}
      />
      {groups.length > 0 ? (
        <OverseasInsets
          groups={groups.map(([viewBox, entities]) => ({
            viewBox,
            entities,
            title: groupTitle(entities),
          }))}
          onOpenDepartement={onOpenDepartement}
        />
      ) : null}
    </div>
  );
}

interface NationalTableProps {
  summary: AtlasSummary;
  onOpen: (departement: OpenDepartement) => void;
}

function NationalTable({ summary, onOpen }: NationalTableProps) {
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
        <tbody>
          {summary.regions.map((region) => (
            <tr key={`region-${region.code}`} className="border-t border-veil/40 align-top">
              <th scope="row" className={rowHeadClass}>
                {region.nom}
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
            <tr
              key={`departement-${departement.code}`}
              className="border-t border-veil/40 align-top"
            >
              <th scope="row" className={rowHeadClass}>
                <button
                  type="button"
                  onClick={() => onOpen({ code: departement.code, nom: departement.nom })}
                  className="text-left underline decoration-brass/40 underline-offset-2"
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
