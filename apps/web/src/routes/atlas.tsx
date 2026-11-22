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
const cellClass = 'py-2 pr-2';
const numericCellClass = 'py-2 pr-3 text-right font-mono tabular-nums text-vellum/70';
const headClass = 'py-2 pl-3 pr-2 text-left font-normal text-vellum/60';
const numericHeadClass = 'py-2 pr-3 text-right font-normal text-vellum/60';
const linkClass = 'text-brass underline decoration-brass/40 underline-offset-2';

interface OpenDepartement {
  code: string;
  nom: string;
}

interface MapEntity {
  key: string;
  code: string;
  pathD: string;
  fillOpacity: string;
  possessed: boolean;
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
          <AtlasMap viewBox={FRANCE_VIEWBOX} entities={[]} />
          <p className="text-sm text-vellum/70">{ATLAS_ROOM.loadingSummary}</p>
        </div>
      ) : null}

      {summaryQuery.isError ? (
        <div className="space-y-4 rounded-sheet border border-veil bg-cabinet-raised p-5 md:p-6">
          <p role="alert" className="text-sm text-danger">
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
            viewBox={
              showCommunes && shownDetail !== undefined ? shownDetail.viewBox : summary.viewBox
            }
            entities={
              showCommunes && shownDetail !== undefined
                ? communeMapEntities(shownDetail.communes)
                : nationalMapEntities(summary)
            }
          />

          {openDepartement === null ? (
            <NationalTable summary={summary} onOpen={setOpenDepartement} />
          ) : detailQuery.isError ? (
            <div className="space-y-4 rounded-sheet border border-veil bg-cabinet-raised p-5 md:p-6">
              <p role="alert" className="text-sm text-danger">
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
            <p className="text-sm text-vellum/70">{ATLAS_ROOM.loadingDepartement}</p>
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
      code: region.code,
      pathD: region.pathD,
      fillOpacity: (
        0.06 +
        0.39 * coverageRatio(region.communesOwned, region.communesTotal)
      ).toFixed(3),
      possessed: region.hasRegionCard,
    });
  }
  for (const departement of summary.departements) {
    if (departement.pathD === null) continue;
    entities.push({
      key: `departement-${departement.code}`,
      code: departement.code,
      pathD: departement.pathD,
      fillOpacity: (
        0.06 +
        0.39 * coverageRatio(departement.communesOwned, departement.communesTotal)
      ).toFixed(3),
      possessed: departement.hasDepartementCard,
    });
  }
  return entities;
}

function communeMapEntities(communes: readonly AtlasCommune[]): MapEntity[] {
  const entities: MapEntity[] = [];
  for (const commune of communes) {
    if (commune.pathD === null) continue;
    entities.push({
      key: `commune-${commune.codeInsee}`,
      code: commune.codeInsee,
      pathD: commune.pathD,
      fillOpacity: (commune.hasCommuneCard ? 0.45 : 0.06).toFixed(3),
      possessed: commune.hasCommuneCard,
    });
  }
  return entities;
}

interface AtlasMapProps {
  viewBox: string;
  entities: readonly MapEntity[];
}

function AtlasMap({ viewBox, entities }: AtlasMapProps) {
  return (
    <figure className="rounded-[2px] border border-veil bg-cabinet-sunk p-3 md:p-6">
      <svg
        viewBox={viewBox}
        aria-hidden="true"
        focusable="false"
        role="presentation"
        className="h-auto w-full"
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
          entities.map((entity) => (
            <path
              key={entity.key}
              d={entity.pathD}
              data-entity-code={entity.code}
              data-possession={entity.possessed ? 'true' : 'false'}
              fillOpacity={entity.fillOpacity}
              strokeWidth={entity.possessed ? 2 : 0.75}
              vectorEffect="non-scaling-stroke"
              className={`fill-vellum-2 transition-[fill-opacity,stroke] duration-300 motion-reduce:transition-none ${
                entity.possessed ? 'stroke-brass' : 'stroke-veil-strong'
              }`}
            />
          ))
        )}
      </svg>
    </figure>
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
          <col className="w-[56%]" />
          <col className="w-[20%]" />
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
          <col className="w-[52%]" />
          <col className="w-[28%]" />
          <col className="w-[20%]" />
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
