import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { deleteApplication, duplicateApplication, getApplication } from '../api/client';
import { LAYER_META, STATUS_META } from '../lib/appActions';
import { fullDate, relativeTime } from '../lib/format';
import { pushRecent } from '../lib/recent';
import EnvironmentSection from '../components/EnvironmentSection';
import type { ApplicationDetail as ApplicationDetailType } from '../types/application';
import { useUi } from '../context/UiContext';

export default function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [app, setApp] = useState<ApplicationDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const { confirm, toast } = useUi();

  function load() {
    if (!id) return;
    getApplication(id)
      .then((data) => {
        setApp(data);
        // Queda anotada como "reciente" para el listado: lo que uno abre es lo que va
        // a querer volver a abrir en un rato.
        pushRecent({ id: data.id, name: data.name });
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    if (app) document.title = `${app.name} · DevAtlas`;
  }, [app]);

  async function handleDelete() {
    if (!app) return;
    const ok = await confirm({
      title: 'Eliminar aplicación',
      message: `Se va a borrar "${app.name}" con sus URLs y conexiones. No se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;

    try {
      await deleteApplication(app.id);
      toast(`"${app.name}" eliminada.`);
      navigate('/');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  // Duplicar deja la copia abierta en edición: casi siempre uno duplica para cambiarle
  // dos campos, no para dejarla igual.
  async function handleDuplicate() {
    if (!app) return;
    try {
      const copia = await duplicateApplication(app.id);
      toast(`Se creó "${copia.name}".`);
      navigate(`/apps/${copia.id}/edit`);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  if (loading) {
    return (
      <div className="page" aria-busy="true" aria-label="Cargando la aplicación">
        <div className="skeleton-line skeleton-title" data-testid="skeleton-line" />
        <div className="skeleton-line" />
        <div className="skeleton-line skeleton-short" />
      </div>
    );
  }

  if (!app) return <div className="page">No se encontró la aplicación.</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>
          {app.isFavorite && <span className="star-on" title="Favorito">★ </span>}
          {app.name}
          {app.isArchived && <span className="archived-badge">Archivada</span>}
        </h1>
        <div className="actions">
          <Link to={`/apps/${app.id}/edit`} className="btn-secondary">
            Editar
          </Link>
          <button onClick={handleDuplicate} className="btn-secondary" title="Crear una copia de esta aplicación">
            Duplicar
          </button>
          <button onClick={handleDelete} className="btn-danger">
            Eliminar
          </button>
        </div>
      </div>

      {app.description && <p>{app.description}</p>}

      <div className="detail-grid">
        {app.clientName && (
          <div>
            <strong>Cliente:</strong>{' '}
            <span className="client-pill" style={{ backgroundColor: app.clientColor ?? '#6b7280' }}>
              {app.clientName}
            </span>
          </div>
        )}
        <div>
          <strong>Estado:</strong>{' '}
          <span style={{ color: STATUS_META[app.status].color, fontWeight: 600 }}>
            {STATUS_META[app.status].label}
          </span>
        </div>
        {app.isExternal && (
          <div>
            <strong>Origen:</strong> <span className="external-badge">Servicio externo</span>
          </div>
        )}
        {app.layer && (
          <div>
            <strong>Capa:</strong>{' '}
            <span className="layer-badge" style={{ backgroundColor: LAYER_META[app.layer].color }}>
              {LAYER_META[app.layer].label}
            </span>
          </div>
        )}
        {app.owner && (
          <div>
            <strong>Responsable:</strong> {app.owner}
          </div>
        )}
        {app.stack && (
          <div>
            <strong>Stack:</strong> {app.stack}
          </div>
        )}
        {app.repoPath && (
          <div>
            <strong>Repo:</strong> {app.repoPath}
          </div>
        )}
      </div>

      {app.tags.length > 0 && (
        <div className="tag-list">
          {app.tags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
      )}

      <EnvironmentSection appId={app.id} urls={app.urls} databases={app.databases} onChange={load} />

      {app.notes && (
        <section>
          <h2>Notas / Runbook</h2>
          <div className="markdown-body">
            <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{app.notes}</ReactMarkdown>
          </div>
        </section>
      )}

      {/* Fechas en lenguaje de todos los días; la fecha exacta queda en el tooltip. */}
      <p className="timestamps">
        Creada <time dateTime={app.createdAt} title={fullDate(app.createdAt)}>{relativeTime(app.createdAt)}</time>
        {' · '}
        editada <time dateTime={app.updatedAt} title={fullDate(app.updatedAt)}>{relativeTime(app.updatedAt)}</time>
      </p>

      <Link to="/" className="back-link">
        ← Volver al listado
      </Link>
    </div>
  );
}
