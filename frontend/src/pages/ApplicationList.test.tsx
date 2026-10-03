import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ApplicationList from './ApplicationList';
import { UiProvider } from '../context/UiContext';
import type { ApplicationListItem } from '../types/application';
import * as api from '../api/client';

vi.mock('../api/client');
// El botón de sesión necesita el contexto de auth y no aporta nada a lo que se prueba acá.
vi.mock('../components/AuthButton', () => ({ default: () => null }));

const app = (over: Partial<ApplicationListItem> = {}): ApplicationListItem => ({
  id: over.id ?? 'id-1',
  name: 'Portal Pedidos',
  description: 'Front del portal de pedidos',
  stack: 'React',
  repoPath: 'https://github.com/x/portal',
  owner: 'Ana',
  layer: 'frontend',
  isExternal: false,
  status: 'active',
  clientId: 1,
  clientName: 'Acme',
  clientColor: '#7c3aed',
  isFavorite: false,
  isArchived: false,
  urls: [
    { id: 1, environment: 'Dev', color: '#16a34a', url: 'https://dev.test' },
    { id: 2, environment: 'Prod', color: '#dc2626', url: 'https://prod.test' },
  ],
  tags: ['pedidos'],
  ...over,
});

function renderList(ruta = '/') {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <UiProvider>
        <Routes>
          <Route path="/" element={<ApplicationList />} />
          <Route path="/apps/new" element={<h1>Alta de aplicación</h1>} />
          <Route path="/apps/:id/edit" element={<h1>Edición</h1>} />
        </Routes>
      </UiProvider>
    </MemoryRouter>,
  );
}

const mocked = vi.mocked(api);

beforeEach(() => {
  vi.mocked(api.getTags).mockResolvedValue(['pedidos', 'interno']);
  vi.mocked(api.getClients).mockResolvedValue([
    { id: 1, name: 'Acme', color: '#7c3aed', appCount: 2, isHidden: false },
  ]);
  vi.mocked(api.getStats).mockResolvedValue({
    total: 1,
    favorites: 0,
    archived: 0,
    distinctStacks: 1,
    distinctTags: 1,
    byStack: [{ name: 'React', count: 1 }],
    topTags: [{ name: 'pedidos', count: 1 }],
  });
  vi.mocked(api.getApplications).mockResolvedValue({ items: [app()], total: 1 });
});

