import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getApplications } from '../api/client';
import type { ApplicationListItem } from '../types/application';
import { copyText, LAYER_META } from '../lib/appActions';

export default function ReportPage() {
  const [apps, setApps] = useState<ApplicationListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Lo que ocultaste tampoco sale acá: si lo sacaste de la vista, no querés que
  // aparezca en el reporte que le pasás a alguien.
  const [includeHidden, setIncludeHidden] = useState(false);

  useEffect(() => {
    getApplications({ includeHidden, sort: 'name', pageSize: 500 })
      .then(({ items, total }) => {
        setApps(items);
        setError(total > items.length ? `El reporte muestra ${items.length} de ${total} aplicaciones.` : null);
      })
      .catch(() => setError('No se pudo cargar. ¿Está corriendo el backend?'));
  }, [includeHidden]);

  const stacks = useMemo(
    () => new Set(apps.map((a) => a.stack).filter((s): s is string => !!s && s.trim() !== '')),
    [apps],
  );

  const rows = apps.map((a) => ({
    name: a.name,
    client: a.clientName ?? '',
    layer: a.layer ? LAYER_META[a.layer].label : '',
    status: a.status,
    stack: a.stack ?? '',
    tags: a.tags.join(', '),
  }));

  function toMarkdown() {
    const head = '| Aplicación | Cliente | Estado | Tecnologías | Tags |\n|---|---|---|---|---|';
    const body = rows
      .map((r) => `| ${r.name} | ${r.client} | ${r.status} | ${r.stack} | ${r.tags} |`)
      .join('\n');
    return `${head}\n${body}`;
  }

  function toCsv() {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const head = ['Aplicacion', 'Cliente', 'Estado', 'Tecnologias', 'Tags'].join(',');
    const body = rows.map((r) => [r.name, r.client, r.status, r.stack, r.tags].map(esc).join(',')).join('\n');
    return `${head}\n${body}`;
  }

  async function handleCopy() {
    if (await copyText(toMarkdown())) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  function handleDownload() {
    const blob = new Blob([toCsv()], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'devatlas-tecnologias.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Reporte de tecnologías</h1>
        <Link to="/" className="btn-secondary">
          ← Volver
        </Link>
      </div>

      <p className="settings-hint">
        {apps.length} aplicaciones · {stacks.size} tecnologías distintas. Copialo o descargalo para pasar cuando te
        pidan “qué usa tal app”.
      </p>

      {error && <p className="error">{error}</p>}

      <div className="report-actions">
        <button type="button" className="btn-primary" onClick={handleCopy}>
          {copied ? '✓ Copiado' : '📋 Copiar tabla'}
        </button>
        <button type="button" className="btn-secondary" onClick={handleDownload}>
          ⬇ Descargar CSV
        </button>
        <label className="toolbar-check" title="Archivadas, deprecadas y las de clientes ocultos">
          <input type="checkbox" checked={includeHidden} onChange={(e) => setIncludeHidden(e.target.checked)} />
          Incluir ocultas
        </label>
      </div>

      <div className="report-table-wrap">
        <table className="report-table">
          <thead>
            <tr>
              <th>Aplicación</th>
              <th>Cliente</th>
              <th>Capa</th>
              <th>Estado</th>
              <th>Tecnologías</th>
              <th>Tags</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.name}</td>
                <td>{r.client || <span className="db-muted">—</span>}</td>
                <td>{r.layer || <span className="db-muted">—</span>}</td>
                <td>{r.status}</td>
                <td>{r.stack || <span className="db-muted">sin cargar</span>}</td>
                <td>{r.tags || <span className="db-muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
