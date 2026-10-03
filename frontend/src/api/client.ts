import type {
  AppEnvironment,
  ApplicationDetail,
  ApplicationListItem,
  ApplicationUrl,
  AuthUser,
  Client,
  DatabaseConnection,
  Stats,
  UpsertApplication,
  UpsertDatabaseConnection,
  UpsertEnvironment,
  UrlHealth,
} from '../types/application';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5142/api';

const TOKEN_KEY = 'devatlas.token';
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// Workspace activo: el propio, o el demo (datos de prueba compartidos).
// El backend sólo lo acepta con una sesión válida.
const WORKSPACE_KEY = 'devatlas.workspace';
export const DEMO_WORKSPACE = 'demo';
export const getWorkspace = () => localStorage.getItem(WORKSPACE_KEY);
export const setWorkspace = (w: string | null) =>
  w ? localStorage.setItem(WORKSPACE_KEY, w) : localStorage.removeItem(WORKSPACE_KEY);
export const isDemoWorkspace = () => getWorkspace() === DEMO_WORKSPACE;

// Se dispara cuando el backend rechaza el token: la app vuelve al login.
type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler = () => {};
export const setUnauthorizedHandler = (handler: UnauthorizedHandler) => {
  onUnauthorized = handler;
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const { body } = await requestWithHeaders<T>(path, options);
  return body;
}

async function requestWithHeaders<T>(
  path: string,
  options?: RequestInit,
): Promise<{ body: T; headers: Headers }> {
  const token = getToken();
  const workspace = getWorkspace();
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(workspace ? { 'X-DevAtlas-Workspace': workspace } : {}),
      ...options?.headers,
    },
  });

  if (response.status === 401) {
    clearToken();
    setWorkspace(null);
    onUnauthorized();
    throw new Error('Tu sesión venció. Volvé a entrar con Google.');
  }

  if (!response.ok) {
    let message = `Error ${response.status} en la solicitud.`;
    try {
      const problem = await response.json();
      if (problem?.errors) {
        message = Object.values(problem.errors as Record<string, string[]>).flat().join(' ');
      } else if (problem?.title) {
        message = problem.title;
      }
    } catch {
      // respuesta sin cuerpo JSON: se mantiene el mensaje por defecto
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return { body: undefined as T, headers: response.headers };
  }

  return { body: (await response.json()) as T, headers: response.headers };
}

export interface ApplicationQuery {
  search?: string;
  tag?: string;
  sort?: string;
  clientId?: number;
  layer?: string;
  origin?: string;
  status?: string;
  favorite?: boolean;
  page?: number;
  pageSize?: number;
  includeHidden?: boolean;
}

export function buildApplicationQuery(params?: ApplicationQuery): string {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.tag) query.set('tag', params.tag);
  if (params?.sort) query.set('sort', params.sort);
  if (params?.clientId) query.set('clientId', String(params.clientId));
  if (params?.layer) query.set('layer', params.layer);
  if (params?.origin) query.set('origin', params.origin);
  if (params?.status) query.set('status', params.status);
  if (params?.favorite) query.set('favorite', 'true');
  if (params?.page && params.page > 1) query.set('page', String(params.page));
  if (params?.pageSize) query.set('pageSize', String(params.pageSize));
  if (params?.includeHidden) query.set('includeHidden', 'true');
  return query.toString();
}

export function getApplications(
  params?: ApplicationQuery,
  signal?: AbortSignal,
): Promise<{ items: ApplicationListItem[]; total: number }> {
  const qs = buildApplicationQuery(params);
  return requestWithHeaders<ApplicationListItem[]>(`/applications${qs ? `?${qs}` : ''}`, { signal }).then(
    ({ body, headers }) => ({
      items: body,
      // El backend pagina siempre; el total viaja aparte para poder avisar si quedó recortado.
      total: Number(headers.get('X-Total-Count') ?? body.length),
    }),
  );
}

export function loginWithGoogle(credential: string) {
  return request<{ token: string; user: AuthUser }>('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ credential }),
  });
}

export function getMe() {
  return request<AuthUser>('/auth/me');
}

export function getClients() {
  return request<Client[]>('/clients');
}

export function createClient(payload: { name: string; color: string; isHidden?: boolean }) {
  return request<Client>('/clients', { method: 'POST', body: JSON.stringify(payload) });
}

