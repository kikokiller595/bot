import React, { useState, useMemo, useEffect, useCallback } from 'react';
import './RecogidaSocios.css';
import recogidasService from '../services/recogidasService';
import { obtenerClaveFecha } from '../utils/dateParser';

const obtenerLunes = (fecha) => {
  const d = new Date(fecha);
  const dia = d.getDay(); // 0=domingo, 1=lunes...
  const diff = dia === 0 ? -6 : 1 - dia;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const formatearMoneda = (valor = 0) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(valor) || 0);

const formatearFechaCorta = (fecha) =>
  new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: '2-digit', month: 'short' }).format(fecha);

function RecogidaSocios({ sorteos = [], puntosVenta = [] }) {
  const [lunesActual, setLunesActual] = useState(() => obtenerLunes(new Date()));
  const [recogidas, setRecogidas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(null);
  const [error, setError] = useState(null);

  const semanaInicio = obtenerClaveFecha(lunesActual);
  const domingo = useMemo(() => {
    const d = new Date(lunesActual);
    d.setDate(d.getDate() + 6);
    return d;
  }, [lunesActual]);
  const semanaFin = obtenerClaveFecha(domingo);

  const cargarRecogidas = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await recogidasService.getRecogidas();
      setRecogidas(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || 'No se pudieron cargar las recogidas');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarRecogidas();
  }, [cargarRecogidas]);

  const filasPorPunto = useMemo(() => {
    const sorteosSemana = sorteos.filter((s) => {
      const clave = obtenerClaveFecha(s.fechaISO || s.fecha);
      return clave && clave >= semanaInicio && clave <= semanaFin;
    });

    const mapaRecogidas = new Map(
      recogidas
        .filter((r) => r.semanaInicio === semanaInicio)
        .map((r) => [String(r.puntoVentaId), r])
    );

    return (puntosVenta || [])
      .filter((pv) => pv.activo !== false)
      .map((pv) => {
        const pvId = String(pv.id || pv._id || '');
        const sorteosPv = sorteosSemana.filter((s) => String(s.puntoVentaId || '') === pvId);
        const venta = sorteosPv.reduce((sum, s) => sum + (Number(s.monto) || 0), 0);
        const premios = sorteosPv
          .filter((s) => s.ganador === true)
          .reduce((sum, s) => sum + (Number(s.premio) || 0), 0);
        const porcentaje = Number(pv.porcentajeSocio) || 0;
        const comision = (venta * porcentaje) / 100;
        const esperado = venta - premios - comision;
        const recogida = mapaRecogidas.get(pvId) || null;
        return {
          id: pvId,
          nombre: pv.nombre || 'Sin nombre',
          codigo: pv.codigo || '',
          porcentaje,
          venta,
          premios,
          comision,
          esperado,
          recogida
        };
      })
      .sort((a, b) => b.esperado - a.esperado);
  }, [sorteos, puntosVenta, recogidas, semanaInicio, semanaFin]);

  const totales = useMemo(() => {
    return filasPorPunto.reduce(
      (acc, f) => {
        acc.venta += f.venta;
        acc.premios += f.premios;
        acc.comision += f.comision;
        acc.esperado += f.esperado;
        if (f.recogida) {
          acc.recogido += Number(f.recogida.montoRecogido) || 0;
          acc.puntosRecogidos += 1;
        } else {
          acc.pendiente += f.esperado;
        }
        return acc;
      },
      { venta: 0, premios: 0, comision: 0, esperado: 0, recogido: 0, pendiente: 0, puntosRecogidos: 0 }
    );
  }, [filasPorPunto]);

  const marcarRecogido = async (fila) => {
    setGuardando(fila.id);
    setError(null);
    try {
      await recogidasService.registrarRecogida({
        puntoVentaId: fila.id,
        puntoVentaNombre: fila.nombre,
        semanaInicio,
        semanaFin,
        montoVenta: fila.venta,
        montoPremios: fila.premios,
        montoComision: fila.comision,
        montoEsperado: fila.esperado,
        montoRecogido: fila.esperado
      });
      await cargarRecogidas();
    } catch (e) {
      setError(e.message || 'No se pudo registrar la recogida');
    } finally {
      setGuardando(null);
    }
  };

  const deshacerRecogido = async (fila) => {
    if (!fila.recogida) return;
    setGuardando(fila.id);
    setError(null);
    try {
      await recogidasService.eliminarRecogida(fila.recogida.id);
      await cargarRecogidas();
    } catch (e) {
      setError(e.message || 'No se pudo deshacer la recogida');
    } finally {
      setGuardando(null);
    }
  };

  const cambiarSemana = (dias) => {
    setLunesActual((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + dias);
      return d;
    });
  };

  const irSemanaActual = () => setLunesActual(obtenerLunes(new Date()));

  const onSeleccionarFecha = (e) => {
    const valor = e.target.value;
    if (!valor) return;
    const partes = valor.split('-');
    const fecha = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
    if (!Number.isNaN(fecha.getTime())) {
      setLunesActual(obtenerLunes(fecha));
    }
  };

  const semanaActualClave = obtenerClaveFecha(obtenerLunes(new Date()));
  const esSemanaActual = semanaInicio === semanaActualClave;

  return (
    <div className="recogida-container">
      <div className="recogida-card">
        <div className="recogida-header">
          <div>
            <h2 className="recogida-title">Recogida de socios</h2>
            <p className="recogida-subtitle">
              Control semanal de lo que cada punto de venta debe entregar (venta − premios − comisión).
            </p>
          </div>
        </div>

        <div className="recogida-semana-nav">
          <button className="semana-btn" onClick={() => cambiarSemana(-7)} title="Semana anterior">
            ‹ Anterior
          </button>
          <div className="semana-rango">
            <span className="semana-rango-texto">
              {formatearFechaCorta(lunesActual)} — {formatearFechaCorta(domingo)} {domingo.getFullYear()}
            </span>
            {!esSemanaActual && (
              <button className="semana-hoy" onClick={irSemanaActual}>Ir a semana actual</button>
            )}
          </div>
          <button className="semana-btn" onClick={() => cambiarSemana(7)} title="Semana siguiente">
            Siguiente ›
          </button>
          <label className="semana-selector">
            <span>Ir a la semana de:</span>
            <input type="date" onChange={onSeleccionarFecha} />
          </label>
        </div>

        {error && <div className="recogida-error">{error}</div>}

        <div className="recogida-totales">
          <div className="total-card">
            <span className="total-label">Venta de la semana</span>
            <strong className="total-value">{formatearMoneda(totales.venta)}</strong>
          </div>
          <div className="total-card">
            <span className="total-label">Premios pagados</span>
            <strong className="total-value total-rojo">{formatearMoneda(totales.premios)}</strong>
          </div>
          <div className="total-card">
            <span className="total-label">Comisión socios</span>
            <strong className="total-value">{formatearMoneda(totales.comision)}</strong>
          </div>
          <div className="total-card total-card--destacado">
            <span className="total-label">Total a recoger</span>
            <strong className="total-value total-verde">{formatearMoneda(totales.esperado)}</strong>
          </div>
          <div className="total-card">
            <span className="total-label">Ya recogido</span>
            <strong className="total-value total-verde">{formatearMoneda(totales.recogido)}</strong>
          </div>
          <div className="total-card total-card--destacado">
            <span className="total-label">Pendiente por recoger</span>
            <strong className="total-value total-amarillo">{formatearMoneda(totales.pendiente)}</strong>
          </div>
        </div>

        {cargando ? (
          <div className="recogida-vacio">Cargando recogidas…</div>
        ) : filasPorPunto.length === 0 ? (
          <div className="recogida-vacio">No hay puntos de venta activos para mostrar.</div>
        ) : (
          <div className="recogida-tabla-scroll">
            <table className="recogida-tabla">
              <thead>
                <tr>
                  <th>Punto de venta</th>
                  <th>Venta</th>
                  <th>Premios</th>
                  <th>Comisión</th>
                  <th>Debe entregar</th>
                  <th>Estado</th>
                  <th className="col-accion">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filasPorPunto.map((fila) => {
                  const recogido = Boolean(fila.recogida);
                  const enProceso = guardando === fila.id;
                  return (
                    <tr key={fila.id || fila.nombre} className={recogido ? 'fila-recogida' : ''}>
                      <td className="celda-punto">
                        <span className="punto-nombre">{fila.nombre}</span>
                        <span className="punto-meta">
                          {fila.codigo ? `${fila.codigo} · ` : ''}{fila.porcentaje.toFixed(0)}% socio
                        </span>
                      </td>
                      <td>{formatearMoneda(fila.venta)}</td>
                      <td className="celda-rojo">{formatearMoneda(fila.premios)}</td>
                      <td>{formatearMoneda(fila.comision)}</td>
                      <td className="celda-debe">{formatearMoneda(fila.esperado)}</td>
                      <td>
                        {recogido ? (
                          <span className="badge-estado badge-recogido">
                            Recogido
                            {fila.recogida.fechaRecogida && (
                              <span className="badge-fecha">
                                {new Date(fila.recogida.fechaRecogida).toLocaleDateString('es-ES', {
                                  day: '2-digit',
                                  month: 'short'
                                })}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="badge-estado badge-pendiente">Pendiente</span>
                        )}
                      </td>
                      <td className="col-accion">
                        {recogido ? (
                          <button
                            className="btn-deshacer"
                            disabled={enProceso}
                            onClick={() => deshacerRecogido(fila)}
                          >
                            {enProceso ? '…' : 'Deshacer'}
                          </button>
                        ) : (
                          <button
                            className="btn-recoger"
                            disabled={enProceso}
                            onClick={() => marcarRecogido(fila)}
                          >
                            {enProceso ? '…' : 'Marcar recogido'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default RecogidaSocios;
