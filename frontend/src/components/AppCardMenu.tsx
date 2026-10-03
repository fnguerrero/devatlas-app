import { useEffect, useRef, useState } from 'react';

export interface CardAction {
  label: string;
  onSelect: () => void;
  danger?: boolean;
}

/**
 * Menú "⋯" de una card. Las acciones secundarias (archivar, duplicar, copiar) viven acá
 * para que la card siga mostrando lo que uno viene a ver y no seis botones.
 */
export default function AppCardMenu({ actions, label = 'Más acciones' }: { actions: CardAction[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onDocumentClick(e: MouseEvent) {
      if (!contenedor.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onDocumentClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocumentClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // La card entera es un link: sin frenar la propagación, tocar el menú navegaría.
  function frenar(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  return (
    <div className="card-menu" ref={contenedor}>
      <button
        type="button"
        className="card-menu-toggle"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={(e) => {
          frenar(e);
          setOpen((v) => !v);
        }}
      >
        ⋯
      </button>

      {open && (
        <div className="card-menu-items" role="menu">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              className={action.danger ? 'danger' : undefined}
              onClick={(e) => {
                frenar(e);
                setOpen(false);
                action.onSelect();
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
