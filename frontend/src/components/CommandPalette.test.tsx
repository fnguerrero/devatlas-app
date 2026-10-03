import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CommandPalette from './CommandPalette';
import * as api from '../api/client';

vi.mock('../api/client');

function renderPaleta() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <CommandPalette />
      <Routes>
        <Route path="/" element={<h1>Listado</h1>} />
        <Route path="/apps/:id" element={<h1>Detalle</h1>} />
        <Route path="/clients" element={<h1>Clientes</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(api.getApplications).mockResolvedValue({
    items: [
      {
        id: 'id-1',
        name: 'Portal Pedidos',
        description: null,
        stack: 'React',
        repoPath: null,
        owner: null,
        layer: null,
        isExternal: false,
        status: 'active',
        clientId: null,
        clientName: 'Acme',
        clientColor: null,
        isFavorite: false,
        isArchived: false,
        urls: [],
        tags: [],
      },
    ],
    total: 1,
  });
});

describe('CommandPalette', () => {
  it('no se ve hasta que se la abre con Ctrl+K', async () => {
    const user = userEvent.setup();
    renderPaleta();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.keyboard('{Control>}k{/Control}');

    expect(await screen.findByRole('dialog', { name: 'Ir a' })).toBeInTheDocument();
  });

  it('lista las apps que coinciden y entra con Enter', async () => {
    const user = userEvent.setup();
    renderPaleta();
    await user.keyboard('{Control>}k{/Control}');

    await user.type(screen.getByRole('textbox', { name: /Ir a/ }), 'pedidos');

    await waitFor(() =>
      expect(vi.mocked(api.getApplications)).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'pedidos' }),
        expect.anything(),
      ),
    );
    expect(await screen.findByRole('option', { name: /Portal Pedidos/ })).toBeInTheDocument();

    await user.keyboard('{Enter}');
    expect(await screen.findByRole('heading', { name: 'Detalle' })).toBeInTheDocument();
  });

  it('también salta a las secciones de la app', async () => {
    const user = userEvent.setup();
    renderPaleta();
    await user.keyboard('{Control>}k{/Control}');

    await user.type(screen.getByRole('textbox', { name: /Ir a/ }), 'clientes');
    await user.click(await screen.findByRole('option', { name: /Clientes/ }));

    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument();
  });

  it('se cierra con Escape', async () => {
    const user = userEvent.setup();
    renderPaleta();
    await user.keyboard('{Control>}k{/Control}');
    await screen.findByRole('dialog', { name: 'Ir a' });

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
