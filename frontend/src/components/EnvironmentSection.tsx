import { useCallback, useEffect, useState } from 'react';
import {
  createDatabase,
  createUrl,
  deleteDatabase,
  deleteUrl,
  getEnvironments,
  getUrlHealth,
  revealDatabasePassword,
  updateDatabase,
  updateUrl,
} from '../api/client';
import { copyText } from '../lib/appActions';
import { useUi } from '../context/UiContext';
import type {
  AppEnvironment,
  ApplicationUrl,
  DatabaseConnection,
  UpsertDatabaseConnection,
  UrlHealth,
} from '../types/application';

const ENGINES = ['postgres', 'mysql', 'sqlserver', 'sqlite', 'mongodb', 'oracle', 'redis', 'other'];

const EyeIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

type DetailView = 'by-env' | 'by-resource';

// El chequeo dice si el servidor está vivo, no si la app "está activa": eso último
// es el estado que se carga a mano en la ficha.
const HEALTH_LABEL: Record<UrlHealth['status'], string> = {
  up: 'Responde bien',
  reachable: 'Servidor vivo, pero esa ruta no devuelve contenido',
  error: 'Responde con error',
  down: 'No responde',
  unknown: 'No chequeada',
};

// Cualquier dato de la conexión se copia con un click: es lo que uno hace con
// un host o un usuario apenas lo mira.
function CopyValue({ value, label }: { value: string; label: string }) {
  const { toast } = useUi();

  async function copiar() {
    if (await copyText(value)) toast(`${label} copiado.`);
    else toast('El navegador no dejó copiar al portapapeles.', 'error');
  }

  return (
    <button type="button" className="copy-value" onClick={copiar} title={`Copiar ${label.toLowerCase()}`}>
      {value}
    </button>
  );
}

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

function HealthDot({ health }: { health?: UrlHealth }) {
  if (!health) return <span className="health-dot health-pending" title="Sin chequear" />;
  const detail = [
    HEALTH_LABEL[health.status],
    health.httpStatus ? `HTTP ${health.httpStatus}` : health.detail,
    `${health.elapsedMs} ms`,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <span className="health-mark" title={detail}>
      <span className={`health-dot health-${health.status}`} />
      {/* El código va a la vista: si no, hay que pasar el mouse para entender el color. */}
      {health.httpStatus ? <small className="health-code">{health.httpStatus}</small> : null}
    </span>
  );
}

type DbDraft = UpsertDatabaseConnection & { enabled: boolean; existingId?: number };

const emptyDbDraft = (environment = ''): DbDraft => ({
  environment,
  engine: 'postgres',
  host: '',
  port: null,
  databaseName: '',
  username: '',
  password: '',
  clearPassword: false,
  secretRef: '',
  enabled: false,
  existingId: undefined,
});

interface EnvBlock {
  name: string;
  color: string;
  urls: ApplicationUrl[];
  db?: DatabaseConnection;
}

interface Props {
  appId: string;
  urls: ApplicationUrl[];
  databases: DatabaseConnection[];
  onChange: () => void;
}

