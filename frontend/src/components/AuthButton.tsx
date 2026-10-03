import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

// Tipos mínimos de Google Identity Services.
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (r: { credential: string }) => void }) => void;
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
        };
      };
    };
  }
}

export default function AuthButton() {
  const { user, ready, loginWithCredential, logout } = useAuth();
  const btnRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (user || !CLIENT_ID) return;

    function init() {
      const g = window.google;
      if (!g?.accounts?.id || !btnRef.current) return;
      g.accounts.id.initialize({
        client_id: CLIENT_ID!,
        callback: (resp) => loginWithCredential(resp.credential),
      });
      g.accounts.id.renderButton(btnRef.current, { theme: 'outline', size: 'medium', text: 'signin_with', shape: 'pill' });
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
  }, [user, loginWithCredential]);

  if (!CLIENT_ID) return null;
  if (!ready) return null;

  if (user) {
    return (
      <div className="account">
        <button
          type="button"
          className="account-btn"
          onClick={() => setMenuOpen((o) => !o)}
          title={`${user.name} · ${user.email}`}
          aria-label={`Sesión de ${user.name}`}
        >
          {user.picture ? (
            <img src={user.picture} alt="" className="account-avatar" referrerPolicy="no-referrer" />
          ) : (
            <span className="account-avatar-fallback">{user.name.charAt(0).toUpperCase()}</span>
          )}
        </button>
        {menuOpen && (
          <div className="account-menu">
            <div className="account-who">{user.name}</div>
            <div className="account-email">{user.email}</div>
            <button type="button" className="account-logout" onClick={logout}>
              Salir
            </button>
          </div>
        )}
      </div>
    );
  }

  return <div ref={btnRef} className="google-btn" />;
}
