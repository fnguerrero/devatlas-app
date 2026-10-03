import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ApplicationDetail from './ApplicationDetail';
import { UiProvider } from '../context/UiContext';
import { getRecent } from '../lib/recent';
import type { ApplicationDetail as Detail } from '../types/application';
import * as api from '../api/client';

vi.mock('../api/client');
// La sección de ambientes pega a la API por su cuenta; acá se prueba el detalle.
vi.mock('../components/EnvironmentSection', () => ({ default: () => null }));

const detalle: Detail = {
  id: 'id-1',
  name: 'Portal Pedidos',
  description: 'Front del portal',
  repoPath: null,
  stack: 'React',
  notes: null,
  owner: 'Ana',
  layer: 'frontend',
  isExternal: false,
  status: 'active',
  clientId: 1,
  clientName: 'Acme',
  clientColor: '#7c3aed',
  isFavorite: false,
  isArchived: false,
  createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  updatedAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
  urls: [],
  databases: [],
  tags: ['pedidos'],
};

function renderDetalle() {
  return render(
    <MemoryRouter initialEntries={['/apps/id-1']}>
      <UiProvider>
        <Routes>
          <Route path="/apps/:id" element={<ApplicationDetail />} />
          <Route path="/apps/:id/edit" element={<h1>Edición</h1>} />
        </Routes>
      </UiProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(api.getApplication).mockResolvedValue(detalle);
});

describe('ApplicationDetail', () => {
  it('muestra un esqueleto mientras carga', async () => {
    renderDetalle();

    expect(screen.getAllByTestId('skeleton-line').length).toBeGreaterThan(0);
    expect(await screen.findByRole('heading', { name: /Portal Pedidos/ })).toBeInTheDocument();
  });

  it('anota la app como reciente al abrirla', async () => {
    renderDetalle();
    await screen.findByRole('heading', { name: /Portal Pedidos/ });

    expect(getRecent()).toEqual([{ id: 'id-1', name: 'Portal Pedidos' }]);
  });

  it('pone el nombre de la app en el título de la pestaña', async () => {
    renderDetalle();
    await screen.findByRole('heading', { name: /Portal Pedidos/ });

    expect(document.title).toBe('Portal Pedidos · DevAtlas');
  });

  it('muestra las fechas en lenguaje relativo con la exacta en el tooltip', async () => {
    renderDetalle();
    await screen.findByRole('heading', { name: /Portal Pedidos/ });

    expect(screen.getByText('hace 3 días')).toBeInTheDocument();
    expect(screen.getByText('hace 2 horas')).toHaveAttribute('title', expect.stringContaining('/'));
  });

  it('duplica la app y abre la copia en edición', async () => {
    vi.mocked(api.duplicateApplication).mockResolvedValue({ ...detalle, id: 'id-2', name: 'Portal Pedidos (copia)' });
    const user = userEvent.setup();
    renderDetalle();
    await screen.findByRole('heading', { name: /Portal Pedidos/ });

    await user.click(screen.getByRole('button', { name: 'Duplicar' }));

    expect(vi.mocked(api.duplicateApplication)).toHaveBeenCalledWith('id-1');
    expect(await screen.findByRole('heading', { name: 'Edición' })).toBeInTheDocument();
  });

  it('avisa si duplicar falla', async () => {
    vi.mocked(api.duplicateApplication).mockRejectedValue(new Error('No se pudo duplicar'));
    const user = userEvent.setup();
    renderDetalle();
    await screen.findByRole('heading', { name: /Portal Pedidos/ });

    await user.click(screen.getByRole('button', { name: 'Duplicar' }));

    await waitFor(() => expect(screen.getByText('No se pudo duplicar')).toBeInTheDocument());
  });
});
