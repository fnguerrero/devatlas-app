import { useEffect, useState } from 'react';

/**
 * Con muchas apps el listado se hace largo; este botón aparece recién cuando uno bajó
 * lo suficiente como para que volver arriba scrolleando sea molesto.
 */
export default function BackToTop({ threshold = 400 }: { threshold?: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > threshold);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  if (!visible) return null;

  return (
    <button
      type="button"
      className="back-to-top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      title="Volver arriba"
      aria-label="Volver arriba"
    >
      ↑
    </button>
  );
}
