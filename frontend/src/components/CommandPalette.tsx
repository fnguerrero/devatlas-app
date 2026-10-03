import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApplications } from '../api/client';
import type { ApplicationListItem } from '../types/application';
import { useShortcuts } from '../lib/useShortcuts';

interface Destino {
  label: string;
  hint?: string;
  go: () => void;
}

const PAGINAS: { label: string; path: string }[] = [
  { label: 'Nueva aplicación', path: '/apps/new' },
  { label: 'Clientes', path: '/clients' },
  { label: 'Ambientes', path: '/environments' },
  { label: 'Reporte de tecnologías', path: '/report' },
  { label: 'Configuración', path: '/settings' },
];

/**
 * Saltar a cualquier lado con Ctrl+K: escribís dos letras del nombre y entrás.
 * Con muchas apps es más rápido que buscar en el listado y después clickear.
 */
export default function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [apps, setApps] = useState<ApplicationListItem[]>([]);
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useShortcuts({
    'mod+k': () => setOpen((v) => !v),
  });

  useEffect(() => {
    if (!open) {
      setTerm('');
      setApps([]);
      setCursor(0);
      return;
    }
    input.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      // Se piden pocas: la paleta es para saltar a algo que ya se tiene en la cabeza,
      // no para explorar el catálogo.
      getApplications({ search: term, pageSize: 8, includeHidden: true }, controller.signal)
        .then(({ items }) => setApps(items))
        .catch(() => {});
    }, 150);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [term, open]);

  if (!open) return null;

  const paginas = PAGINAS.filter((p) => p.label.toLowerCase().includes(term.trim().toLowerCase()));
  const destinos: Destino[] = [
    ...apps.map((a) => ({
      label: a.name,
      hint: a.clientName ?? a.stack ?? undefined,
      go: () => navigate(`/apps/${a.id}`),
    })),
    ...paginas.map((p) => ({ label: p.label, hint: 'ir a', go: () => navigate(p.path) })),
  ];

  const activo = Math.min(cursor, Math.max(destinos.length - 1, 0));

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => (destinos.length === 0 ? 0 : (c + 1) % destinos.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => (destinos.length === 0 ? 0 : (c - 1 + destinos.length) % destinos.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      destinos[activo]?.go();
      setOpen(false);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="modal-backdrop palette-backdrop" onClick={() => setOpen(false)}>
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Ir a"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={input}
          className="palette-input"
          placeholder="Ir a una aplicación o sección..."
          aria-label="Ir a una aplicación o sección"
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setCursor(0);
          }}
          onKeyDown={onKeyDown}
        />

        {destinos.length === 0 ? (
          <p className="palette-empty">Nada que coincida.</p>
        ) : (
          <ul className="palette-list" role="listbox">
            {destinos.map((d, i) => (
              <li key={`${d.label}-${i}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === activo}
                  className={i === activo ? 'active' : undefined}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => {
                    d.go();
                    setOpen(false);
                  }}
                >
                  <span>{d.label}</span>
                  {d.hint && <span className="palette-hint">{d.hint}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
