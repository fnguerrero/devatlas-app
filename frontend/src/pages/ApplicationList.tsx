import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  downloadApplicationsCsv,
  duplicateApplication,
  getApplications,
  getClients,
  getStats,
  getTags,
  setArchived,
  setFavorite,
} from '../api/client';
import type { ApplicationListItem, Client, Stats } from '../types/application';
import { copyText, isUrl, openUrl, stackIcon, LAYER_META, LAYER_OPTIONS, STATUS_META } from '../lib/appActions';
import { getRecent } from '../lib/recent';
import { useShortcuts } from '../lib/useShortcuts';
import { useUi } from '../context/UiContext';
import AuthButton from '../components/AuthButton';
import AppCardMenu, { type CardAction } from '../components/AppCardMenu';
import BackToTop from '../components/BackToTop';
import Highlight from '../components/Highlight';
import {
  ClientsIcon,
  EnvironmentsIcon,
  PlusIcon,
  RepoIcon,
  ReportIcon,
  SettingsIcon,
} from '../components/Icons';

type View = 'grid' | 'list';
type Sort = 'name' | 'updated' | 'created';

const SORT_LABELS: Record<Sort, string> = {
  name: 'Nombre',
  updated: 'Última edición',
  created: 'Más recientes',
};

// Página chica a propósito: el listado entra de una en la mayoría de los casos y, cuando
// no, "cargar más" es más barato que traer cientos de cards que nadie va a mirar.
const PAGE_SIZE = 24;

