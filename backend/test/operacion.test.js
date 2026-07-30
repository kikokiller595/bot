const test = require('node:test');
const assert = require('node:assert/strict');
const {
  estaLoteriaCerrada,
  obtenerClaveFechaOperativa,
  obtenerLimitesDiaOperativo,
  formatearFechaHoraOperativa,
  zonaAInstante,
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

test('zonaAInstante convierte hora de pared ET al instante UTC correcto', () => {
  // Verano (EDT = UTC-4): medianoche ET del 8-jun = 04:00Z.
  assert.equal(
    zonaAInstante(2026, 6, 8, 0, 0, 0, 'America/New_York').toISOString(),
    '2026-06-08T04:00:00.000Z'
  );
  // Invierno (EST = UTC-5): medianoche ET del 15-ene = 05:00Z.
  assert.equal(
    zonaAInstante(2026, 1, 15, 0, 0, 0, 'America/New_York').toISOString(),
    '2026-01-15T05:00:00.000Z'
  );
});

test('obtenerLimitesDiaOperativo calcula el dia ET (no UTC)', () => {
  const { inicio, fin } = obtenerLimitesDiaOperativo(
    '2026-06-08',
    'America/New_York'
  );
  assert.equal(inicio.toISOString(), '2026-06-08T04:00:00.000Z');
  assert.equal(fin.toISOString(), '2026-06-09T03:59:59.999Z');

  // Una venta a las 9pm ET del 8-jun ocurre a las 01:00Z del 9-jun; debe caer
  // dentro del dia operativo del 8-jun (antes se filtraba al dia equivocado).
  const ventaNoche = new Date('2026-06-09T01:00:00.000Z');
  assert.ok(ventaNoche >= inicio && ventaNoche <= fin);
});

test('formatearFechaHoraOperativa muestra la hora en ET', () => {
  // 01:00Z = 21:00 del dia anterior en ET.
  const texto = formatearFechaHoraOperativa(
    new Date('2026-06-09T01:00:00.000Z'),
    'America/New_York'
  );
  assert.match(texto, /^08\/06\/2026/);
  assert.match(texto, /21:00:00/);
});
