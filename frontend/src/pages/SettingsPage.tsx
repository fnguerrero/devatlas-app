import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getTheme, setTheme, type Theme } from '../lib/theme';
import { useAuth } from '../context/AuthContext';
import { exportBackup, importBackup } from '../api/client';
import { useUi } from '../context/UiContext';

const OPTIONS: { value: Theme; label: string; hint: string }[] = [
  { value: 'light', label: '☀️ Claro', hint: 'Siempre claro' },
  { value: 'dark', label: '🌙 Oscuro', hint: 'Siempre oscuro' },
  { value: 'auto', label: '🖥️ Automático', hint: 'Según el sistema' },
];

export default function SettingsPage() {
  const [theme, setThemeState] = useState<Theme>(getTheme());
  const { user, demo, enterDemo, exitDemo } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { confirm, toast } = useUi();

  function choose(t: Theme) {
    setTheme(t);
    setThemeState(t);
  }

  async function handleExport() {
    setBusy(true);
    try {
      const data = await exportBackup();
      const stamp = new Date().toISOString().slice(0, 10);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = `devatlas-backup-${stamp}.json`;
      link.click();
      URL.revokeObjectURL(href);
      toast('Backup descargado.');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(file: File, mode: 'merge' | 'replace') {
    setBusy(true);
    try {
      const backup = JSON.parse(await file.text());
      const res = await importBackup(backup, mode);
      toast(
        `Importado: ${res.applicationsCreated} apps nuevas, ${res.applicationsSkipped} ya existían, ` +
          `${res.clientsCreated} clientes y ${res.environmentsCreated} ambientes creados.`,
      );
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function pickFile(mode: 'merge' | 'replace') {
    const input = fileRef.current;
    if (!input) return;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (mode === 'replace') {
        const target = demo ? 'el workspace demo' : 'tu workspace';
        const ok = await confirm({
          title: 'Restaurar reemplazando',
          message: `Se borran todas las aplicaciones de ${target} antes de importar el archivo. No se puede deshacer.`,
          confirmLabel: 'Borrar e importar',
          danger: true,
        });
        if (!ok) {
          input.value = '';
          return;
        }
      }
      await handleImport(file, mode);
    };
    input.click();
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Configuración</h1>
        <Link to="/" className="btn-secondary">
          ← Volver
        </Link>
      </div>

      <section className="settings-group">
        <h2>Apariencia</h2>
        <p className="settings-hint">Elegí el tema de la aplicación.</p>
        <div className="theme-options">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`theme-card${theme === o.value ? ' active' : ''}`}
              onClick={() => choose(o.value)}
            >
              <span className="theme-card-label">{o.label}</span>
              <span className="theme-card-hint">{o.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="settings-group">
        <h2>Workspace</h2>
        <p className="settings-hint">
          {demo
            ? 'Estás en el workspace de datos de prueba. Lo que edites acá no toca tu catálogo.'
            : `Estás en tu workspace (${user?.email}). El de datos de prueba es aparte y editable.`}
        </p>
        <div className="workspace-switch">
          <button
            type="button"
            className={`theme-card${!demo ? ' active' : ''}`}
            onClick={exitDemo}
            disabled={!demo}
          >
            <span className="theme-card-label">👤 Mi workspace</span>
            <span className="theme-card-hint">Tus aplicaciones</span>
          </button>
          <button
            type="button"
            className={`theme-card${demo ? ' active' : ''}`}
            onClick={enterDemo}
            disabled={demo}
          >
            <span className="theme-card-label">🧪 Datos de prueba</span>
            <span className="theme-card-hint">Workspace demo</span>
          </button>
        </div>
      </section>

      <section className="settings-group">
        <h2>Backup</h2>
        <p className="settings-hint">
          El catálogo vive en un archivo SQLite local. Exportá un JSON cada tanto para no depender de esa única
          copia. Las contraseñas de las conexiones se exportan cifradas: para volver a leerlas hace falta también
          la carpeta <code>keys/</code> del backend.
        </p>
        <div className="backup-actions">
          <button type="button" className="btn-secondary" onClick={handleExport} disabled={busy}>
            ⬇ Exportar JSON
          </button>
          <button type="button" className="btn-secondary" onClick={() => pickFile('merge')} disabled={busy}>
            ⬆ Importar (agregar)
          </button>
          <button type="button" className="btn-danger" onClick={() => pickFile('replace')} disabled={busy}>
            ⚠ Restaurar (reemplaza todo)
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden />
      </section>
    </div>
  );
}