export default function ApplicationList() {
  const navigate = useNavigate();
  const { toast } = useUi();

  // Los filtros viven en la URL: así el estado del listado se puede compartir, marcar
  // como favorito del navegador y sobrevive a un F5.
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const activeTag = params.get('tag');
  const activeClientId = params.get('cliente') ? Number(params.get('cliente')) : null;
  const activeLayer = params.get('capa');
  const activeOrigin = params.get('origen');
  const sort = (params.get('orden') as Sort) ?? 'name';
  const includeHidden = params.get('ocultas') === '1';

  const [apps, setApps] = useState<ApplicationListItem[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [view, setView] = useState<View>(() => (localStorage.getItem('devatlas.view') as View) || 'grid');
  // Son pocas aplicaciones: comprimidas entran todas en pantalla, que es como se
  // usa normalmente. El modo cómodo queda para cuando se quiere leer el detalle.
  const [compact, setCompact] = useState(
    () => localStorage.getItem('devatlas.compact') !== 'false',
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [recientes] = useState(() => getRecent());
  // Los filtros son cuatro filas de chips: se pliegan para no comerse la pantalla
  // antes de llegar a las apps, que es lo que uno viene a ver.
  const [filtersOpen, setFiltersOpen] = useState(
    () => localStorage.getItem('devatlas.filtersOpen') === 'true',
  );

  const searchInput = useRef<HTMLInputElement>(null);

  const activeFilters = [activeTag, activeOrigin, activeLayer, activeClientId].filter(
    (f) => f !== null,
  ).length;

  // Cambiar un filtro reescribe la URL y vuelve a la primera página: quedarse en la
  // página 3 de otro filtro muestra un vacío que parece un error.
  const setParam = useCallback(
    (key: string, value: string | null) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value === null || value === '') next.delete(key);
          else next.set(key, value);
          return next;
        },
        { replace: true },
      );
      setPage(1);
    },
    [setParams],
  );

  const toggleParam = (key: string, value: string) =>
    setParam(key, params.get(key) === value ? null : value);

  function toggleFilters() {
    setFiltersOpen((open) => {
      localStorage.setItem('devatlas.filtersOpen', String(!open));
      return !open;
    });
  }

  const refreshMeta = useCallback(() => {
    getTags().then(setTags).catch(() => {});
    getStats().then(setStats).catch(() => {});
    getClients().then(setClients).catch(() => {});
  }, []);

  useEffect(() => {
    refreshMeta();
  }, [refreshMeta]);

  useEffect(() => {
    localStorage.setItem('devatlas.view', view);
  }, [view]);

  useEffect(() => {
    localStorage.setItem('devatlas.compact', String(compact));
  }, [compact]);

  const query = useMemo(
    () => ({
      search,
      tag: activeTag ?? undefined,
      sort,
      clientId: activeClientId ?? undefined,
      layer: activeLayer ?? undefined,
      origin: activeOrigin ?? undefined,
      includeHidden,
    }),
    [search, activeTag, sort, activeClientId, activeLayer, activeOrigin, includeHidden],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      setLoading(true);
      setError(null);
      getApplications({ ...query, page, pageSize: PAGE_SIZE }, controller.signal)
        .then(({ items, total }) => {
          // La primera página reemplaza; las siguientes se agregan abajo.
          setApps((prev) => (page === 1 ? items : [...prev, ...items]));
          setTotal(total);
        })
        .catch((err) => {
          if (err.name !== 'AbortError') {
            setError('No se pudo conectar con la API. ¿Está corriendo el backend?');
          }
        })
        .finally(() => setLoading(false));
    }, 250);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, page]);

  useShortcuts({
    '/': () => searchInput.current?.focus(),
    n: () => navigate('/apps/new'),
    g: () => setView((v) => (v === 'grid' ? 'list' : 'grid')),
    '?': () => setShowHelp((v) => !v),
    escape: () => setShowHelp(false),
  });

  async function toggleFavorite(e: React.MouseEvent, app: ApplicationListItem) {
    e.preventDefault();
    e.stopPropagation();
    const value = !app.isFavorite;
    setApps((prev) => prev.map((a) => (a.id === app.id ? { ...a, isFavorite: value } : a)));
    try {
      await setFavorite(app.id, value);
      refreshMeta();
    } catch (err) {
      setApps((prev) => prev.map((a) => (a.id === app.id ? { ...a, isFavorite: !value } : a)));
      toast((err as Error).message, 'error');
    }
  }

  function openLink(e: React.MouseEvent, url: string) {
    e.preventDefault();
    e.stopPropagation();
    openUrl(url);
  }

  async function handleRepo(e: React.MouseEvent, app: ApplicationListItem) {
    e.preventDefault();
    e.stopPropagation();
    if (!app.repoPath) return;
    if (isUrl(app.repoPath)) {
      openUrl(app.repoPath);
    } else if (await copyText(app.repoPath)) {
      setCopiedId(app.id);
      setTimeout(() => setCopiedId((id) => (id === app.id ? null : id)), 1500);
    }
  }

  async function toggleArchived(app: ApplicationListItem) {
    const value = !app.isArchived;
    try {
      await setArchived(app.id, value);
      // Si dejamos de mostrar archivadas y esta pasó a archivada, se saca del listado.
      if (value && !includeHidden) {
        setApps((prev) => prev.filter((a) => a.id !== app.id));
      } else {
        setApps((prev) => prev.map((a) => (a.id === app.id ? { ...a, isArchived: value } : a)));
      }
      toast(value ? `"${app.name}" archivada.` : `"${app.name}" desarchivada.`);
      refreshMeta();
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  async function handleDuplicate(app: ApplicationListItem) {
    try {
      const copia = await duplicateApplication(app.id);
      toast(`Se creó "${copia.name}".`);
      navigate(`/apps/${copia.id}/edit`);
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  // Abrir de una todos los ambientes de una app: el caso típico es comparar Test contra Prod.
  function openAllUrls(app: ApplicationListItem) {
    if (app.urls.length === 0) return;
    app.urls.forEach((u) => openUrl(u.url));
  }

  async function copyUrls(app: ApplicationListItem) {
    const texto = app.urls.map((u) => `${u.environment}: ${u.url}`).join('\n');
    if (await copyText(texto)) toast('URLs copiadas.');
    else toast('No se pudieron copiar las URLs.', 'error');
  }

  async function handleExport() {
    try {
      const blob = await downloadApplicationsCsv({ ...query, pageSize: 500 });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `devatlas-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast('Catálogo exportado.');
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  function limpiarFiltros() {
    setParams(new URLSearchParams(), { replace: true });
    setPage(1);
  }

  // Chips de lo que está filtrando ahora mismo, para poder soltarlos de a uno sin
  // tener que abrir el panel y acordarse de qué se había tocado.
  const filtrosActivos: { key: string; label: string }[] = [];
  if (search) filtrosActivos.push({ key: 'q', label: `Busca: "${search}"` });
  if (activeTag) filtrosActivos.push({ key: 'tag', label: `Tag: ${activeTag}` });
  if (activeLayer) filtrosActivos.push({ key: 'capa', label: `Capa: ${LAYER_META[activeLayer as keyof typeof LAYER_META]?.label ?? activeLayer}` });
  if (activeOrigin) filtrosActivos.push({ key: 'origen', label: activeOrigin === 'own' ? 'Origen: propias' : 'Origen: externas' });
  if (activeClientId) {
    const cliente = clients.find((c) => c.id === activeClientId);
    filtrosActivos.push({ key: 'cliente', label: `Cliente: ${cliente?.name ?? activeClientId}` });
  }

  // Las apps propias y los servicios de terceros son cosas distintas: van separados,
  // salvo que el filtro de origen ya esté acotando a uno de los dos.
  const propias = apps.filter((a) => !a.isExternal);
  const externas = apps.filter((a) => a.isExternal);
  const grupos =
    activeOrigin === 'own'
      ? [{ titulo: 'Aplicaciones', items: propias }]
      : activeOrigin === 'external'
        ? [{ titulo: 'Servicios externos', items: externas }]
        : [
            { titulo: 'Aplicaciones', items: propias },
            { titulo: 'Servicios externos', items: externas },
          ];

  const hayMas = apps.length < total;

  function accionesDe(app: ApplicationListItem): CardAction[] {
    const acciones: CardAction[] = [
      { label: app.isArchived ? 'Desarchivar' : 'Archivar', onSelect: () => toggleArchived(app) },
      { label: 'Duplicar', onSelect: () => handleDuplicate(app) },
    ];
    if (app.urls.length > 0) {
      acciones.push(
        { label: 'Abrir todos los ambientes', onSelect: () => openAllUrls(app) },
        { label: 'Copiar URLs', onSelect: () => copyUrls(app) },
      );
    }
    return acciones;
  }

  return (
    <div className={`page${compact ? ' compact' : ''}`}>
      <div className="page-header">
        <h1>DevAtlas</h1>
        <div className="header-actions">
          <Link to="/report" className="btn-secondary" title="Reporte de tecnologías">
            <ReportIcon /> Reporte
          </Link>
          <Link to="/clients" className="btn-secondary">
            <ClientsIcon /> Clientes
          </Link>
          <Link to="/environments" className="btn-secondary">
            <EnvironmentsIcon /> Ambientes
          </Link>
          <Link to="/apps/new" className="btn-primary">
            <PlusIcon /> Nueva aplicación
          </Link>
          {/* Configuración y sesión son "lo tuyo": van juntas al final, aparte de la navegación. */}
          <div className="header-user">
            <Link
              to="/settings"
              className="btn-secondary btn-icon-only"
              title="Configuración"
              aria-label="Configuración"
            >
              <SettingsIcon />
            </Link>
            <AuthButton />
          </div>
        </div>
      </div>

      {/* Resumen en una línea: son números de referencia, no el contenido de la página. */}
      {stats && stats.total > 0 && (
        <div className="stats-bar">
          <span>
            <b>{stats.total}</b> aplicaciones
          </span>
          <span>
            <b>{stats.favorites}</b> ★ favoritas
          </span>
          <span>
            <b>{stats.distinctStacks}</b> stacks
          </span>
          {stats.archived > 0 && (
            <span>
              <b>{stats.archived}</b> archivadas
            </span>
          )}
          {stats.byStack.length > 0 && (
            <span className="stats-bar-stacks">
              {stats.byStack.slice(0, 4).map((s) => (
                <span className="stat-chip" key={s.name}>
                  {s.name} <b>{s.count}</b>
                </span>
              ))}
            </span>
          )}
        </div>
      )}

      {recientes.length > 0 && !search && activeFilters === 0 && (
        <div className="recent-bar">
          <span className="recent-label">Recientes:</span>
          {recientes.map((r) => (
            <Link key={r.id} to={`/apps/${r.id}`} className="recent-chip">
              {r.name}
            </Link>
          ))}
        </div>
      )}

      <div className="search-row">
        <input
          className="search-input"
          ref={searchInput}
          placeholder="Buscar por nombre, descripción, stack, responsable o tag..."
          aria-label="Buscar aplicaciones"
          value={search}
          onChange={(e) => setParam('q', e.target.value)}
        />
        <button
          type="button"
          className={`btn-secondary filters-toggle${activeFilters > 0 ? ' has-filters' : ''}`}
          onClick={toggleFilters}
          aria-expanded={filtersOpen}
        >
          Filtros{activeFilters > 0 ? ` (${activeFilters})` : ''} {filtersOpen ? '▴' : '▾'}
        </button>
        <button type="button" className="btn-secondary" onClick={handleExport} title="Exportar a CSV lo que estás viendo">
          Exportar
        </button>
        <button
          type="button"
          className="btn-secondary btn-icon-only"
          onClick={() => setShowHelp(true)}
          title="Atajos de teclado"
          aria-label="Atajos de teclado"
        >
          ?
        </button>
      </div>

      {filtrosActivos.length > 0 && (
        <div className="active-filters">
          {filtrosActivos.map((f) => (
            <button
              key={f.key}
              type="button"
              className="active-filter"
              onClick={() => setParam(f.key, null)}
              aria-label={`Quitar filtro ${f.label}`}
              title={`Quitar filtro ${f.label}`}
            >
              {f.label} <span aria-hidden="true">✕</span>
            </button>
          ))}
          <button type="button" className="active-filter clear-all" onClick={limpiarFiltros}>
            Limpiar todo
          </button>
        </div>
      )}

      <div className={`filters${filtersOpen ? '' : ' filters-closed'}`}>
        {tags.length > 0 && (
          <div className="tag-filter">
            <button
              type="button"
              className={`tag${activeTag === null ? ' tag-active' : ''}`}
              onClick={() => setParam('tag', null)}
            >
              Todas
            </button>
            {tags.map((tag) => (
              <button
                type="button"
                key={tag}
                className={`tag${activeTag === tag ? ' tag-active' : ''}`}
                onClick={() => toggleParam('tag', tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        <div className="client-filter">
          <span className="client-filter-label">Origen:</span>
          {[
            { value: null, label: 'Todas' },
            { value: 'own', label: 'Propias' },
            { value: 'external', label: 'Externas' },
          ].map((o) => (
            <button
              type="button"
              key={o.label}
              className={`client-chip${activeOrigin === o.value ? ' active' : ''}`}
              onClick={() => setParam('origen', o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="client-filter">
          <span className="client-filter-label">Capa:</span>
          <button
            type="button"
            className={`client-chip${activeLayer === null ? ' active' : ''}`}
            onClick={() => setParam('capa', null)}
          >
            Todas
          </button>
          {LAYER_OPTIONS.map((l) => (
            <button
              type="button"
              key={l}
              className={`client-chip${activeLayer === l ? ' active' : ''}`}
              onClick={() => toggleParam('capa', l)}
            >
              <span className="env-dot" style={{ backgroundColor: LAYER_META[l].color }} />
              {LAYER_META[l].label}
            </button>
          ))}
        </div>

        {clients.length > 0 && (
          <div className="client-filter">
            <span className="client-filter-label">Cliente:</span>
            <button
              type="button"
              className={`client-chip${activeClientId === null ? ' active' : ''}`}
              onClick={() => setParam('cliente', null)}
            >
              Todos
            </button>
            {clients.map((c) => (
              <button
                type="button"
                key={c.id}
                className={`client-chip${activeClientId === c.id ? ' active' : ''}`}
                onClick={() => toggleParam('cliente', String(c.id))}
              >
                <span className="env-dot" style={{ backgroundColor: c.color }} />
                {c.name} <span className="client-count">{c.appCount}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="list-toolbar">
        <label className="toolbar-field">
          Orden
          <select value={sort} onChange={(e) => setParam('orden', e.target.value)}>
            {(Object.keys(SORT_LABELS) as Sort[]).map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </select>
        </label>

        <label className="toolbar-check" title="Archivadas, deprecadas y las de clientes ocultos">
          <input
            type="checkbox"
            checked={includeHidden}
            onChange={(e) => setParam('ocultas', e.target.checked ? '1' : null)}
          />
          Ver ocultas
        </label>

        <button
          type="button"
          className="btn-secondary density-toggle"
          onClick={() => setCompact((c) => !c)}
          title={compact ? 'Ver las cards con más detalle' : 'Comprimir para que entre todo en pantalla'}
        >
          {compact ? '⤢ Cómodo' : '⤡ Compacto'}
        </button>

        <div className="view-toggle">
          <button
            type="button"
            className={view === 'grid' ? 'active' : ''}
            onClick={() => setView('grid')}
            title="Vista de tarjetas"
          >
            ▦ Grid
          </button>
          <button
            type="button"
            className={view === 'list' ? 'active' : ''}
            onClick={() => setView('list')}
            title="Vista de lista"
          >
            ☰ Lista
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {loading && apps.length === 0 && (
        <div className="app-grid" aria-busy="true" aria-label="Cargando aplicaciones">
          {Array.from({ length: 6 }, (_, i) => (
            <div className="app-card skeleton-card" key={i} data-testid="skeleton-card">
              <div className="skeleton-line skeleton-title" />
              <div className="skeleton-line" />
              <div className="skeleton-line skeleton-short" />
            </div>
          ))}
        </div>
      )}

      {!loading && !error && apps.length === 0 && (
        <div className="empty-state">
          {filtrosActivos.length > 0 ? (
            <>
              <p>Ninguna aplicación coincide con los filtros de ahora.</p>
              <button type="button" className="btn-secondary" onClick={limpiarFiltros}>
                Limpiar filtros
              </button>
            </>
          ) : (
            <>
              <p>No hay aplicaciones cargadas todavía.</p>
              <Link to="/apps/new" className="btn-primary">
                <PlusIcon /> Cargar la primera
              </Link>
            </>
          )}
        </div>
      )}

      {grupos.map(({ titulo, items }) =>
        items.length === 0 ? null : (
          <section className="app-group" key={titulo}>
            {grupos.length > 1 && (
              <h2 className="app-group-title">
                {titulo} <span className="app-group-count">{items.length}</span>
              </h2>
            )}
            {view === 'grid' ? (
              <div className="app-grid">
                {items.map((app) => (
                  <Link
                    to={`/apps/${app.id}`}
                    key={app.id}
                    className={`app-card${app.isArchived ? ' is-archived' : ''}${app.clientName ? ' has-client' : ''}`}
                    style={
                      app.clientName
                        ? ({ '--client-color': app.clientColor ?? '#6b7280' } as React.CSSProperties)
                        : undefined
                    }
                  >
                    {app.clientName && <span className="client-label">{app.clientName}</span>}
                    <div className="app-card-head">
                      <h3>
                        <Highlight text={app.name} term={search} />
                      </h3>
                      <div className="app-card-head-actions">
                        <button
                          type="button"
                          className={`star${app.isFavorite ? ' star-on' : ''}`}
                          onClick={(e) => toggleFavorite(e, app)}
                          title={app.isFavorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
                          aria-label={app.isFavorite ? `Quitar ${app.name} de favoritos` : `Marcar ${app.name} como favorito`}
                        >
                          {app.isFavorite ? '★' : '☆'}
                        </button>
                        <AppCardMenu actions={accionesDe(app)} label={`Más acciones de ${app.name}`} />
                      </div>
                    </div>
                    <div className="badge-row">
                      {app.isExternal && <span className="external-badge">Externo</span>}
                      {app.layer && (
                        <span className="layer-badge" style={{ backgroundColor: LAYER_META[app.layer].color }}>
                          {LAYER_META[app.layer].label}
                        </span>
                      )}
                      {app.stack && (
                        <span className="stack-badge">
                          <span className="stack-icon">{stackIcon(app.stack)}</span> {app.stack}
                        </span>
                      )}
                      {app.status !== 'active' && (
                        <span
                          className="status-badge"
                          style={{ color: STATUS_META[app.status].color, borderColor: STATUS_META[app.status].color }}
                        >
                          {STATUS_META[app.status].label}
                        </span>
                      )}
                    </div>
                    {app.description && (
                      <p>
                        <Highlight text={app.description} term={search} />
                      </p>
                    )}
                    {app.tags.length > 0 && (
                      <div className="tag-list">
                        {app.tags.map((tag) => (
                          <span key={tag} className="tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {(app.repoPath || app.urls.length > 0) && (
                      <div className="card-actions">
                        {app.repoPath && (
                          <button
                            type="button"
                            className="chip-action chip-repo"
                            onClick={(e) => handleRepo(e, app)}
                            title={isUrl(app.repoPath) ? 'Abrir repositorio' : 'Copiar ruta del repo'}
                            aria-label={`Repositorio de ${app.name}`}
                          >
                            {copiedId === app.id ? '✓' : <RepoIcon size={13} />}
                          </button>
                        )}
                        {/* Sin la flecha: ya se ve que son accesos, y con 4 ambientes no entraban. */}
                        {app.urls.map((u) => (
                          <button
                            type="button"
                            key={u.id}
                            className="chip-action"
                            onClick={(e) => openLink(e, u.url)}
                            title={u.url}
                            aria-label={`Abrir ${app.name} en ${u.environment}`}
                          >
                            <span className="env-dot" style={{ backgroundColor: u.color }} />
                            <span className="chip-text">{u.environment}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            ) : (
              <div className="app-list">
                {items.map((app) => (
                  <Link
                    to={`/apps/${app.id}`}
                    key={app.id}
                    className={`app-row${app.isArchived ? ' is-archived' : ''}`}
                  >
                    <button
                      type="button"
                      className={`star${app.isFavorite ? ' star-on' : ''}`}
                      onClick={(e) => toggleFavorite(e, app)}
                      title={app.isFavorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
                      aria-label={app.isFavorite ? `Quitar ${app.name} de favoritos` : `Marcar ${app.name} como favorito`}
                    >
                      {app.isFavorite ? '★' : '☆'}
                    </button>
                    <span className="app-row-name">
                      <Highlight text={app.name} term={search} />
                    </span>
                    <span className="app-row-stack">
                      {app.stack && <span className="stack-icon">{stackIcon(app.stack)}</span>} {app.stack}
                    </span>
                    <span className="app-row-tags">
                      {app.tags.map((tag) => (
                        <span key={tag} className="tag">
                          {tag}
                        </span>
                      ))}
                    </span>
                    {app.repoPath && (
                      <button
                        type="button"
                        className="app-row-icon"
                        onClick={(e) => handleRepo(e, app)}
                        title={isUrl(app.repoPath) ? 'Abrir repositorio' : 'Copiar ruta del repo'}
                        aria-label={`Repositorio de ${app.name}`}
                      >
                        {copiedId === app.id ? '✓' : isUrl(app.repoPath) ? '🔗' : '📋'}
                      </button>
                    )}
                    <AppCardMenu actions={accionesDe(app)} label={`Más acciones de ${app.name}`} />
                  </Link>
                ))}
              </div>
            )}
          </section>
        ),
      )}

      {hayMas && (
        <div className="load-more">
          <button type="button" className="btn-secondary" onClick={() => setPage((p) => p + 1)} disabled={loading}>
            {loading ? 'Cargando...' : `Cargar más (${apps.length} de ${total})`}
          </button>
        </div>
      )}

      {showHelp && (
        <div className="modal-backdrop" onClick={() => setShowHelp(false)}>
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcuts-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="shortcuts-title">Atajos de teclado</h3>
            <ul className="shortcut-list">
              <li>
                <kbd>/</kbd> buscar
              </li>
              <li>
                <kbd>n</kbd> nueva aplicación
              </li>
              <li>
                <kbd>g</kbd> alternar grid / lista
              </li>
              <li>
                <kbd>Ctrl</kbd>+<kbd>K</kbd> ir a una aplicación
              </li>
              <li>
                <kbd>?</kbd> esta ayuda
              </li>
            </ul>
            <div className="modal-actions">
              <button type="button" className="btn-primary" onClick={() => setShowHelp(false)} autoFocus>
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      <BackToTop />
    </div>
  );
}
