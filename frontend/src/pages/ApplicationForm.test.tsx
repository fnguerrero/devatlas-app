import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ApplicationForm from './ApplicationForm';
import { UiProvider } from '../context/UiContext';
import * as api from '../api/client';

vi.mock('../api/client');

function renderForm() {
  return render(
    <MemoryRouter initialEntries={['/apps/new']}>
      <UiProvider>
        <Routes>
          <Route path="/apps/new" element={<ApplicationForm />} />
          <Route path="/" element={<h1>Listado</h1>} />
          <Route path="/apps/:id" element={<h1>Detalle</h1>} />
        </Routes>
      </UiProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(api.getEnvironments).mockResolvedValue([
    { id: 1, name: 'Dev', sortOrder: 1, color: '#16a34a', urlCount: 0 },
  ]);
  vi.mocked(api.getClients).mockResolvedValue([]);
});

describe('ApplicationForm', () => {
  it('no guarda sin nombre y lo dice al lado del campo', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Poné un nombre para la aplicación.')).toBeInTheDocument();
    expect(vi.mocked(api.createApplication)).not.toHaveBeenCalled();
  });

  it('rechaza una URL que no arranca con http', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/Nombre/), 'App nueva');
    await user.selectOptions(await screen.findByLabelText('Ambiente de la URL 1'), 'Dev');
    await user.type(screen.getByLabelText('URL 1'), 'localhost:5173');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText(/tiene que empezar con http/i)).toBeInTheDocument();
    expect(vi.mocked(api.createApplication)).not.toHaveBeenCalled();
  });

  it('pide el ambiente cuando se cargó una URL suelta', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/Nombre/), 'App nueva');
    await user.type(screen.getByLabelText('URL 1'), 'https://dev.test');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText(/Elegí a qué ambiente/)).toBeInTheDocument();
  });

  it('guarda cuando los datos están bien', async () => {
    vi.mocked(api.createApplication).mockResolvedValue({
      id: 'id-1',
      name: 'App nueva',
    } as never);
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/Nombre/), 'App nueva');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(vi.mocked(api.createApplication)).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'App nueva' }),
      ),
    );
  });

  it('avisa al cancelar con cambios sin guardar', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/Nombre/), 'A medio cargar');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    const dialogo = await screen.findByRole('dialog');
    expect(dialogo).toHaveTextContent('Hay cambios sin guardar');

    // Si se arrepiente, se queda en el formulario con lo escrito. El "Cancelar" que hay
    // que tocar es el del diálogo, no el del formulario que quedó detrás.
    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByLabelText(/Nombre/)).toHaveValue('A medio cargar');
  });

  it('sale sin preguntar si no se tocó nada', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(await screen.findByRole('heading', { name: 'Listado' })).toBeInTheDocument();
  });
});
