import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Título por sección. El detalle de una app lo pisa con el nombre de la app cuando carga.
const TITULOS: [RegExp, string][] = [
  [/^\/$/, 'Aplicaciones'],
  [/^\/apps\/new$/, 'Nueva aplicación'],
  [/^\/apps\/[^/]+\/edit$/, 'Editar aplicación'],
  [/^\/clients$/, 'Clientes'],
  [/^\/environments$/, 'Ambientes'],
  [/^\/report$/, 'Reporte de tecnologías'],
  [/^\/settings$/, 'Configuración'],
];

/**
 * Mantiene el título de la pestaña al día. Con varias pestañas de DevAtlas abiertas,
 * "DevAtlas" en todas no ayuda a encontrar la que uno busca.
 */
export default function PageTitle() {
  const { pathname } = useLocation();

  useEffect(() => {
    const encontrado = TITULOS.find(([re]) => re.test(pathname));
    document.title = encontrado ? `${encontrado[1]} · DevAtlas` : 'DevAtlas';
  }, [pathname]);

  return null;
}
