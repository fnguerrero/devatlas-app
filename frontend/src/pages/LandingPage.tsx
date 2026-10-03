import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export default function LandingPage() {
  const { loginWithCredential } = useAuth();
  const btnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!CLIENT_ID) return;
    function init() {
      const g = window.google;
      if (!g?.accounts?.id || !btnRef.current) return;
      g.accounts.id.initialize({
        client_id: CLIENT_ID!,
        callback: (resp) => loginWithCredential(resp.credential),
      });
      g.accounts.id.renderButton(btnRef.current, { theme: 'filled_blue', size: 'large', text: 'signin_with', shape: 'pill' });
    }
    const scriptId = 'gsi-client';
    if (document.getElementById(scriptId)) {
      init();
      return;
    }
    const s = document.createElement('script');
    s.id = scriptId;
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = init;
    document.body.appendChild(s);
  }, [loginWithCredential]);

  return (
    <div className="landing">
      <div className="landing-card">
        <h1 className="landing-title">DevAtlas</h1>
        <p className="landing-sub">
          Tu catálogo de aplicaciones de desarrollo: repos, ambientes, URLs, bases de datos y runbooks, todo en un
          lugar.
        </p>

        <div className="landing-actions">
          {CLIENT_ID ? (
            <div ref={btnRef} />
          ) : (
            <p className="db-muted">Configurá VITE_GOOGLE_CLIENT_ID para habilitar el login.</p>
          )}
        </div>

        <p className="landing-note">
          Entrá con tu cuenta de Google para acceder a tu espacio. El workspace de datos de prueba está disponible
          desde Configuración, una vez adentro.
        </p>
      </div>
    </div>
  );
}
