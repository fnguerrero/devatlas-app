export interface AuthUser {
  id: number;
  email: string;
  name: string;
  picture: string | null;
}

export interface Client {
  id: number;
  name: string;
  color: string;
  appCount: number;
  /** Cliente archivado: sus apps no salen en el listado principal. */
  isHidden: boolean;
}

export type AppStatus = 'active' | 'paused' | 'deprecated';

/** Capa de la app. null = sin definir. */
export type AppLayer = 'frontend' | 'backend' | 'fullstack' | 'mobile';

export interface ApplicationListItem {
  // Guid: el id interno de la base nunca sale del backend.
  id: string;
  name: string;
  description: string | null;
  stack: string | null;
  repoPath: string | null;
  owner: string | null;
  layer: AppLayer | null;
  /** Servicio de un tercero: se cataloga y se chequea, pero no es código propio. */
  isExternal: boolean;
  status: AppStatus;
  clientId: number | null;
  clientName: string | null;
  clientColor: string | null;
  isFavorite: boolean;
  isArchived: boolean;
  urls: ApplicationUrl[];
  tags: string[];
}

export interface NameCount {
  name: string;
  count: number;
}

export interface Stats {
  total: number;
  favorites: number;
  archived: number;
  distinctStacks: number;
  distinctTags: number;
  byStack: NameCount[];
  topTags: NameCount[];
}

export interface ApplicationUrl {
  id: number;
  environment: string;
  color: string;
  url: string;
}

/** Resultado del chequeo de vida de una URL (se pide a demanda, nunca en background). */
export interface UrlHealth {
  id: number;
  status: 'up' | 'reachable' | 'error' | 'down' | 'unknown';
  httpStatus: number | null;
  elapsedMs: number;
  detail: string | null;
}

export interface AppEnvironment {
  id: number;
  name: string;
  sortOrder: number;
  color: string;
  urlCount: number;
}

export interface DatabaseConnection {
  id: number;
  environment: string;
  color: string;
  engine: string;
  host: string | null;
  port: number | null;
  databaseName: string | null;
  username: string | null;
  hasPassword: boolean;
  secretRef: string | null;
}

export interface UpsertDatabaseConnection {
  environment: string;
  engine: string;
  host: string;
  port: number | null;
  databaseName: string;
  username: string;
  password: string;
  clearPassword: boolean;
  secretRef: string;
}

export interface UpsertEnvironment {
  name: string;
  sortOrder: number;
  color: string;
}

export interface ApplicationDetail {
  id: string;
  name: string;
  description: string | null;
  repoPath: string | null;
  stack: string | null;
  notes: string | null;
  owner: string | null;
  layer: AppLayer | null;
  isExternal: boolean;
  status: AppStatus;
  clientId: number | null;
  clientName: string | null;
  clientColor: string | null;
  isFavorite: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  urls: ApplicationUrl[];
  databases: DatabaseConnection[];
  tags: string[];
}

export interface ApplicationUrlInput {
  environment: string;
  url: string;
}

export interface UpsertApplication {
  name: string;
  description: string;
  repoPath: string;
  stack: string;
  notes: string;
  owner: string;
  layer: AppLayer | '';
  isExternal: boolean;
  status: AppStatus;
  client: string;
  isFavorite: boolean;
  isArchived: boolean;
  urls: ApplicationUrlInput[];
  tags: string[];
}