describe('ApplicationList', () => {
  it('muestra esqueletos mientras carga y después las apps', async () => {
    const { container } = renderList();

    expect(container.querySelectorAll('[data-testid="skeleton-card"]').length).toBeGreaterThan(0);
    expect(await screen.findByRole('heading', { name: /Portal Pedidos/ })).toBeInTheDocument();
    expect(container.querySelectorAll('[data-testid="skeleton-card"]')).toHaveLength(0);
  });

  it('escribe la búsqueda en la URL y la manda al backend', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('heading', { name: /Portal Pedidos/ });

    await user.type(screen.getByRole('textbox', { name: /buscar/i }), 'pedidos');

    await waitFor(() =>
      expect(vi.mocked(api.getApplications)).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'pedidos' }),
        expect.anything(),
      ),
    );
  });

  it('arranca con los filtros que vienen en la URL', async () => {
    renderList('/?q=portal&capa=frontend&origen=own');

    await waitFor(() =>
      expect(vi.mocked(api.getApplications)).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'portal', layer: 'frontend', origin: 'own' }),
        expect.anything(),
      ),
    );

    // Y los muestra como chips que se pueden soltar de a uno.
    expect(screen.getByRole('button', { name: /Quitar filtro Capa/ })).toBeInTheDocument();
  });

  it('quita un filtro desde su chip', async () => {
    const user = userEvent.setup();
    renderList('/?capa=frontend');
    await screen.findByRole('heading', { name: /Portal Pedidos/ });

    await user.click(screen.getByRole('button', { name: /Quitar filtro Capa/ }));

    await waitFor(() =>
      expect(vi.mocked(api.getApplications)).toHaveBeenLastCalledWith(
        expect.objectContaining({ layer: undefined }),
        expect.anything(),
      ),
    );
  });

  it('resalta el término buscado en el nombre', async () => {
    const { container } = renderList('/?q=pedidos');

    await screen.findByRole('heading', { name: /Portal Pedidos/ });
    const marcas = container.querySelectorAll('mark.search-hit');

    expect(marcas.length).toBeGreaterThan(0);
    expect(marcas[0].textContent?.toLowerCase()).toBe('pedidos');
  });

  it('con "/" enfoca el buscador y con "n" abre el alta', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('heading', { name: /Portal Pedidos/ });

    await user.keyboard('/');
    expect(screen.getByRole('textbox', { name: /buscar/i })).toHaveFocus();

    // Con el foco en el buscador, "n" tiene que escribirse, no navegar.
    await user.keyboard('n');
    expect(screen.queryByRole('heading', { name: 'Alta de aplicación' })).not.toBeInTheDocument();

    await user.click(document.body);
    await user.keyboard('n');
    expect(await screen.findByRole('heading', { name: 'Alta de aplicación' })).toBeInTheDocument();
  });

  it('muestra el botón de cargar más cuando hay más de una página', async () => {
    vi.mocked(api.getApplications).mockResolvedValue({ items: [app()], total: 30 });
    const user = userEvent.setup();
    renderList();

    const boton = await screen.findByRole('button', { name: /Cargar más \(1 de 30\)/ });
    vi.mocked(api.getApplications).mockResolvedValue({ items: [app({ id: 'id-2' })], total: 30 });
    await user.click(boton);

    await waitFor(() =>
      expect(vi.mocked(api.getApplications)).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 }),
        expect.anything(),
      ),
    );
  });

  it('archiva desde el menú de la card y avisa con un toast', async () => {
    vi.mocked(api.setArchived).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('heading', { name: /Portal Pedidos/ });

    await user.click(screen.getAllByRole('button', { name: /Más acciones de Portal Pedidos/ })[0]);
    await user.click(await screen.findByRole('menuitem', { name: 'Archivar' }));

    expect(vi.mocked(api.setArchived)).toHaveBeenCalledWith('id-1', true);
    expect(await screen.findByText(/archivada/i)).toBeInTheDocument();
  });

  it('avisa con un toast de error cuando falla marcar favorito', async () => {
    vi.mocked(api.setFavorite).mockRejectedValue(new Error('Se cayó la API'));
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('heading', { name: /Portal Pedidos/ });

    await user.click(screen.getAllByRole('button', { name: /Marcar Portal Pedidos como favorito/ })[0]);

    expect(await screen.findByText('Se cayó la API')).toBeInTheDocument();
  });

  it('abre todos los ambientes de una app desde el menú', async () => {
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null);
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('heading', { name: /Portal Pedidos/ });

    await user.click(screen.getAllByRole('button', { name: /Más acciones de Portal Pedidos/ })[0]);
    await user.click(await screen.findByRole('menuitem', { name: 'Abrir todos los ambientes' }));

    expect(abrir).toHaveBeenCalledTimes(2);
  });

  it('copia las URLs al portapapeles desde el menú', async () => {
    // userEvent instala su propio portapapeles de mentira al hacer setup(), así que el
    // espía se pone después: al revés, lo pisa y el test verifica una función que nadie llama.
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    renderList();
    await screen.findByRole('heading', { name: /Portal Pedidos/ });

    await user.click(screen.getAllByRole('button', { name: /Más acciones de Portal Pedidos/ })[0]);
    await user.click(await screen.findByRole('menuitem', { name: 'Copiar URLs' }));

    expect(writeText).toHaveBeenCalledWith('Dev: https://dev.test\nProd: https://prod.test');
    expect(await screen.findByText('URLs copiadas.')).toBeInTheDocument();
  });

  it('exporta el catálogo filtrado a CSV', async () => {
    mocked.downloadApplicationsCsv.mockResolvedValue(new Blob(['csv'], { type: 'text/csv' }));
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();

    const user = userEvent.setup();
    renderList('/?capa=frontend');
    await screen.findByRole('heading', { name: /Portal Pedidos/ });

    await user.click(screen.getByRole('button', { name: 'Exportar' }));

    await waitFor(() =>
      expect(mocked.downloadApplicationsCsv).toHaveBeenCalledWith(
        expect.objectContaining({ layer: 'frontend' }),
      ),
    );
    expect(await screen.findByText('Catálogo exportado.')).toBeInTheDocument();
  });

  it('ofrece limpiar los filtros cuando no hay resultados', async () => {
    vi.mocked(api.getApplications).mockResolvedValue({ items: [], total: 0 });
    const user = userEvent.setup();
    renderList('/?q=nada');

    const limpiar = await screen.findByRole('button', { name: 'Limpiar filtros' });
    await user.click(limpiar);

    await waitFor(() =>
      expect(vi.mocked(api.getApplications)).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: '' }),
        expect.anything(),
      ),
    );
  });

  it('sin filtros y sin apps invita a cargar la primera', async () => {
    vi.mocked(api.getApplications).mockResolvedValue({ items: [], total: 0 });
    renderList();

    expect(await screen.findByText('No hay aplicaciones cargadas todavía.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Cargar la primera/ })).toBeInTheDocument();
  });

  it('muestra las apps abiertas últimamente', async () => {
    localStorage.setItem(
      'devatlas.recent',
      JSON.stringify([{ id: 'id-9', name: 'API Pedidos' }]),
    );
    renderList();

    const recientes = await screen.findByText('Recientes:');
    const barra = recientes.parentElement!;
    expect(within(barra).getByRole('link', { name: 'API Pedidos' })).toBeInTheDocument();
  });

  it('todos los botones tienen un nombre que se pueda leer', async () => {
    renderList();
    await screen.findByRole('heading', { name: /Portal Pedidos/ });

    // Los botones de sólo ícono (estrella, repo, menú, ambientes) son los que se olvidan;
    // sin nombre accesible, un lector de pantalla los anuncia como "botón" a secas.
    const sinNombre = screen
      .getAllByRole('button')
      .filter((b) => !(b.getAttribute('aria-label') || b.textContent?.trim()));

    expect(sinNombre).toHaveLength(0);
  });

  it('muestra la ayuda de atajos con "?"', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('heading', { name: /Portal Pedidos/ });

    await user.keyboard('?');

    expect(await screen.findByRole('dialog', { name: 'Atajos de teclado' })).toBeInTheDocument();
  });
});
