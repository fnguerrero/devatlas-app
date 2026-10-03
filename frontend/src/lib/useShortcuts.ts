import { useEffect, useRef } from 'react';

type Handler = (e: KeyboardEvent) => void;

/**
 * Atajos de teclado a nivel página. Las teclas sueltas se ignoran mientras se está
 * escribiendo en un campo (si no, tipear "n" en el buscador abriría el alta), salvo
 * Escape, que justamente sirve para salir del campo.
 */
export function useShortcuts(map: Record<string, Handler>, enabled = true) {
  // Se guarda en una ref para no re-suscribir el listener en cada render.
  const mapRef = useRef(map);
  mapRef.current = map;

  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const escribiendo =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      const combo = [
        e.ctrlKey || e.metaKey ? 'mod+' : '',
        e.shiftKey && e.key.length > 1 ? 'shift+' : '',
        e.key.toLowerCase(),
      ].join('');

      const handler = mapRef.current[combo];
      if (!handler) return;

      const esCombinacion = combo.startsWith('mod+');
      if (escribiendo && !esCombinacion && e.key !== 'Escape') return;

      e.preventDefault();
      handler(e);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
