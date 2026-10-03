import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createApplication, getApplication, getClients, getEnvironments, updateApplication } from '../api/client';
import type { AppEnvironment, AppLayer, AppStatus, ApplicationUrlInput, Client } from '../types/application';
import { isUrl, LAYER_META, LAYER_OPTIONS, STATUS_META, STATUS_OPTIONS } from '../lib/appActions';
import { useUi } from '../context/UiContext';

const emptyUrl = (): ApplicationUrlInput => ({ environment: '', url: '' });

// Valor centinela del desplegable de clientes: no es un nombre válido.
const NEW_CLIENT = '__nuevo__';

export default function ApplicationForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [repoPath, setRepoPath] = useState('');
  const [stack, setStack] = useState('');
  const [notes, setNotes] = useState('');
  const [urls, setUrls] = useState<ApplicationUrlInput[]>([emptyUrl()]);
  const [tagsInput, setTagsInput] = useState('');
  const [owner, setOwner] = useState('');
  const [status, setStatus] = useState<AppStatus>('active');
  const [layer, setLayer] = useState<AppLayer | ''>('');
  const [isExternal, setIsExternal] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);
  const { toast } = useUi();
  const [client, setClient] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [isArchived, setIsArchived] = useState(false);
  const [environments, setEnvironments] = useState<AppEnvironment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Errores por campo: se muestran al lado de lo que está mal, no todos juntos arriba.
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const { confirm } = useUi();

  useEffect(() => {
    getEnvironments().then(setEnvironments).catch(() => {});
    getClients().then(setClients).catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    getApplication(id)
      .then((app) => {
        setName(app.name);
        setDescription(app.description ?? '');
        setRepoPath(app.repoPath ?? '');
        setStack(app.stack ?? '');
        setNotes(app.notes ?? '');
        setUrls(app.urls.length > 0 ? app.urls.map((u) => ({ environment: u.environment, url: u.url })) : [emptyUrl()]);
        setTagsInput(app.tags.join(', '));
        setOwner(app.owner ?? '');
        setStatus(app.status);
        setLayer(app.layer ?? '');
        setIsExternal(app.isExternal);
        setClient(app.clientName ?? '');
        setIsFavorite(app.isFavorite);
        setIsArchived(app.isArchived);
      })
      .catch(() => setError('No se pudo cargar la aplicación. ¿Está corriendo el backend?'));
  }, [id]);

  function updateUrlRow(index: number, field: keyof ApplicationUrlInput, value: string) {
    setUrls((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function addUrlRow() {
    setUrls((prev) => [...prev, emptyUrl()]);
  }

  function removeUrlRow(index: number) {
    setUrls((prev) => prev.filter((_, i) => i !== index));
  }

  // Cerrar la pestaña o recargar con cambios sin guardar pide confirmación del navegador.
  useEffect(() => {
    if (!dirty) return;
    function avisar(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [dirty]);

  /**
   * Se valida acá y no sólo con `required` del navegador para poder explicar qué está mal
   * en castellano y al lado del campo, igual que hace el backend.
   */
  function validar(): boolean {
    const nuevos: Record<string, string> = {};

    if (!name.trim()) nuevos.name = 'Poné un nombre para la aplicación.';

    urls.forEach((row, i) => {
      const tieneUrl = row.url.trim().length > 0;
      if (tieneUrl && !isUrl(row.url)) {
        nuevos[`url-${i}`] = 'La URL tiene que empezar con http:// o https://';
      }
      if (tieneUrl && !row.environment.trim()) {
        nuevos[`url-${i}`] = 'Elegí a qué ambiente corresponde esta URL.';
      }
    });

    setErrors(nuevos);
    return Object.keys(nuevos).length === 0;
  }

  async function handleCancel() {
    if (dirty) {
      const salir = await confirm({
        title: 'Salir sin guardar',
        message: 'Hay cambios sin guardar en el formulario. Si salís se pierden.',
        confirmLabel: 'Salir igual',
        danger: true,
      });
      if (!salir) return;
    }
    navigate(isEdit && id ? `/apps/${id}` : '/');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validar()) return;

    setSaving(true);
    setError(null);

    const payload = {
      name,
      description,
      repoPath,
      stack,
      notes,
      owner,
      layer,
      isExternal,
      status,
      client,
      isFavorite,
      isArchived,
      urls: urls.filter((u) => u.environment.trim() && u.url.trim()),
      tags: tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0),
    };

    try {
      if (isEdit && id) {
        await updateApplication(id, payload);
        setDirty(false);
        toast('Cambios guardados.');
        navigate(`/apps/${id}`);
      } else {
        const created = await createApplication(payload);
        setDirty(false);
        toast(`"${created.name}" creada.`);
        navigate(`/apps/${created.id}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar. Revisá los datos y que el backend esté corriendo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <h1>{isEdit ? 'Editar aplicación' : 'Nueva aplicación'}</h1>

      {error && <p className="error">{error}</p>}

      {/* onChange en el form: cualquier campo que se toque marca el formulario como sucio,
          sin tener que envolver los quince setters de arriba. */}
      <form onSubmit={handleSubmit} onChange={() => setDirty(true)} className="app-form" noValidate>
        <fieldset className="origin-picker">
          <legend>¿Qué estás dando de alta?</legend>
          <label className={!isExternal ? 'active' : ''}>
            <input
              type="radio"
              name="origin"
              checked={!isExternal}
              onChange={() => setIsExternal(false)}
            />
            <span className="origin-title">Aplicación propia</span>
            <span className="origin-hint">Código nuestro: tiene repo, stack y ambientes</span>
          </label>
          <label className={isExternal ? 'active' : ''}>
            <input
              type="radio"
              name="origin"
              checked={isExternal}
              onChange={() => setIsExternal(true)}
            />
            <span className="origin-title">Servicio externo</span>
            <span className="origin-hint">De un tercero: sólo URL y notas, se chequea igual</span>
          </label>
        </fieldset>

        <label>
          Nombre *
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'error-name' : undefined}
          />
          {errors.name && (
            <span className="field-error" id="error-name">
              {errors.name}
            </span>
          )}
        </label>

        <label>
          Descripción
          <input value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>

        {!isExternal && (
          <>
            <label>
              Stack
              <input
                value={stack}
                onChange={(e) => setStack(e.target.value)}
                placeholder=".NET 10 + React"
              />
            </label>

            <label>
              Repo (path o URL)
              <input value={repoPath} onChange={(e) => setRepoPath(e.target.value)} />
            </label>
          </>
        )}

        <label>
          Cliente / Proyecto
          {creatingClient ? (
            // Alta al vuelo: el backend crea el cliente si el nombre no existe.
            <span className="field-with-action">
              <input
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="Nombre del cliente nuevo"
                autoFocus
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setCreatingClient(false);
                  setClient('');
                }}
              >
                Cancelar
              </button>
            </span>
          ) : (
            <select
              value={client}
              onChange={(e) => {
                if (e.target.value === NEW_CLIENT) {
                  setCreatingClient(true);
                  setClient('');
                } else {
                  setClient(e.target.value);
                }
              }}
            >
              <option value="">Sin cliente</option>
              {/* En edición el cliente puede no estar en la lista todavía. */}
              {client && !clients.some((c) => c.name === client) && <option value={client}>{client}</option>}
              {clients.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
              <option value={NEW_CLIENT}>+ Nuevo cliente…</option>
            </select>
          )}
        </label>

        <div className="form-inline">
          <label>
            Responsable
            <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Quién la mantiene" />
          </label>
          {!isExternal && (
          <label>
            Capa
            <select value={layer} onChange={(e) => setLayer(e.target.value as AppLayer | '')}>
              <option value="">Sin definir</option>
              {LAYER_OPTIONS.map((l) => (
                <option key={l} value={l}>
                  {LAYER_META[l].label}
                </option>
              ))}
            </select>
          </label>
          )}
          <label>
            Estado
            <select value={status} onChange={(e) => setStatus(e.target.value as AppStatus)}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Tags (separados por coma)
          <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="backend, interno" />
        </label>

        <fieldset>
          <legend>URLs por ambiente</legend>
          {urls.map((row, index) => (
            <div key={index} className="url-row-group">
              <div className="url-row">
                <select
                  value={row.environment}
                  onChange={(e) => updateUrlRow(index, 'environment', e.target.value)}
                  aria-label={`Ambiente de la URL ${index + 1}`}
                >
                  <option value="">Ambiente…</option>
                  {environments.map((env) => (
                    <option key={env.id} value={env.name}>
                      {env.name}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="https://..."
                  value={row.url}
                  onChange={(e) => updateUrlRow(index, 'url', e.target.value)}
                  aria-label={`URL ${index + 1}`}
                  aria-invalid={!!errors[`url-${index}`]}
                />
                <button
                  type="button"
                  onClick={() => removeUrlRow(index)}
                  className="btn-icon"
                  title="Quitar esta URL"
                  aria-label={`Quitar la URL ${index + 1}`}
                >
                  ×
                </button>
              </div>
              {errors[`url-${index}`] && <span className="field-error">{errors[`url-${index}`]}</span>}
            </div>
          ))}
          <button type="button" onClick={addUrlRow} className="btn-secondary">
            + Agregar URL
          </button>
        </fieldset>

        <label>
          Notas / Runbook (soporta Markdown)
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={10} />
        </label>

        <div className="form-flags">
          <label className="flag-check">
            <input type="checkbox" checked={isFavorite} onChange={(e) => setIsFavorite(e.target.checked)} />
            ★ Favorito
          </label>
          <label className="flag-check">
            <input type="checkbox" checked={isArchived} onChange={(e) => setIsArchived(e.target.checked)} />
            Archivada
          </label>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          <button type="button" className="btn-secondary" onClick={handleCancel}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
