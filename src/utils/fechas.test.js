import { formatearFechaLocalInput } from './fechas';

test('formatea la fecha usando el dia local', () => {
  const fechaLocal = new Date(2026, 5, 14, 23, 30);

  expect(formatearFechaLocalInput(fechaLocal)).toBe('2026-06-14');
});

test('rechaza fechas invalidas', () => {
  expect(formatearFechaLocalInput('fecha-invalida')).toBe('');
});
