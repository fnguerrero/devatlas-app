import { splitMatch } from '../lib/format';

/**
 * Resalta dentro de un texto lo que se está buscando. Sirve para entender por qué una app
 * aparece en los resultados cuando el término no está en el nombre sino en la descripción.
 */
export default function Highlight({ text, term }: { text: string; term: string }) {
  const partes = splitMatch(text, term);

  return (
    <>
      {partes.map((parte, i) =>
        parte.match ? (
          <mark key={i} className="search-hit">
            {parte.text}
          </mark>
        ) : (
          <span key={i}>{parte.text}</span>
        ),
      )}
    </>
  );
}
