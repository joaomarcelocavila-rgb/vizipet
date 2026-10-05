import { addDays, daysBetween, weekdayOf, zonedToUtc } from './time';

describe('zonedToUtc', () => {
  it('converte horário de Recife (UTC-3, sem horário de verão)', () => {
    expect(zonedToUtc('2026-10-20', '09:00').toISOString()).toBe('2026-10-20T12:00:00.000Z');
    expect(zonedToUtc('2026-12-31', '23:30').toISOString()).toBe('2027-01-01T02:30:00.000Z');
  });

  it('respeita fusos com horário de verão', () => {
    expect(zonedToUtc('2026-07-01', '09:00', 'Europe/Lisbon').toISOString()).toBe('2026-07-01T08:00:00.000Z');
    expect(zonedToUtc('2026-01-15', '09:00', 'Europe/Lisbon').toISOString()).toBe('2026-01-15T09:00:00.000Z');
  });
});

describe('datas de calendário', () => {
  it('soma dias atravessando mês e ano', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });

  it('calcula intervalo e dia da semana', () => {
    expect(daysBetween('2026-10-01', '2026-12-30')).toBe(90);
    expect(weekdayOf('2026-10-05')).toBe(1);
  });
});
