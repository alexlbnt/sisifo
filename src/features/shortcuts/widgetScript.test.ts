import { describe, expect, it } from 'vitest';
import widgetScript from '../../../scripts/widget/sisifo-widget.js?raw';

describe('script do widget (Scriptable)', () => {
  it('tem a linha que a cópia preenche com o endereço, uma vez só', () => {
    expect(widgetScript.split("const SISIFO_URL = '';").length - 1).toBe(1);
  });

  it('não leva nenhuma chave embutida: ela fica no Keychain do iPhone', () => {
    expect(widgetScript).not.toMatch(/sis_[A-Za-z0-9_-]{8,}/);
    expect(widgetScript).toContain('Keychain.get');
  });

  it('pede o formato que a API entrega', () => {
    expect(widgetScript).toContain('/api/summary?format=widget');
    expect(widgetScript).toContain('const FORMAT_VERSION = 1;');
  });
});