export function updateClient(id: number, payload: { name: string; color: string; isHidden?: boolean }) {
  return request<Client>(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export function deleteClient(id: number) {
  return request<void>(`/clients/${id}`, { method: 'DELETE' });
}

export function createUrl(appId: string, payload: { environment: string; url: string }) {
  return request<ApplicationUrl>(`/applications/${appId}/urls`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateUrl(appId: string, id: number, payload: { environment: string; url: string }) {
  return request<ApplicationUrl>(`/applications/${appId}/urls/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteUrl(appId: string, id: number) {
  return request<void>(`/applications/${appId}/urls/${id}`, { method: 'DELETE' });
}

// Chequea las URLs de la app contra sus servidores (HEAD, timeout corto, sin reintentos).
export function getUrlHealth(appId: string, signal?: AbortSignal) {
  return request<UrlHealth[]>(`/applications/${appId}/urls/health`, { signal });
}

export function createDatabase(appId: string, payload: UpsertDatabaseConnection) {
  return request<DatabaseConnection>(`/applications/${appId}/databases`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateDatabase(appId: string, id: number, payload: UpsertDatabaseConnection) {
  return request<DatabaseConnection>(`/applications/${appId}/databases/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteDatabase(appId: string, id: number) {
  return request<void>(`/applications/${appId}/databases/${id}`, { method: 'DELETE' });
}

export function revealDatabasePassword(appId: string, id: number) {
  return request<{ password: string | null }>(`/applications/${appId}/databases/${id}/reveal`);
}

export function setFavorite(id: string, value: boolean) {
  return request<void>(`/applications/${id}/favorite`, {
    method: 'PATCH',
    body: JSON.stringify(value),
  });
}

export function setArchived(id: string, value: boolean) {
  return request<void>(`/applications/${id}/archive`, {
    method: 'PATCH',
    body: JSON.stringify(value),
  });
}

export function getApplication(id: string) {
  return request<ApplicationDetail>(`/applications/${id}`);
}

export function createApplication(payload: UpsertApplication) {
  return request<ApplicationDetail>('/applications', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateApplication(id: string, payload: UpsertApplication) {
  return request<ApplicationDetail>(`/applications/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteApplication(id: string) {
  return request<void>(`/applications/${id}`, { method: 'DELETE' });
}

/** Copia una app con sus URLs y tags. Las conexiones a bases no se copian. */
export function duplicateApplication(id: string) {
  return request<ApplicationDetail>(`/applications/${id}/duplicate`, { method: 'POST' });
}

export type BulkAction = 'archive' | 'unarchive' | 'favorite' | 'unfavorite' | 'delete';

export function bulkApplications(ids: string[], action: BulkAction) {
  return request<{ affected: number; notFound: number }>('/applications/bulk', {
    method: 'POST',
    body: JSON.stringify({ ids, action }),
  });
}

/**
 * El CSV va autenticado, así que no alcanza con un `<a href>`: se baja con el token y se
 * entrega como blob.
 */
export async function downloadApplicationsCsv(params?: ApplicationQuery): Promise<Blob> {
  const qs = buildApplicationQuery(params);
  const response = await fetch(`${BASE_URL}/applications/export.csv${qs ? `?${qs}` : ''}`, {
    headers: {
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...(getWorkspace() ? { 'X-DevAtlas-Workspace': getWorkspace()! } : {}),
    },
  });

  if (!response.ok) throw new Error(`No se pudo exportar el catálogo (error ${response.status}).`);
  return response.blob();
}

// --- Backup del workspace ---

export interface ImportResult {
  applicationsCreated: number;
  applicationsSkipped: number;
  clientsCreated: number;
  environmentsCreated: number;
}

export function exportBackup() {
  return request<unknown>('/backup/export');
}

export function importBackup(backup: unknown, mode: 'merge' | 'replace') {
  return request<ImportResult>('/backup/import', {
    method: 'POST',
    body: JSON.stringify({ backup, mode }),
  });
}

export function getTags() {
  return request<string[]>('/applications/tags');
}

export function getStats() {
  return request<Stats>('/applications/stats');
}

export function getEnvironments() {
  return request<AppEnvironment[]>('/environments');
}

export function createEnvironment(payload: UpsertEnvironment) {
  return request<AppEnvironment>('/environments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateEnvironment(id: number, payload: UpsertEnvironment) {
  return request<AppEnvironment>(`/environments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteEnvironment(id: number) {
  return request<void>(`/environments/${id}`, { method: 'DELETE' });
}
