/**
 * Apps abiertas últimamente. Se guarda en localStorage porque es preferencia de esta
 * máquina, no del catálogo: no tiene por qué viajar al backend ni sincronizarse.
 */

const KEY = 'devatlas.recent';
const MAX = 6;

export interface RecentApp {
  id: string;
  name: string;
}

export function getRecent(): RecentApp[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((a) => a?.id && a?.name).slice(0, MAX) : [];
  } catch {
    // JSON corrupto (edición a mano, versión vieja): se descarta en vez de romper la página.
    return [];
  }
}

export function pushRecent(app: RecentApp) {
  const previas = getRecent().filter((a) => a.id !== app.id);
  const lista = [{ id: app.id, name: app.name }, ...previas].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(lista));
}

export function clearRecent() {
  localStorage.removeItem(KEY);
}
