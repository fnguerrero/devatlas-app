import { describe, expect, it } from 'vitest';
import { relativeTime, splitMatch } from './format';

const ahora = new Date('2026-08-13T12:00:00Z');
const hace = (ms: number) => new Date(ahora.getTime() - ms);

describe('relativeTime', () => {
  it('resuelve los tramos cortos', () => {
    expect(relativeTime(hace(30_000), ahora)).toBe('recién');
    expect(relativeTime(hace(5 * 60_000), ahora)).toBe('hace 5 minutos');
    expect(relativeTime(hace(60_000), ahora)).toBe('hace 1 minuto');
    expect(relativeTime(hace(3 * 3_600_000), ahora)).toBe('hace 3 horas');
  });

  it('resuelve días y meses', () => {
    expect(relativeTime(hace(86_400_000), ahora)).toBe('ayer');
    expect(relativeTime(hace(5 * 86_400_000), ahora)).toBe('hace 5 días');
    expect(relativeTime(hace(60 * 86_400_000), ahora)).toBe('hace 2 meses');
  });

  it('para más de un año muestra la fecha', () => {
    const resultado = relativeTime(hace(400 * 86_400_000), ahora);
    expect(resultado).toMatch(/\d{4}/);
  });

  it('no explota con una fecha inválida', () => {
    expect(relativeTime('cualquier cosa', ahora)).toBe('');
  });
});

describe('splitMatch', () => {
  it('marca las coincidencias sin importar mayúsculas', () => {
    expect(splitMatch('Portal Pedidos', 'pedidos')).toEqual([
      { text: 'Portal ', match: false },
      { text: 'Pedidos', match: true },
    ]);
  });

  it('encuentra todas las apariciones', () => {
    const partes = splitMatch('api de la api', 'api');
    expect(partes.filter((p) => p.match)).toHaveLength(2);
    expect(partes.map((p) => p.text).join('')).toBe('api de la api');
  });

  it('sin término devuelve el texto entero sin marcar', () => {
    expect(splitMatch('DevAtlas', '')).toEqual([{ text: 'DevAtlas', match: false }]);
  });
});
