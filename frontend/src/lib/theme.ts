export type Theme = 'light' | 'dark' | 'auto';

const KEY = 'devatlas.theme';

export function getTheme(): Theme {
  return (localStorage.getItem(KEY) as Theme) || 'auto';
}

// 'auto' quita el override para que valga el media query del SO.
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'auto') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

export function setTheme(theme: Theme) {
  localStorage.setItem(KEY, theme);
  applyTheme(theme);
}

/** Qué tema se está viendo de verdad: 'auto' resuelve contra la preferencia del sistema. */
export function resolveTheme(theme: Theme = getTheme()): 'light' | 'dark' {
  if (theme !== 'auto') return theme;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Color de la barra del navegador (móvil y PWA). Sin esto la barra queda blanca
// contra una app en oscuro, que es justo el borde que se nota.
const COLOR_DE_FONDO = { light: '#f5f6f8', dark: '#14161c' } as const;

export function applyThemeColor(theme: Theme = getTheme()) {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = COLOR_DE_FONDO[resolveTheme(theme)];
}

/**
 * Mantiene la app al día con el sistema mientras esté en 'auto'. Devuelve la función
 * para desuscribirse.
 */
export function watchSystemTheme(onChange: (efectivo: 'light' | 'dark') => void): () => void {
  const media = window.matchMedia?.('(prefers-color-scheme: dark)');
  if (!media) return () => {};

  const handler = () => {
    if (getTheme() === 'auto') onChange(media.matches ? 'dark' : 'light');
  };
  media.addEventListener?.('change', handler);
  return () => media.removeEventListener?.('change', handler);
}
