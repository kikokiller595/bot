const test = require('node:test');
const assert = require('node:assert/strict');
const {
  construirOperacionAnulacion,
  construirOperacionPago
} = require('../services/pagosPremiosService');
const {
  contarCoincidenciasBulk,
  crearClavePago,
  crearReferenciaPago,
  esErrorTransaccionNoDisponible
} = require('../utils/pagos');

test('genera la misma clave para el mismo ticket sin importar el orden', () => {
  const primera = crearClavePago([{ _id: 'b' }, { _id: 'a' }]);
  const segunda = crearClavePago([{ _id: 'a' }, { _id: 'b' }]);
  const diferente = crearClavePago([{ _id: 'a' }, { _id: 'c' }]);

  assert.equal(primera, segunda);
  assert.notEqual(primera, diferente);
});

test('prioriza grupoId para identificar el ticket completo', () => {
  assert.deepEqual(
    crearReferenciaPago({
      grupoId: 'grupo-1',
      ticketId: 'ticket-1',
      id: 'sorteo-1'
    }),
    {
      tipo: 'grupoId',
      valor: 'grupo-1'
    }
  );
});

test('construye pagos con compare-and-set para bloquear doble cobro', () => {
  const operacion = construirOperacionPago({
    sorteo: { _id: 'sorteo-1' },
    resultado: {
      premioTotal: 110,
      coincidencias: [{ numeroGanador: '23' }]
    },
    pago: { _id: 'pago-1' },
    contexto: {
      usuario: 'usuario-1',
      usuarioNombre: 'Admin',
      puntoVenta: null,
      puntoVentaNombre: 'Administracion Central',
      fecha: new Date('2026-06-08T12:00:00.000Z')
    }
  });

  assert.deepEqual(operacion.updateOne.filter, {
    _id: 'sorteo-1',
    pagado: { $ne: true }
  });
  assert.equal(operacion.updateOne.update.$set.pagado, true);
  assert.equal(operacion.updateOne.update.$set.pagoPremio, 'pago-1');
  assert.equal(operacion.updateOne.update.$set.premio, 110);
});

test('anula solo sorteos que siguen pagados', () => {
  const operacion = construirOperacionAnulacion({
    sorteo: { _id: 'sorteo-1' }
  });

  assert.deepEqual(operacion.updateOne.filter, {
    _id: 'sorteo-1',
    pagado: true
  });
  assert.equal(operacion.updateOne.update.$set.pagado, false);
  assert.equal(operacion.updateOne.update.$set.pagoPremio, null);
});

test('normaliza resultados bulk y errores de transaccion', () => {
  assert.equal(contarCoincidenciasBulk({ matchedCount: 2 }), 2);
  assert.equal(contarCoincidenciasBulk({ result: { nMatched: 3 } }), 3);
  assert.equal(
    esErrorTransaccionNoDisponible({
      code: 20,
      message: 'Transaction numbers are only allowed on a replica set member'
    }),
    true
  );
});
