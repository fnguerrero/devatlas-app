import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { UiProvider, useUi } from './UiContext';

function Demo() {
  const { confirm, toast } = useUi();
  return (
    <>
      <button type="button" onClick={() => confirm({ title: 'Borrar', message: '¿Seguro?' })}>
        Abrir diálogo
      </button>
      <button type="button" onClick={() => toast('Hecho')}>
        Avisar
      </button>
    </>
  );
}

const renderDemo = () =>
  render(
    <UiProvider>
      <Demo />
    </UiProvider>,
  );

describe('UiContext', () => {
  it('el diálogo arranca con el foco adentro', async () => {
    const user = userEvent.setup();
    renderDemo();

    await user.click(screen.getByRole('button', { name: 'Abrir diálogo' }));

    const dialogo = await screen.findByRole('dialog');
    expect(dialogo).toContainElement(document.activeElement as HTMLElement);
  });

  it('el Tab no se escapa del diálogo', async () => {
    const user = userEvent.setup();
    renderDemo();
    await user.click(screen.getByRole('button', { name: 'Abrir diálogo' }));
    const dialogo = await screen.findByRole('dialog');

    // Varias vueltas de Tab: el foco tiene que seguir adentro del diálogo.
    for (let i = 0; i < 5; i++) {
      await user.tab();
      expect(dialogo).toContainElement(document.activeElement as HTMLElement);
    }

    await user.tab({ shift: true });
    expect(dialogo).toContainElement(document.activeElement as HTMLElement);
  });

  it('al cerrar, el foco vuelve al botón que lo abrió', async () => {
    const user = userEvent.setup();
    renderDemo();
    const disparador = screen.getByRole('button', { name: 'Abrir diálogo' });

    await user.click(disparador);
    const dialogo = await screen.findByRole('dialog');
    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(disparador).toHaveFocus());
  });

  it('Escape cancela el diálogo', async () => {
    const user = userEvent.setup();
    renderDemo();
    await user.click(screen.getByRole('button', { name: 'Abrir diálogo' }));
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('los toasts se anuncian por region viva', async () => {
    const user = userEvent.setup();
    renderDemo();

    await user.click(screen.getByRole('button', { name: 'Avisar' }));

    const region = await screen.findByRole('status');
    expect(region).toHaveTextContent('Hecho');
  });
});
