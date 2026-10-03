import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  DEMO_WORKSPACE,
  clearToken,
  getMe,
  getToken,
  isDemoWorkspace,
  loginWithGoogle,
  setToken,
  setUnauthorizedHandler,
  setWorkspace,
} from '../api/client';
import type { AuthUser } from '../types/application';

interface AuthState {
  user: AuthUser | null;
  ready: boolean;
  /** true = estás operando sobre el workspace demo en vez del tuyo. */
  demo: boolean;
  enterDemo: () => void;
  exitDemo: () => void;
  loginWithCredential: (credential: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [demo, setDemo] = useState(isDemoWorkspace);

  // El workspace demo dejó de ser público: hay que estar logueado para entrar.
  // Se recarga la página para que todos los datos se traigan con el scope nuevo.
  function enterDemo() {
    if (!user) return;
    setWorkspace(DEMO_WORKSPACE);
    setDemo(true);
    window.location.assign('/');
  }

  function exitDemo() {
    setWorkspace(null);
    setDemo(false);
    window.location.assign('/');
  }

  useEffect(() => {
    // Si el backend rechaza el token (vencido o firmado con otra clave), se vuelve al login.
    setUnauthorizedHandler(() => {
      setUser(null);
      setDemo(false);
    });

    if (!getToken()) {
      setWorkspace(null);
      setDemo(false);
      setReady(true);
      return;
    }

    getMe()
      .then(setUser)
      .catch(() => {
        // Sólo el 401 cierra la sesión (lo hace el handler de arriba). Un backend caído
        // o sin red no tiene por qué desloguear: el token se conserva para el próximo intento.
        setUser(null);
      })
      .finally(() => setReady(true));
  }, []);

  async function loginWithCredential(credential: string) {
    const res = await loginWithGoogle(credential);
    setToken(res.token);
    setWorkspace(null);
    setUser(res.user);
    // Recarga para que todos los datos se traigan con el scope del nuevo usuario.
    window.location.assign('/');
  }

  function logout() {
    clearToken();
    setWorkspace(null);
    setUser(null);
    window.location.assign('/');
  }

  return (
    <AuthContext.Provider value={{ user, ready, demo, enterDemo, exitDemo, loginWithCredential, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fuera de AuthProvider');
  return ctx;
}
