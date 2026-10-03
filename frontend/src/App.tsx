import { Route, Routes } from 'react-router-dom';
import ApplicationList from './pages/ApplicationList';
import ApplicationDetail from './pages/ApplicationDetail';
import ApplicationForm from './pages/ApplicationForm';
import EnvironmentsManager from './pages/EnvironmentsManager';
import ClientsManager from './pages/ClientsManager';
import SettingsPage from './pages/SettingsPage';
import ReportPage from './pages/ReportPage';
import LandingPage from './pages/LandingPage';
import CommandPalette from './components/CommandPalette';
import PageTitle from './components/PageTitle';
import { useAuth } from './context/AuthContext';
import './App.css';

function App() {
  const { user, ready, demo, exitDemo } = useAuth();

  if (!ready) {
    return <div className="page">Cargando…</div>;
  }

  // Sin sesión no hay app: el backend rechaza todo con 401.
  if (!user) {
    return <LandingPage />;
  }

  return (
    <>
      <PageTitle />
      <CommandPalette />
      {/* Primer tabulable de la página: saltea el header y va directo al contenido. */}
      <a href="#contenido" className="skip-link">
        Saltar al contenido
      </a>
      {demo && (
        <div className="demo-banner">
          <span>Estás viendo <strong>datos de prueba</strong> (workspace demo), no los tuyos.</span>
          <button type="button" onClick={exitDemo}>
            Volver a mi workspace
          </button>
        </div>
      )}
      <main id="contenido">
      <Routes>
        <Route path="/" element={<ApplicationList />} />
        <Route path="/apps/new" element={<ApplicationForm />} />
        <Route path="/apps/:id" element={<ApplicationDetail />} />
        <Route path="/apps/:id/edit" element={<ApplicationForm />} />
        <Route path="/environments" element={<EnvironmentsManager />} />
        <Route path="/clients" element={<ClientsManager />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
      </main>
    </>
  );
}

export default App;