export default function EnvironmentSection({ appId, urls, databases, onChange }: Props) {
  const [environments, setEnvironments] = useState<AppEnvironment[]>([]);
  const [view, setView] = useState<DetailView>(
    () => (localStorage.getItem('devatlas.detailView') as DetailView) || 'by-env',
  );
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<number, string>>({});

  // Estado de vida de cada URL. Se pide una vez al abrir la app y cuando se toca
  // el botón de refrescar: no hay polling ni chequeos periódicos.
  const [health, setHealth] = useState<Record<number, UrlHealth>>({});
  const [checking, setChecking] = useState(false);
  const { toast } = useUi();

  // Editor de ambiente
  const [editing, setEditing] = useState<{ mode: 'existing' | 'new'; env: string } | null>(null);
  const [urlDrafts, setUrlDrafts] = useState<{ id?: number; url: string }[]>([]);
  const [dbDraft, setDbDraft] = useState<DbDraft>(emptyDbDraft());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getEnvironments().then(setEnvironments).catch(() => {});
  }, []);

  const checkHealth = useCallback(
    (signal?: AbortSignal) => {
      if (urls.length === 0) return;
      setChecking(true);
      getUrlHealth(appId, signal)
        .then((rows) => setHealth(Object.fromEntries(rows.map((r) => [r.id, r]))))
        .catch(() => {})
        .finally(() => setChecking(false));
    },
    [appId, urls.length],
  );

  useEffect(() => {
    const controller = new AbortController();
    checkHealth(controller.signal);
    return () => controller.abort();
  }, [checkHealth]);
  useEffect(() => {
    localStorage.setItem('devatlas.detailView', view);
  }, [view]);

  // Agrupa URLs + BD por ambiente, ordenado según el catálogo.
  const order = new Map(environments.map((e) => [e.name, e.sortOrder]));
  const map = new Map<string, EnvBlock>();
  for (const u of urls) {
    const b = map.get(u.environment) ?? { name: u.environment, color: u.color, urls: [] };
    b.urls.push(u);
    map.set(u.environment, b);
  }
  for (const d of databases) {
    const b = map.get(d.environment) ?? { name: d.environment, color: d.color, urls: [] };
    b.db = d;
    map.set(d.environment, b);
  }
  const blocks = [...map.values()].sort((a, b) => (order.get(a.name) ?? 999) - (order.get(b.name) ?? 999));
  const usedEnvs = new Set(blocks.map((b) => b.name));

  function openEditor(b: EnvBlock) {
    setEditing({ mode: 'existing', env: b.name });
    setUrlDrafts(b.urls.map((u) => ({ id: u.id, url: u.url })));
    setDbDraft(
      b.db
        ? {
            environment: b.name,
            engine: b.db.engine,
            host: b.db.host ?? '',
            port: b.db.port,
            databaseName: b.db.databaseName ?? '',
            username: b.db.username ?? '',
            password: '',
            clearPassword: false,
            secretRef: b.db.secretRef ?? '',
            enabled: true,
            existingId: b.db.id,
          }
        : emptyDbDraft(b.name),
    );
    setError(null);
  }

  function openNew() {
    setEditing({ mode: 'new', env: '' });
    setUrlDrafts([{ url: '' }]);
    setDbDraft(emptyDbDraft(''));
    setError(null);
  }

  function closeEditor() {
    setEditing(null);
    setError(null);
  }

  async function reveal(db: DatabaseConnection) {
    if (revealed[db.id] !== undefined) {
      setRevealed((r) => {
        const n = { ...r };
        delete n[db.id];
        return n;
      });
      return;
    }
    try {
      const res = await revealDatabasePassword(appId, db.id);
      setRevealed((r) => ({ ...r, [db.id]: res.password ?? '(sin password)' }));
    } catch {
      setError('No se pudo revelar la contraseña.');
    }
  }

  // Copia la password al portapapeles sin dejarla visible en pantalla.
  async function copiarPassword(db: DatabaseConnection) {
    try {
      const res = await revealDatabasePassword(appId, db.id);
      if (!res.password) {
        toast('Esta conexión no tiene password guardada.', 'info');
        return;
      }
      if (await copyText(res.password)) toast('Password copiada.');
      else toast('El navegador no dejó copiar al portapapeles.', 'error');
    } catch {
      toast('No se pudo leer la contraseña.', 'error');
    }
  }

  async function saveEditor(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const envName = editing.mode === 'new' ? editing.env.trim() : editing.env;
    if (!envName) return setError('Elegí un ambiente.');
    setSaving(true);
    setError(null);
    try {
      const original = blocks.find((b) => b.name === envName);
      const originalUrls = original?.urls ?? [];

      // URLs: borrar las quitadas, actualizar las cambiadas, crear las nuevas.
      const draftIds = new Set(urlDrafts.filter((d) => d.id).map((d) => d.id));
      for (const ou of originalUrls) {
        if (!draftIds.has(ou.id)) await deleteUrl(appId, ou.id);
      }
      for (const d of urlDrafts) {
        const url = d.url.trim();
        if (!url) continue;
        if (d.id) {
          const orig = originalUrls.find((o) => o.id === d.id);
          if (orig && orig.url !== url) await updateUrl(appId, d.id, { environment: envName, url });
        } else {
          await createUrl(appId, { environment: envName, url });
        }
      }

      // Base de datos.
      const payload: UpsertDatabaseConnection = { ...dbDraft, environment: envName };
      if (dbDraft.enabled) {
        if (dbDraft.existingId) await updateDatabase(appId, dbDraft.existingId, payload);
        else await createDatabase(appId, payload);
      } else if (dbDraft.existingId) {
        await deleteDatabase(appId, dbDraft.existingId);
      }

      closeEditor();
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el ambiente.');
    } finally {
      setSaving(false);
    }
  }

  function patchDb(p: Partial<DbDraft>) {
    setDbDraft((f) => ({ ...f, ...p }));
  }

  // ---- Render de solo lectura ----
  const dbReadOnly = (db: DatabaseConnection) => (
    <div className="env-db">
      <div className="env-db-top">
        <span className="db-engine">{db.engine}</span>
      </div>
      <dl className="kv">
        {(db.host || db.port) && (
          <>
            <dt>host</dt>
            <dd>
              <CopyValue value={`${db.host ?? ''}${db.port ? `:${db.port}` : ''}`} label="Host" />
            </dd>
          </>
        )}
        {db.databaseName && (
          <>
            <dt>base</dt>
            <dd>
              <CopyValue value={db.databaseName} label="Nombre de la base" />
            </dd>
          </>
        )}
        {db.username && (
          <>
            <dt>user</dt>
            <dd>
              <CopyValue value={db.username} label="Usuario" />
            </dd>
          </>
        )}
        {/* Si no hay password guardada no se muestra la fila: un campo vacío no dice nada. */}
        {db.hasPassword && (
          <>
            <dt>pass</dt>
            <dd>
              {revealed[db.id] !== undefined ? (
                <CopyValue value={revealed[db.id]} label="Password" />
              ) : (
                <code>••••••••</code>
              )}
              <button
                type="button"
                className="btn-eye"
                onClick={() => reveal(db)}
                title={revealed[db.id] !== undefined ? 'Ocultar' : 'Revelar'}
                aria-label={revealed[db.id] !== undefined ? 'Ocultar' : 'Revelar'}
              >
                {revealed[db.id] !== undefined ? <EyeOffIcon /> : <EyeIcon />}
              </button>
              {/* Copiar sin tener que mostrarla en pantalla. */}
              <button
                type="button"
                className="btn-eye"
                onClick={() => copiarPassword(db)}
                title="Copiar password sin mostrarla"
                aria-label="Copiar password"
              >
                <CopyIcon />
              </button>
            </dd>
          </>
        )}
        {db.secretRef && (
          <>
            <dt>secreto</dt>
            <dd>
              <CopyValue value={db.secretRef} label="Referencia al secreto" />
            </dd>
          </>
        )}
      </dl>
    </div>
  );

  return (
    <section className="env-section">
      <div className="env-section-head">
        <h2>{view === 'by-env' ? 'Ambientes' : 'Configuración'}</h2>
        <div className="env-head-actions">
          <div className="view-toggle">
            <button type="button" className={view === 'by-env' ? 'active' : ''} onClick={() => setView('by-env')}>
              Por ambiente
            </button>
            <button
              type="button"
              className={view === 'by-resource' ? 'active' : ''}
              onClick={() => setView('by-resource')}
            >
              Por recurso
            </button>
          </div>
          {urls.length > 0 && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => checkHealth()}
              disabled={checking}
              title="Hace un HEAD a cada URL para ver si responde"
            >
              {checking ? 'Chequeando…' : '↻ Chequear URLs'}
            </button>
          )}
          {!editing && view === 'by-env' && (
            <button type="button" className="btn-secondary" onClick={openNew}>
              + Ambiente
            </button>
          )}
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {/* Los colores del chequeo, explicados. Nada que ver con el estado de la ficha. */}
      {Object.keys(health).length > 0 && (
        <div className="health-legend">
          <span>
            <span className="health-dot health-up" /> responde bien
          </span>
          <span>
            <span className="health-dot health-reachable" /> vivo, pero esa ruta no devuelve contenido
          </span>
          <span>
            <span className="health-dot health-error" /> error o no responde
          </span>
        </div>
      )}

      {/* ---------- Vista por ambiente ---------- */}
      {view === 'by-env' &&
        (blocks.length === 0 && !editing ? (
          <p className="empty-state" style={{ padding: '1rem' }}>
            Sin URLs ni bases de datos configuradas.
          </p>
        ) : (
          <div className="env-groups">
            {blocks.map((b) => (
              <div className="env-group" key={b.name}>
                <div className="env-group-head" style={{ backgroundColor: b.color }}>
                  <span>{b.name}</span>
                  <button
                    type="button"
                    className="env-edit-btn"
                    title={`Editar ${b.name}`}
                    aria-label={`Editar ${b.name}`}
                    onClick={() => openEditor(b)}
                  >
                    ✎
                  </button>
                </div>
                <div className="env-group-body">
                  <div className="env-part">
                    <span className="env-part-label">URLs</span>
                    {b.urls.length > 0 ? (
                      <div className="url-rows">
                        {b.urls.map((u) => (
                          <span className="url-row" key={u.id}>
                            <HealthDot health={health[u.id]} />
                            <a href={u.url} target="_blank" rel="noreferrer">
                              {u.url}
                            </a>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="db-muted">sin URL</span>
                    )}
                  </div>
                  <div className="env-part">
                    <span className="env-part-label">Base de datos</span>
                    {b.db ? dbReadOnly(b.db) : <span className="db-muted">sin base</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}

      {/* ---------- Vista por recurso (solo lectura) ---------- */}
      {view === 'by-resource' && (
        <div className="by-resource">
          <h3 className="res-title">URLs por ambiente</h3>
          {urls.length > 0 ? (
            <ul className="url-list">
              {urls.map((u) => (
                <li key={u.id}>
                  <span className="env-badge" style={{ backgroundColor: u.color, color: '#fff' }}>
                    {u.environment}
                  </span>
                  <HealthDot health={health[u.id]} />
                  <a href={u.url} target="_blank" rel="noreferrer">
                    {u.url}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="db-muted">Sin URLs.</p>
          )}

          <h3 className="res-title">Bases de datos</h3>
          {databases.length > 0 ? (
            <div className="db-list">
              {databases.map((db) => (
                <div className="db-card" key={db.id}>
                  <div className="db-card-stack">
                    <span className="env-badge" style={{ backgroundColor: db.color, color: '#fff' }}>
                      {db.environment}
                    </span>
                    {dbReadOnly(db)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="db-muted">Sin conexiones.</p>
          )}
          <p className="db-note">La edición se hace desde la vista "Por ambiente".</p>
        </div>
      )}

      {/* ---------- Editor de ambiente ---------- */}
      {editing && (
        <form className="db-form env-editor" onSubmit={saveEditor}>
          <h3>{editing.mode === 'new' ? 'Nuevo ambiente' : `Editar ambiente: ${editing.env}`}</h3>

          {editing.mode === 'new' && (
            <label className="editor-env-select">
              Ambiente
              <select
                value={editing.env}
                onChange={(e) => setEditing({ mode: 'new', env: e.target.value })}
              >
                <option value="">Elegí un ambiente…</option>
                {environments
                  .filter((e) => !usedEnvs.has(e.name))
                  .map((e) => (
                    <option key={e.id} value={e.name}>
                      {e.name}
                    </option>
                  ))}
              </select>
            </label>
          )}

          <div className="editor-section">
            <span className="env-part-label">URLs</span>
            {urlDrafts.map((d, i) => (
              <div className="editor-url-row" key={i}>
                <input
                  value={d.url}
                  placeholder="https://..."
                  onChange={(e) =>
                    setUrlDrafts((list) => list.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))
                  }
                />
                <button
                  type="button"
                  className="btn-icon"
                  title="Quitar esta URL"
                  aria-label="Quitar esta URL"
                  onClick={() => setUrlDrafts((list) => list.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              </div>
            ))}
            <button type="button" className="btn-link" onClick={() => setUrlDrafts((l) => [...l, { url: '' }])}>
              + agregar URL
            </button>
          </div>

          <div className="editor-section">
            <label className="editor-db-toggle">
              <input
                type="checkbox"
                checked={dbDraft.enabled}
                onChange={(e) => patchDb({ enabled: e.target.checked })}
              />
              Base de datos
            </label>
            {dbDraft.enabled && (
              <>
                <div className="db-form-grid">
                  <label>
                    Motor
                    <select value={dbDraft.engine} onChange={(e) => patchDb({ engine: e.target.value })}>
                      {ENGINES.map((eng) => (
                        <option key={eng} value={eng}>
                          {eng}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Host
                    <input value={dbDraft.host} onChange={(e) => patchDb({ host: e.target.value })} />
                  </label>
                  <label>
                    Puerto
                    <input
                      type="number"
                      value={dbDraft.port ?? ''}
                      onChange={(e) => patchDb({ port: e.target.value ? Number(e.target.value) : null })}
                    />
                  </label>
                  <label>
                    Nombre de base
                    <input value={dbDraft.databaseName} onChange={(e) => patchDb({ databaseName: e.target.value })} />
                  </label>
                  <label>
                    Usuario
                    <input value={dbDraft.username} onChange={(e) => patchDb({ username: e.target.value })} />
                  </label>
                  <label>
                    Password {dbDraft.existingId && <span className="db-muted">(vacío = sin cambios)</span>}
                    <input
                      type="password"
                      value={dbDraft.password}
                      onChange={(e) => patchDb({ password: e.target.value })}
                      placeholder={dbDraft.existingId ? '••••••••' : ''}
                      autoComplete="new-password"
                    />
                  </label>
                  <label>
                    Referencia al vault
                    <input
                      value={dbDraft.secretRef}
                      onChange={(e) => patchDb({ secretRef: e.target.value })}
                      placeholder="Bitwarden: proyecto/db"
                    />
                  </label>
                </div>
                <p className="db-note">
                  🔒 La password se guarda cifrada; nunca se muestra salvo que toques "revelar".
                </p>
              </>
            )}
          </div>

          <div className="db-form-actions">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button type="button" className="btn-secondary" onClick={closeEditor}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
