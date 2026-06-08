const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calcularPremio,
  evaluarSorteoGanador,
  numeroCoincide
} = require('../utils/premios');

test('calcula premios straight y box', () => {
  assert.equal(calcularPremio('straight', '123', 2), 1400);
  assert.equal(calcularPremio('box', '123', 2), 232);
  assert.equal(numeroCoincide('321', '123', 'box'), true);
});

test('valida un premio derivado de Pick 3', () => {
  const resultado = evaluarSorteoGanador(
    {
      numero: '23',
      tipoApuesta: 'straight',
      monto: 2,
      fecha: new Date('2026-06-08T16:00:00.000Z')
    },
    {
      numerosGanadores: [{ numero: '123', fecha: '2026-06-08' }]
    },
    { zonaHoraria: 'America/New_York' }
  );

  assert.equal(resultado.ganador, true);
  assert.equal(resultado.premioTotal, 110);
});

test('rechaza resultados de otro dia', () => {
  const resultado = evaluarSorteoGanador(
    {
      numero: '123',
      tipoApuesta: 'straight',
      monto: 1,
      fecha: new Date('2026-06-08T16:00:00.000Z')
    },
    {
      numerosGanadores: [{ numero: '123', fecha: '2026-06-07' }]
    },
    { zonaHoraria: 'America/New_York' }
  );

  assert.equal(resultado.ganador, false);
  assert.equal(resultado.premioTotal, 0);
});
