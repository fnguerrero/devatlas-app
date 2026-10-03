/** Formateos de texto y fecha compartidos por las páginas. */

const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

/**
 * Fecha en lenguaje de todos los días: "hace 5 minutos", "ayer", "hace 3 meses".
 * Para algo de más de un año se cae a la fecha corta, que dice más que "hace 2 años".
 */
export function relativeTime(value: string | Date, now: Date = new Date()): string {
  const fecha = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(fecha.getTime())) return '';

  const ms = now.getTime() - fecha.getTime();
  if (ms < 0) return fecha.toLocaleDateString('es-AR');
  if (ms < MINUTO) return 'recién';
  if (ms < HORA) {
    const min = Math.floor(ms / MINUTO);
    return `hace ${min} ${min === 1 ? 'minuto' : 'minutos'}`;
  }
  if (ms < DIA) {
    const hs = Math.floor(ms / HORA);
    return `hace ${hs} ${hs === 1 ? 'hora' : 'horas'}`;
  }

  const dias = Math.floor(ms / DIA);
  if (dias === 1) return 'ayer';
  if (dias < 30) return `hace ${dias} días`;
  if (dias < 365) {
    const meses = Math.floor(dias / 30);
    return `hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`;
  }

  return fecha.toLocaleDateString('es-AR');
}

/** Fecha y hora completas, para el tooltip de la fecha relativa. */
export function fullDate(value: string | Date): string {
  const fecha = value instanceof Date ? value : new Date(value);
  return Number.isNaN(fecha.getTime()) ? '' : fecha.toLocaleString('es-AR');
}

/**
 * Parte un texto en tramos según lo que se buscó, para poder resaltar las coincidencias.
 * Devuelve los tramos en orden; `match` marca cuáles coinciden.
 */
export function splitMatch(text: string, term: string): { text: string; match: boolean }[] {
  const t = term.trim();
  if (!t || !text) return [{ text, match: false }];

  const lowerText = text.toLowerCase();
  const lowerTerm = t.toLowerCase();
  const partes: { text: string; match: boolean }[] = [];

  let desde = 0;
  let i = lowerText.indexOf(lowerTerm);
  while (i !== -1) {
    if (i > desde) partes.push({ text: text.slice(desde, i), match: false });
    partes.push({ text: text.slice(i, i + t.length), match: true });
    desde = i + t.length;
    i = lowerText.indexOf(lowerTerm, desde);
  }
  if (desde < text.length) partes.push({ text: text.slice(desde), match: false });

  return partes;
}
