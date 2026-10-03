import type { AppLayer, AppStatus } from '../types/application';

// Etiqueta y color de cada estado de aplicación.
export const STATUS_META: Record<AppStatus, { label: string; color: string }> = {
  active: { label: 'Activa', color: '#16a34a' },
  paused: { label: 'En pausa', color: '#d97706' },
  deprecated: { label: 'Deprecada', color: '#6b7280' },
};

export const STATUS_OPTIONS: AppStatus[] = ['active', 'paused', 'deprecated'];

// Capa de la aplicación: reemplaza la aproximación por tags (backend/frontend/fullstack).
export const LAYER_META: Record<AppLayer, { label: string; short: string; color: string }> = {
  frontend: { label: 'Frontend', short: 'FE', color: '#0891b2' },
  backend: { label: 'Backend', short: 'BE', color: '#7c3aed' },
  fullstack: { label: 'Fullstack', short: 'FS', color: '#db2777' },
  mobile: { label: 'Mobile', short: 'MB', color: '#ea580c' },
};

export const LAYER_OPTIONS: AppLayer[] = ['frontend', 'backend', 'fullstack', 'mobile'];

// Utilidades para las acciones rápidas de las cards.

const STACK_ICONS: [RegExp, string][] = [
  [/\.net|c#|asp|blazor/i, '🟣'],
  [/react/i, '⚛️'],
  [/vue/i, '💚'],
  [/angular/i, '🅰️'],
  [/node/i, '🟩'],
  [/python|django|flask|fastapi/i, '🐍'],
  [/java(?!script)/i, '☕'],
  [/php|laravel/i, '🐘'],
  [/\bgo\b|golang/i, '🐹'],
  [/rust/i, '🦀'],
  [/html|css|javascript|\bjs\b|vite|svelte/i, '🌐'],
  [/sql|postgres|mysql|sqlite|mongo/i, '🗄️'],
];

export function stackIcon(stack: string | null): string {
  if (!stack) return '📦';
  const found = STACK_ICONS.find(([re]) => re.test(stack));
  return found ? found[1] : '📦';
}

export function isUrl(value: string | null | undefined): boolean {
  return !!value && /^https?:\/\//i.test(value.trim());
}

export function openUrl(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

export async function copyText(text: string): Promise<boolean> {
  // La Clipboard API sólo existe en contexto seguro: si la app se sirve por IP
  // en vez de localhost, no está. De ahí el fallback al textarea + execCommand.
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // permiso denegado o sin gesto de usuario: se intenta el camino viejo
  }

  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}
