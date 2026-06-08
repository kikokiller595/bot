const test = require('node:test');
const assert = require('node:assert/strict');
const {
  estaLoteriaCerrada,
  obtenerClaveFechaOperativa,
  parseHoraCierreMinutos
} = require('../utils/operacion');

test('parsea horas de cierre de 12 y 24 horas', () => {
  assert.equal(parseHoraCierreMinutos('1:30 PM'), 13 * 60 + 30);
  assert.equal(parseHoraCierreMinutos('00:15'), 15);
  assert.equal(parseHoraCierreMinutos('25:00'), null);
});

test('determina el cierre usando la zona horaria operativa', () => {
  const mediodiaNuevaYork = new Date('2026-06-08T16:00:00.000Z');

  assert.equal(
    estaLoteriaCerrada(
      { horaCierre: '11:59 AM' },
      mediodiaNuevaYork,
      'America/New_York'
    ),
    true
  );
  assert.equal(
    estaLoteriaCerrada(
      { horaCierre: '12:30 PM' },
      mediodiaNuevaYork,
      'America/New_York'
    ),
    false
  );
});

test('normaliza fechas sin desplazarlas de dia', () => {
  assert.equal(
    obtenerClaveFechaOperativa('08/06/2026, 4:30:00 PM'),
    '2026-06-08'
  );
  assert.equal(
    obtenerClaveFechaOperativa(
      new Date('2026-06-09T02:00:00.000Z'),
      'America/New_York'
    ),
    '2026-06-08'
  );
});
