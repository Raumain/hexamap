/**
 * Le Palmarès — la semaine ISO 8601, en UTC, et rien d'autre.
 *
 * Aucune dépendance, aucun `Intl`, aucune locale : la semaine est une
 * arithmétique de jours, pas une affaire de fuseau ni de calendrier régional.
 * Lundi ouvre la semaine, dimanche la ferme, et l'année ISO est celle du jeudi
 * de la semaine — c'est ce qui fait de `2027-01-01` la semaine 53 de 2026.
 */

/** Taille d'une page du classement quand la requête ne dit rien. */
export const PALMARES_LIMIT_DEFAULT = 20;

/** Borne haute acceptée par `limit` : au-delà, la route refuse la requête. */
export const PALMARES_LIMIT_MAX = 100;

export interface IsoWeek {
  year: number;
  week: number;
}

const MS_PER_DAY = 86_400_000;
const DAYS_PER_WEEK = 7;

/** Jour calendaire UTC de `date`, ramené à son minuit. */
function utcMidnight(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Lundi 00:00:00.000 UTC de la semaine qui contient `time` (millisecondes UTC). */
function mondayOf(time: number): number {
  const weekday = new Date(time).getUTCDay();
  const isoWeekday = weekday === 0 ? 7 : weekday;
  return time - (isoWeekday - 1) * MS_PER_DAY;
}

/**
 * Lundi de la semaine 1 d'une année ISO. Le 4 janvier appartient toujours à la
 * semaine 1, quel que soit le jour de la semaine où tombe le 1er janvier : le
 * lundi de sa semaine est donc le premier lundi de l'année ISO.
 */
function firstMondayOf(year: number): number {
  return mondayOf(Date.UTC(year, 0, 4));
}

/** Semaine ISO 8601 du jour calendaire UTC de `date`. */
export function isoWeekOf(date: Date): IsoWeek {
  const monday = mondayOf(utcMidnight(date));
  const year = new Date(monday + 3 * MS_PER_DAY).getUTCFullYear();
  const week = Math.round((monday - firstMondayOf(year)) / (DAYS_PER_WEEK * MS_PER_DAY)) + 1;
  return { year, week };
}

/**
 * Bornes d'une semaine ISO : `start` est le lundi 00:00:00.000 UTC, `end` le
 * lundi suivant, exclu. Rend `null` quand la semaine n'existe pas — une semaine
 * hors 1..53, une valeur non entière, ou une combinaison qui ne tombe pas dans
 * l'année demandée (`{2027, 53}` : 2027 n'a que 52 semaines).
 */
export function isoWeekRange(week: IsoWeek): { start: Date; end: Date } | null {
  if (!Number.isInteger(week.year) || !Number.isInteger(week.week)) {
    return null;
  }
  if (week.week < 1 || week.week > 53) {
    return null;
  }

  const start = firstMondayOf(week.year) + (week.week - 1) * DAYS_PER_WEEK * MS_PER_DAY;
  const startDate = new Date(start);
  const resolved = isoWeekOf(startDate);
  if (resolved.year !== week.year || resolved.week !== week.week) {
    return null;
  }

  return { start: startDate, end: new Date(start + DAYS_PER_WEEK * MS_PER_DAY) };
}

/** Étiquette `IYYY-Www`, semaine sur deux chiffres : `2026-W05`, `2026-W47`. */
export function isoWeekLabel(week: IsoWeek): string {
  return `${String(week.year).padStart(4, '0')}-W${String(week.week).padStart(2, '0')}`;
}
