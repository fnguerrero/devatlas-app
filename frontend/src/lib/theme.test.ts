import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, applyThemeColor, getTheme, resolveTheme, setTheme, watchSystemTheme } from './theme';

/** matchMedia de mentira, para poder decir qué prefiere "el sistema" en cada caso. */
function sistemaEnOscuro(oscuro: boolean) {
  const listeners: (() => void)[] = [];
  const media = {
    matches: oscuro,
    addEventListener: (_: string, cb: () => void) => listeners.push(cb),
    removeEventListener: () => {},
  };
  window.matchMedia = vi.fn().mockReturnValue(media) as unknown as typeof window.matchMedia;
  return {
    cambiarA(nuevoOscuro: boolean) {
      media.matches = nuevoOscuro;
      listeners.forEach((cb) => cb());
    },
  };
}

beforeEach(() => {
  document.documentElement.removeAttribute('data-theme');
  document.querySelector('meta[name="theme-color"]')?.remove();
});

describe('theme', () => {
  it('sin preferencia guardada queda en automático', () => {
    expect(getTheme()).toBe('auto');
  });

  it('guarda la preferencia y la escribe en el html', () => {
    setTheme('dark');

    expect(getTheme()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('el automático saca el override para que mande el sistema', () => {
    setTheme('dark');
    applyTheme('auto');

    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('resuelve el automático contra la preferencia del sistema', () => {
    sistemaEnOscuro(true);
    expect(resolveTheme('auto')).toBe('dark');

    sistemaEnOscuro(false);
    expect(resolveTheme('auto')).toBe('light');

    // Una preferencia explícita gana sobre el sistema.
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('pinta la barra del navegador del color del fondo', () => {
    sistemaEnOscuro(true);
    applyThemeColor('auto');

    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#14161c');

    applyThemeColor('light');
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#f5f6f8');
  });

  it('en automático sigue los cambios del sistema; con tema fijo los ignora', () => {
    const sistema = sistemaEnOscuro(false);
    const avisos: string[] = [];
    watchSystemTheme((efectivo) => avisos.push(efectivo));

    sistema.cambiarA(true);
    expect(avisos).toEqual(['dark']);

    setTheme('light');
    sistema.cambiarA(false);
    expect(avisos).toEqual(['dark']); // no se agregó nada: la preferencia es explícita
  });
});
