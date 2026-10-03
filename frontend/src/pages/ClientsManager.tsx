import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createClient, deleteClient, getClients, updateClient } from '../api/client';
import type { Client } from '../types/application';
import { useUi } from '../context/UiContext';

const PALETTE = ['#2563eb', '#db2777', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#dc2626', '#6b7280'];

/** Primer color que nadie esté usando: si siempre se propone el mismo, los chips
 *  del listado terminan todos iguales y el cliente deja de distinguirse. */
function nextFreeColor(clients: Client[]): string {
  const usados = new Set(clients.map((c) => c.color.toLowerCase()));
  return PALETTE.find((c) => !usados.has(c.toLowerCase())) ?? PALETTE[usados.size % PALETTE.length];
}

export default function ClientsManager() {
  const [clients, setClients] = useState<Client[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PALETTE[0]);
  const [colorTocado, setColorTocado] = useState(false);
  const { confirm, toast } = useUi();

  function load() {
    getClients()
      .then((rows) => {
        setClients(rows);
        // Se propone un color libre, salvo que ya lo hayas elegido a mano.
        if (!colorTocado) setNewColor(nextFreeColor(rows));
      })
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
      await createClient({ name, color: newColor });
      setNewName('');
      // Se libera el color elegido a mano para que el próximo vuelva a proponerse solo.
      setColorTocado(false);
      toast(`Cliente "${name}" creado.`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el cliente.');
    }
  }

  async function saveRow(c: Client) {
    setError(null);
    try {
      await updateClient(c.id, { name: c.name.trim(), color: c.color, isHidden: c.isHidden });
      toast('Cliente guardado.');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    }
  }

  async function removeRow(c: Client) {
    setError(null);
    const ok = await confirm({
      title: 'Eliminar cliente',
      message: `Las aplicaciones de "${c.name}" quedan sin cliente asignado.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteClient(c.id);
      toast(`Cliente "${c.name}" eliminado.`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar.');
    }
  }

  // Ocultar se guarda solo: es un interruptor, no tiene sentido pedir "Guardar".
  async function toggleHidden(c: Client, hidden: boolean) {
    setError(null);
    patchRow(c.id, { isHidden: hidden });
    try {
      await updateClient(c.id, { name: c.name.trim(), color: c.color, isHidden: hidden });
      toast(hidden ? `"${c.name}" oculto del listado.` : `"${c.name}" visible de nuevo.`);
    } catch (err) {
      patchRow(c.id, { isHidden: !hidden });
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el cliente.');
    }
  }

  function patchRow(id: number, patch: Partial<Client>) {
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Clientes</h1>
        <Link to="/" className="btn-secondary">
          ← Volver
        </Link>
      </div>

      <p className="env-help">
        Clientes / proyectos que agrupan aplicaciones. También podés crear uno al vuelo desde el formulario de una
        aplicación. El color identifica sus tarjetas en el listado. Marcá <strong>Oculto</strong> para sacar sus
        aplicaciones de la pantalla principal: siguen estando, se ven con “Ver ocultas”.
      </p>

      {error && <p className="error">{error}</p>}

      <div className="env-table">
        {clients.map((c) => (
          <div className="env-row" key={c.id}>
            <input
              type="color"
              value={c.color}
              onChange={(e) => patchRow(c.id, { color: e.target.value })}
              title="Color"
            />
            <input className="env-name" value={c.name} onChange={(e) => patchRow(c.id, { name: e.target.value })} />
            <span className="env-usage">{c.appCount} app(s)</span>
            <label className="client-hide" title="Sus aplicaciones no salen en el listado principal">
              <input
                type="checkbox"
                checked={c.isHidden}
                onChange={(e) => toggleHidden(c, e.target.checked)}
              />
              Oculto
            </label>
            <button type="button" className="btn-secondary" onClick={() => saveRow(c)}>
              Guardar
            </button>
            <button type="button" className="btn-danger" onClick={() => removeRow(c)} title="Eliminar">
              Eliminar
            </button>
          </div>
        ))}
        {clients.length === 0 && <p className="db-muted">Todavía no hay clientes.</p>}
      </div>

      <form className="env-new" onSubmit={handleCreate}>
        <h2>Nuevo cliente</h2>
        <div className="env-new-fields">
          <input
            type="color"
            value={newColor}
            onChange={(e) => {
              setNewColor(e.target.value);
              setColorTocado(true);
            }}
            title="Color"
          />
          <input placeholder="Nombre (ej. Acme)" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <button type="submit" className="btn-primary">
            + Agregar
          </button>
        </div>
      </form>
    </div>
  );
}
