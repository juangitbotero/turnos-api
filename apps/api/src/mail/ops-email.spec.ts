import { renderOpsEmail, opsRef, eur, lisbonStamp, ptDate, joinParts } from './ops-email';

describe('ops email template', () => {
  it('builds a searchable reference from a uuid', () => {
    expect(opsRef('PAG', '94c47b2e-1111-2222-3333-444455556666')).toBe('PAG-94C47B');
  });

  it('formats money, dates and Lisbon times the way the team reads them', () => {
    expect(eur(60)).toBe('€60,00');
    expect(eur('7.5')).toBe('€7,50');
    expect(ptDate('2026-10-13')).toBe('13/10/2026');
    // 17:05 UTC in October is 18:05 in Lisbon (WEST, UTC+1)
    expect(lisbonStamp(new Date('2026-10-13T17:05:00Z'))).toBe('13/10/2026 18:05');
    expect(joinParts('Ana', null, '', '+351 912')).toBe('Ana · +351 912');
  });

  const base = {
    ref: 'PAG-94C47B',
    kind: 'Não-pagamento',
    subjectParts: ['Carolina Bakes', null, '€60,00'],
    summary: 'Ana diz que não recebeu €60,00.',
    facts: [
      ['Empresa', 'Carolina Bakes'],
      ['Comprovativo', null],
      ['Descrição', '<script>alert(1)</script>'],
    ] as Array<[string, string | null]>,
    links: [{ label: 'Ver comprovativo', url: 'https://api.example/uploads/p.pdf' }, { label: 'Pay Link', url: null }],
    steps: ['Contactar a empresa.'],
    deadline: '48 horas',
    contacts: [{ label: 'Escrever à empresa', email: 'empresa@example.pt' }, { label: 'Escrever ao trabalhador', email: null }],
  };

  it('puts reference, kind and parts in the subject, dropping empty parts', () => {
    expect(renderOpsEmail(base).subject).toBe('[PAG-94C47B] Não-pagamento · Carolina Bakes · €60,00');
  });

  it('escapes text typed by users and leaves out empty rows, links and contacts', () => {
    const { html } = renderOpsEmail(base);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('Comprovativo</td>');
    expect(html).toContain('https://api.example/uploads/p.pdf');
    expect(html).not.toContain('Pay Link');
    expect(html).not.toContain('Escrever ao trabalhador');
  });

  it('puts the reference in the subject of the reply buttons', () => {
    const { html } = renderOpsEmail(base);
    expect(html).toContain('mailto:empresa@example.pt?subject=%5BPAG-94C47B%5D%20Turnos%20%E2%80%94%20N%C3%A3o-pagamento');
  });
});
