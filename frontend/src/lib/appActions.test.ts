import { describe, expect, it } from 'vitest';
import { isUrl, stackIcon } from './appActions';

describe('isUrl', () => {
  it('reconoce http y https', () => {
    expect(isUrl('https://devatlas.test')).toBe(true);
    expect(isUrl('http://localhost:5173')).toBe(true);
  });

  it('rechaza rutas locales y vacíos', () => {
    expect(isUrl('W:\\repos\\devatlas')).toBe(false);
    expect(isUrl('')).toBe(false);
    expect(isUrl(null)).toBe(false);
  });
});

describe('stackIcon', () => {
  it('mapea stacks conocidos', () => {
    expect(stackIcon('.NET 8')).toBe('🟣');
    expect(stackIcon('React + Vite')).toBe('⚛️');
  });

  it('cae al genérico cuando no reconoce el stack', () => {
    expect(stackIcon('Cobol')).toBe('📦');
    expect(stackIcon(null)).toBe('📦');
  });
});
