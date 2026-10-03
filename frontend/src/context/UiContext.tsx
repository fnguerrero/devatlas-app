import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

interface UiState {
  toast: (text: string, kind?: ToastKind) => void;
  /** Diálogo propio en lugar de window.confirm. Resuelve true si el usuario acepta. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const UiContext = createContext<UiState | undefined>(undefined);

const TOAST_MS = 4000;

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const nextId = useRef(1);

  const toast = useCallback((text: string, kind: ToastKind = 'success') => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, kind, text }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), TOAST_MS);
  }, []);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        devolverFoco.current = document.activeElement as HTMLElement | null;
        setDialog({ ...options, resolve });
      }),
    [],
  );

  function close(result: boolean) {
    dialog?.resolve(result);
    setDialog(null);
    // El foco vuelve a donde estaba: si no, queda en el body y el próximo Tab arranca
    // desde el principio de la página.
    devolverFoco.current?.focus();
    devolverFoco.current = null;
  }

  const modal = useRef<HTMLDivElement>(null);
  const devolverFoco = useRef<HTMLElement | null>(null);

  // Escape cancela el diálogo, como cualquier modal, y el Tab no se escapa afuera:
  // mientras el diálogo está abierto, el resto de la página no es alcanzable.
  useEffect(() => {
    if (!dialog) return;

    function focusables(): HTMLElement[] {
      return Array.from(
        modal.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => !el.hasAttribute('disabled'));
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        close(false);
        return;
      }
      if (e.key !== 'Tab') return;

      const items = focusables();
      if (items.length === 0) return;

      const primero = items[0];
      const ultimo = items[items.length - 1];
      const activo = document.activeElement as HTMLElement | null;

      if (e.shiftKey && (activo === primero || !modal.current?.contains(activo))) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && (activo === ultimo || !modal.current?.contains(activo))) {
        e.preventDefault();
        primero.focus();
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <UiContext.Provider value={{ toast, confirm }}>
      {children}

      {toasts.length > 0 && (
        <div className="toast-stack" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast-${t.kind}`}>
              {t.text}
            </div>
          ))}
        </div>
      )}

      {dialog && (
        <div className="modal-backdrop" onClick={() => close(false)}>
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            ref={modal}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="confirm-title">{dialog.title}</h3>
            <p>{dialog.message}</p>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => close(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className={dialog.danger ? 'btn-danger' : 'btn-primary'}
                onClick={() => close(true)}
                autoFocus
              >
                {dialog.confirmLabel ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </UiContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUi() {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUi fuera de UiProvider');
  return ctx;
}
