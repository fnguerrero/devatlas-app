import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createEnvironment, deleteEnvironment, getEnvironments, updateEnvironment } from '../api/client';
import type { AppEnvironment } from '../types/application';
import { useUi } from '../context/UiContext';

const PALETTE = ['#16a34a', '#0891b2', '#d97706', '#dc2626', '#7c3aed', '#2563eb', '#db2777', '#6b7280'];

export default function EnvironmentsManager() {
  const [envs, setEnvs] = useState<AppEnvironment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PALETTE[0]);
  const { confirm, toast } = useUi();

  function load() {
    getEnvironments()
      .then(setEnvs)
      .catch(() => setError('No se pudo cargar. ¿Está corriendo el backend?'));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const name = newName.trim();
    if (!name) return;
    try {
      const nextOrder = envs.length ? Math.max(...envs.map((x) => x.sortOrder)) + 1 : 1;
      await createEnvironment({ name, sortOrder: nextOrder, color: newColor });
      setNewName('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el ambiente.');
    }
  }

  async function saveRow(env: AppEnvironment) {
    setError(null);
    try {
      await updateEnvironment(env.id, { name: env.name.trim(), sortOrder: env.sortOrder, color: env.color });
      toast('Ambiente guardado.');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    }
  }

  async function removeRow(env: AppEnvironment) {
    setError(null);
    const ok = await confirm({
      title: 'Eliminar ambiente',
      message: `Se va a borrar el ambiente "${env.name}" del catálogo.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteEnvironment(env.id);
      toast(`Ambiente "${env.name}" eliminado.`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar.');
    }
  }

  function patchRow(id: number, patch: Partial<AppEnvironment>) {
    setEnvs((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Ambientes</h1>
        <Link to="/" className="btn-secondary">
          ← Volver
        </Link>
      </div>

      <p className="env-help">
        Catálogo reutilizable de ambientes. Cada URL de tus aplicaciones elige uno de estos. El orden define cómo se
        muestran; el color se usa en los badges.
      </p>

      {error && <p className="error">{error}</p>}

      <div className="env-table">
        {envs.map((env) => (
          <div className="env-row" key={env.id}>
            <input
              type="color"
              value={env.color}
              onChange={(e) => patchRow(env.id, { color: e.target.value })}
              title="Color"
            />
            <input
              className="env-name"
              value={env.name}
              onChange={(e) => patchRow(env.id, { name: e.target.value })}
            />
            <label className="env-order">
              orden
              <input
                type="number"
                value={env.sortOrder}
                onChange={(e) => patchRow(env.id, { sortOrder: Number(e.target.value) })}
              />
            </label>
            <span className="env-usage">{env.urlCount} URL(s)</span>
            <button type="button" className="btn-secondary" onClick={() => saveRow(env)}>
              Guardar
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={() => removeRow(env)}
              disabled={env.urlCount > 0}
              title={env.urlCount > 0 ? 'No se puede: está en uso' : 'Eliminar'}
            >
              Eliminar
            </button>
          </div>
        ))}
      </div>

      <form className="env-new" onSubmit={handleCreate}>
        <h2>Nuevo ambiente</h2>
        <div className="env-new-fields">
          <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} title="Color" />
          <input
            placeholder="Nombre (ej. UAT, Staging)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button type="submit" className="btn-primary">
            + Agregar
          </button>
        </div>
      </form>
    </div>
  );
}
