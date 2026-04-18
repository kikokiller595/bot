import React, { useEffect, useMemo, useState } from 'react';
import './HistorialSorteos.css';
import { calcularPremio, numeroCoincide } from '../utils/calcularPremios';
import { normalizarPremios } from '../utils/premiosDefault';
import { useAuth } from '../context/AuthContext';

const parsearFecha = (fechaStr) => {
  if (!fechaStr) return null;
  if (fechaStr instanceof Date) return fechaStr;

  const isoMatch = fechaStr.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (isoMatch) {
    const [, añoIso, mesIso, diaIso] = isoMatch;
    const fecha = new Date(parseInt(añoIso, 10), parseInt(mesIso, 10) - 1, parseInt(diaIso, 10));
    if (!isNaN(fecha.getTime())) {
      return fecha;
    }
  }

  const partes = fechaStr.split(',');
  if (partes.length > 0) {
    const fechaParte = partes[0].trim();
    const fechaMatch = fechaParte.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (fechaMatch) {
      const [, dia, mes, año] = fechaMatch;
      let horas = 0;
      let minutos = 0;

      if (partes.length > 1) {
        const resto = partes.slice(1).join(',').trim();
        const horaMatch = resto.match(/(\d{1,2}):(\d{2})/);
        if (horaMatch) {
          horas = parseInt(horaMatch[1], 10);
          minutos = parseInt(horaMatch[2], 10);
        }
      }

      const fecha = new Date(parseInt(año, 10), parseInt(mes, 10) - 1, parseInt(dia, 10), horas, minutos);
      if (!isNaN(fecha.getTime())) {
        return fecha;
      }
    }
  }

  const fecha = new Date(fechaStr);
  if (!isNaN(fecha.getTime())) {
    return fecha;
  }

  return null;
};

const obtenerClaveFecha = (valor) => {
  const fecha = parsearFecha(valor);
  if (!fecha) return null;
  const año = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${año}-${mes}-${dia}`;
};

const extenderNumerosGanadores = (numeros = []) => {
  const lista = [];

  numeros.forEach((numeroGanador) => {
    if (!numeroGanador) return;
    const numeroStr = String(numeroGanador.numero || '').trim();
    if (!numeroStr) return;

    lista.push(numeroGanador);

    if (numeroStr.length === 3) {
      const ultimos = numeroStr.slice(-2);
      if (ultimos.length === 2) {
        lista.push({
          ...numeroGanador,
          id: `${numeroGanador.id || numeroStr}-pick3-tail`,
          numero: ultimos,
          posicion: 'primera',
          esDerivado: true,
          fuenteDerivada: 'pick3'
        });
      }

      const primeros = numeroStr.slice(0, 2);
      if (primeros.length === 2) {
        lista.push({
          ...numeroGanador,
          id: `${numeroGanador.id || numeroStr}-pick3-head`,
          numero: primeros,
          posicion: 'segunda',
          esDerivado: true,
          fuenteDerivada: 'pick3'
        });
      }
    } else if (numeroStr.length === 4) {
      const primerosTres = numeroStr.slice(0, 3);
      const primeros = numeroStr.slice(0, 2);
      const ultimos = numeroStr.slice(-2);
      const ultimosTres = numeroStr.slice(-3);

      if (primerosTres.length === 3) {
        lista.push({
          ...numeroGanador,
          id: `${numeroGanador.id || numeroStr}-pick4-head3`,
          numero: primerosTres,
          posicion: 'primeros 3',
          esDerivado: true,
          fuenteDerivada: 'pick4-head3'
        });
      }

      if (primeros.length === 2) {
        lista.push({
          ...numeroGanador,
          id: `${numeroGanador.id || numeroStr}-pick4-head`,
          numero: primeros,
          posicion: 'segunda',
          esDerivado: true,
          fuenteDerivada: 'pick4-inicio'
        });
      }

      if (ultimos.length === 2) {
        lista.push({
          ...numeroGanador,
          id: `${numeroGanador.id || numeroStr}-pick4-tail`,
          numero: ultimos,
          posicion: 'tercera',
          esDerivado: true,
          fuenteDerivada: 'pick4-fin'
        });
      }

      if (ultimosTres.length === 3) {
        lista.push({
          ...numeroGanador,
          id: `${numeroGanador.id || numeroStr}-pick4-tail3`,
          numero: ultimosTres,
          posicion: 'ultimos 3',
          esDerivado: true,
          fuenteDerivada: 'pick4-tail3'
        });
      }
    }
  });

  return lista;
};

const normalizarId = (ticket) => ticket.ticketId || ticket.id;
const obtenerClavePuntoVenta = (ticket) =>
  String(ticket?.puntoVentaId || ticket?.puntoVentaNombre || '').trim();
const LIMITE_ELIMINACION_PUNTO_VENTA_MS = 5 * 60 * 1000;

const HistorialSorteos = ({ sorteos = [], loterias = [], eliminarSorteo }) => {
  const { isAdmin } = useAuth();
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [textoBusqueda, setTextoBusqueda] = useState('');
  const [loteriaFiltro, setLoteriaFiltro] = useState('');
  const [puntoVentaFiltro, setPuntoVentaFiltro] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [resultadoFiltro, setResultadoFiltro] = useState('');
  const [gruposExpandido, setGruposExpandido] = useState({});
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setAhora(Date.now());
    }, 30000);

    return () => window.clearInterval(timer);
  }, []);

  const loteriasPorId = useMemo(() => {
    const mapa = new Map();
    loterias.forEach(loteria => {
      if (loteria?.id != null) {
        mapa.set(String(loteria.id), loteria);
      }
    });
    return mapa;
  }, [loterias]);

  const resultadoTicketsMapa = useMemo(() => {
    if (!sorteos || sorteos.length === 0) return {};

    const cachePremios = new Map();

    return sorteos.reduce((acc, ticket) => {
      const ticketId = normalizarId(ticket);
      const loteria = loteriasPorId.get(String(ticket.loteriaId));
      const numeroTicket = String(ticket.numero || (ticket.numeros && ticket.numeros[0]) || '').trim();

      if (!loteria || !numeroTicket) {
        acc[ticketId] = { estado: 'pendiente', premio: 0 };
        return acc;
      }

      const fechaClave = obtenerClaveFecha(ticket.fecha);
      const ganadoresDelDia = (loteria.numerosGanadores || []).filter(
        n => obtenerClaveFecha(n.fecha) === fechaClave
      );

      if (!ganadoresDelDia || ganadoresDelDia.length === 0) {
        acc[ticketId] = { estado: 'pendiente', premio: 0 };
        return acc;
      }

      const candidatos = extenderNumerosGanadores(ganadoresDelDia);
      
      // Detectar tipo de apuesta - usar tipoApuesta si existe, sino detectar del formato
      let tipoApuestaDetectado = (ticket.tipoApuesta || ticket.tipo || '').toLowerCase().trim();
      
      // Si no hay tipo explícito, detectar por el formato del número original
      if (!tipoApuestaDetectado && numeroTicket) {
        const numeroLower = numeroTicket.toLowerCase().trim();
        if (numeroLower.match(/^\d{2}\+1$/)) {
          tipoApuestaDetectado = 'bolita1';
        } else if (numeroLower.match(/^\d{2}\+2$/)) {
          tipoApuestaDetectado = 'bolita2';
        } else if (numeroLower.match(/^\d{3}f\+$/)) {
          tipoApuestaDetectado = 'pick4head3box';
        } else if (numeroLower.match(/^\d{3}f$/)) {
          tipoApuestaDetectado = 'pick4head3';
        } else if (numeroLower.match(/^\d{3}b\+$/)) {
          tipoApuestaDetectado = 'pick4tail3box';
        } else if (numeroLower.match(/^\d{3}b$/)) {
          tipoApuestaDetectado = 'pick4tail3';
        } else if (numeroLower.endsWith('+') && !numeroLower.match(/\+\d$/)) {
          tipoApuestaDetectado = 'box';
        } else if (numeroLower.match(/^\d$/)) {
          tipoApuestaDetectado = 'singulation';
        } else if (numeroLower.endsWith('q')) {
          tipoApuestaDetectado = 'straight';
        } else {
          tipoApuestaDetectado = 'straight';
        }
      }
      
      // Si aún no hay tipo, usar straight por defecto
      const tipoApuesta = tipoApuestaDetectado || 'straight';
      
      // Limpiar el número base (sin sufijos como +, q, +1, +2) para la comparación
      const numeroTicketLimpio = numeroTicket.replace(/[^0-9]/g, '');
      if (!numeroTicketLimpio) {
        acc[ticketId] = { estado: 'pendiente', premio: 0 };
        return acc;
      }
      
      // Determinar la longitud del ticket (Pick 2, Pick 3, Pick 4, etc.)
      const longitudTicket = numeroTicketLimpio.length;
      
      const monto = parseFloat(ticket.monto) || 0;

      if (!cachePremios.has(loteria.id)) {
        cachePremios.set(loteria.id, normalizarPremios(loteria.premios));
      }
      const premiosNormalizados = cachePremios.get(loteria.id);

      let premioTotal = 0;
      let mejorPremio = null;

      candidatos.forEach(candidato => {
        const numeroGanadorStr = String(candidato.numero || '').trim();
        if (!numeroGanadorStr) return;
        
        const longitudGanador = numeroGanadorStr.length;

        // VALIDACIÓN CRÍTICA: Si el número ganador es derivado (Pick 2 desde Pick 3/4)
        if (candidato.esDerivado) {
          if (candidato.fuenteDerivada === 'pick4-tail3') {
            if (longitudTicket !== 3 || longitudGanador !== 3) {
              return;
            }
            if (tipoApuesta !== 'pick4tail3' && tipoApuesta !== 'pick4tail3box') {
              return;
            }
          } else if (candidato.fuenteDerivada === 'pick4-head3') {
            if (longitudTicket !== 3 || longitudGanador !== 3) {
              return;
            }
            if (tipoApuesta !== 'pick4head3' && tipoApuesta !== 'pick4head3box') {
              return;
            }
          } else {
            if (longitudTicket !== 2) {
              return;
            }
            if (tipoApuesta !== 'straight') {
              return;
            }
            if (longitudGanador !== 2) {
              return;
            }
            if (numeroTicketLimpio !== numeroGanadorStr) {
              return;
            }
          }
        } else {
          // Si el número ganador NO es derivado, debe tener la misma longitud que el ticket
          // EXCEPTO para bolitas y singulation que tienen lógica especial
          if (tipoApuesta === 'bolita1' || tipoApuesta === 'bolita2') {
            // Bolitas: ticket de 2 dígitos vs ganador de 3 dígitos (Pick 3)
            if (longitudTicket !== 2 || longitudGanador !== 3) {
              return; // Bolitas requieren ticket de 2 dígitos y ganador de 3 dígitos
            }
          } else if (tipoApuesta === 'singulation') {
            // Singulation: ticket de 1 dígito, puede ganar con cualquier longitud
            if (longitudTicket !== 1) {
              return; // Singulation requiere ticket de 1 dígito
            }
          } else {
            // Para todos los demás tipos (straight, box), las longitudes deben coincidir exactamente
            if (longitudTicket !== longitudGanador) {
              return; // Las longitudes no coinciden - no puede ganar
            }
          }
        }

        // Verificar coincidencia con validaciones adicionales
        if (numeroCoincide(numeroTicketLimpio, numeroGanadorStr, tipoApuesta, { 
          esDerivado: candidato.esDerivado,
          fuenteDerivada: candidato.fuenteDerivada,
          longitudTicket: longitudTicket 
        })) {
          const premio = calcularPremio(
            tipoApuesta,
            numeroTicketLimpio,
            monto,
            premiosNormalizados,
            { posicion: candidato.posicion }
          );
          
          // Solo considerar el premio si es mayor a 0 y mayor al mejor premio actual
          if (premio > 0 && premio > premioTotal) {
            premioTotal = premio;
            mejorPremio = {
              numero: numeroTicketLimpio,
              numeroGanador: numeroGanadorStr,
              tipoApuesta,
              posicion: candidato.posicion,
              esDerivado: candidato.esDerivado
            };
          }
        }
      });

      if (premioTotal > 0) {
        acc[ticketId] = { estado: 'gano', premio: premioTotal };
      } else {
        acc[ticketId] = { estado: 'perdio', premio: 0 };
      }

      return acc;
    }, {});
  }, [sorteos, loteriasPorId]);

  const sorteosFiltrados = useMemo(() => {
    if (!sorteos || sorteos.length === 0) return [];

    const desdeDate = fechaDesde ? new Date(`${fechaDesde}T00:00:00`) : null;
    const hastaDate = fechaHasta ? new Date(`${fechaHasta}T23:59:59.999`) : null;
    const texto = textoBusqueda.trim().toLowerCase();

    return sorteos.filter(ticket => {
      const fechaTicket = parsearFecha(ticket.fecha);
      if (fechaDesde && (!fechaTicket || fechaTicket < desdeDate)) return false;
      if (fechaHasta && (!fechaTicket || fechaTicket > hastaDate)) return false;

      if (loteriaFiltro && String(ticket.loteriaId) !== loteriaFiltro) return false;
      if (isAdmin() && puntoVentaFiltro && obtenerClavePuntoVenta(ticket) !== puntoVentaFiltro) return false;

      if (tipoFiltro) {
        const tipoComparar = (ticket.tipoApuesta || ticket.tipo || '').toLowerCase();
        if (tipoComparar !== tipoFiltro) return false;
      }

      if (resultadoFiltro) {
        const estado = resultadoTicketsMapa[normalizarId(ticket)]?.estado || 'pendiente';
        if (estado !== resultadoFiltro) return false;
      }

      if (texto) {
        const campos = [
          ticket.numero,
          ticket.ticketId,
          ticket.loteriaNombre,
          ticket.fecha
        ]
          .filter(Boolean)
          .map(valor => String(valor).toLowerCase());

        const coincideTexto = campos.some(valor => valor.includes(texto));
        if (!coincideTexto) return false;
      }

      return true;
    });
  }, [
    sorteos,
    fechaDesde,
    fechaHasta,
    textoBusqueda,
    loteriaFiltro,
    puntoVentaFiltro,
    tipoFiltro,
    resultadoFiltro,
    resultadoTicketsMapa,
    isAdmin
  ]);

  const resumen = useMemo(() => {
    const totalSeleccion = sorteosFiltrados.length;
    const totalMonto = sorteosFiltrados.reduce((sum, t) => sum + (parseFloat(t.monto) || 0), 0);

    let ganados = 0;
    let perdidos = 0;
    let pendientes = 0;
    let totalPremios = 0;

    sorteosFiltrados.forEach(ticket => {
      const resultado = resultadoTicketsMapa[normalizarId(ticket)] || { estado: 'pendiente', premio: 0 };
      totalPremios += resultado.premio || 0;

      if (resultado.estado === 'gano') ganados += 1;
      else if (resultado.estado === 'perdio') perdidos += 1;
      else pendientes += 1;
    });

    return {
      totalSeleccion,
      totalMonto,
      totalPremios,
      ganados,
      perdidos,
      pendientes
    };
  }, [sorteosFiltrados, resultadoTicketsMapa]);

  const opcionesLoteria = useMemo(() => {
    const set = new Set();
    sorteos.forEach(ticket => {
      if (ticket.loteriaId && ticket.loteriaNombre) {
        set.add(JSON.stringify({ id: ticket.loteriaId, nombre: ticket.loteriaNombre }));
      }
    });
    return Array.from(set)
      .map(item => JSON.parse(item))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [sorteos]);

  const opcionesPuntosVenta = useMemo(() => {
    const mapa = new Map();

    sorteos.forEach((ticket) => {
      const clave = obtenerClavePuntoVenta(ticket);
      if (!clave) return;

      if (!mapa.has(clave)) {
        mapa.set(clave, {
          id: clave,
          nombre: String(ticket.puntoVentaNombre || ticket.puntoVentaId || 'Sin punto').trim()
        });
      }
    });

    return Array.from(mapa.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [sorteos]);

  const agruparTickets = () => {
    if (!sorteosFiltrados || sorteosFiltrados.length === 0) {
      return [];
    }

    const grupos = {};
    const obtenerOrdenFecha = (ticket) => {
      const fecha = new Date(ticket.fechaISO || ticket.fecha || 0);
      return Number.isNaN(fecha.getTime()) ? 0 : fecha.getTime();
    };

    sorteosFiltrados.forEach(ticket => {
      let grupoKey;
      if (ticket.grupoId) {
        grupoKey = `grupo-${ticket.grupoId}`;
      } else {
        grupoKey = `grupo-${ticket.ticketId || ticket.id}`;
      }

      if (!grupos[grupoKey]) {
        grupos[grupoKey] = [];
      }
      grupos[grupoKey].push(ticket);
    });

    return Object.entries(grupos)
      .map(([grupoKey, tickets]) => {
        const ticketsOrdenados = tickets.sort(
          (a, b) => obtenerOrdenFecha(b) - obtenerOrdenFecha(a)
        );
        const fecha = ticketsOrdenados[0].fecha || 'Sin fecha';
        return {
          fecha,
          tickets: ticketsOrdenados,
          id: ticketsOrdenados[0].id,
          ticketId: ticketsOrdenados[0].ticketId || ticketsOrdenados[0].id,
          grupoKey
        };
      })
      .sort((a, b) => obtenerOrdenFecha(b) - obtenerOrdenFecha(a));
  };

  const gruposTickets = useMemo(agruparTickets, [sorteosFiltrados]);

  const hayFiltroActivo = Boolean(
    fechaDesde || fechaHasta || textoBusqueda || loteriaFiltro || puntoVentaFiltro || tipoFiltro || resultadoFiltro
  );

  const toggleGrupo = (grupoId) => {
    setGruposExpandido(prev => ({
      ...prev,
      [grupoId]: !prev[grupoId]
    }));
  };

  const getTipoLabel = (tipo) => {
    if (tipo === 'ticket') return 'Ticket';
    const tipos = {
      simple: 'Número Simple',
      loto: 'Loto',
      mega: 'Mega',
      personalizado: 'Personalizado'
    };
    return tipos[tipo] || tipo;
  };

  const getTipoApuestaLabel = (tipoApuesta = '') => {
    const valor = (tipoApuesta || '').toLowerCase();
    if (valor === 'straight') return 'Straight';
    if (valor === 'box') return 'Box';
    if (valor === 'pick4head3') return 'Primeros 3 Pick 4';
    if (valor === 'pick4head3box') return 'Primeros 3 Pick 4 Box';
    if (valor === 'pick4tail3') return 'Ultimos 3 Pick 4';
    if (valor === 'pick4tail3box') return 'Ultimos 3 Pick 4 Box';
    if (valor === 'bolita1') return 'Bolita 1';
    if (valor === 'bolita2') return 'Bolita 2';
    if (valor === 'singulation') return 'Singulation';
    return tipoApuesta || 'Straight';
  };

  const puedeEliminarGrupo = (grupo) => {
    if (isAdmin()) return true;

    const primerTicket = grupo?.tickets?.[0];
    const fechaGrupo = parsearFecha(primerTicket?.fechaISO || primerTicket?.fecha);
    if (!fechaGrupo) return false;

    return ahora - fechaGrupo.getTime() <= LIMITE_ELIMINACION_PUNTO_VENTA_MS;
  };

  return (
    <div className="historial-container">
      <div className="historial-card">
        <div className="historial-header">
          <h2 className="card-title">Historial de Tickets</h2>
        </div>

        <div className="historial-filtros">
          <div className="filtros-column">
            <label>Desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
            />
          </div>
          <div className="filtros-column">
            <label>Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
            />
          </div>
          <div className="filtros-column filtro-texto">
            <label>Buscar</label>
            <input
              type="text"
              placeholder="Ticket, número o lotería"
              value={textoBusqueda}
              onChange={(e) => setTextoBusqueda(e.target.value)}
            />
          </div>
          <div className="filtros-column">
            <label>Lotería</label>
            <select value={loteriaFiltro} onChange={(e) => setLoteriaFiltro(e.target.value)}>
              <option value="">Todas</option>
              {opcionesLoteria.map(opcion => (
                <option key={opcion.id} value={String(opcion.id)}>
                  {opcion.nombre}
                </option>
              ))}
            </select>
          </div>
          {isAdmin() && (
            <div className="filtros-column">
              <label>Punto de venta</label>
              <select value={puntoVentaFiltro} onChange={(e) => setPuntoVentaFiltro(e.target.value)}>
                <option value="">Todos</option>
                {opcionesPuntosVenta.map((opcion) => (
                  <option key={opcion.id} value={opcion.id}>
                    {opcion.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="filtros-column">
            <label>Tipo</label>
            <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)}>
              <option value="">Todos</option>
              <option value="straight">Straight</option>
              <option value="box">Box</option>
              <option value="pick4head3">Primeros 3 Pick 4</option>
              <option value="pick4head3box">Primeros 3 Pick 4 Box</option>
              <option value="pick4tail3">Ultimos 3 Pick 4</option>
              <option value="pick4tail3box">Ultimos 3 Pick 4 Box</option>
              <option value="bolita1">Bolita 1</option>
              <option value="bolita2">Bolita 2</option>
              <option value="singulation">Singulation</option>
            </select>
          </div>
          <div className="filtros-column">
            <label>Resultado</label>
            <select value={resultadoFiltro} onChange={(e) => setResultadoFiltro(e.target.value)}>
              <option value="">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="gano">Ganó</option>
              <option value="perdio">Perdió</option>
            </select>
          </div>
          {hayFiltroActivo && (
            <button
              className="btn-limpiar-filtro"
              onClick={() => {
                setFechaDesde('');
                setFechaHasta('');
                setTextoBusqueda('');
                setLoteriaFiltro('');
                setPuntoVentaFiltro('');
                setTipoFiltro('');
                setResultadoFiltro('');
              }}
            >
              Limpiar filtros
            </button>
          )}
        </div>

        <div className="historial-resumen">
          <div className="resumen-card">
            <span className="resumen-label">Tickets</span>
            <span className="resumen-value">{resumen.totalSeleccion}</span>
          </div>
          <div className="resumen-card">
            <span className="resumen-label">Monto total</span>
            <span className="resumen-value">${resumen.totalMonto.toFixed(2)}</span>
          </div>
          <div className="resumen-card">
            <span className="resumen-label">Premios</span>
            <span className="resumen-value resumen-premios">${resumen.totalPremios.toFixed(2)}</span>
          </div>
          <div className="resumen-card">
            <span className="resumen-label">Ganados</span>
            <span className="resumen-value">{resumen.ganados}</span>
          </div>
          <div className="resumen-card">
            <span className="resumen-label">Perdidos</span>
            <span className="resumen-value">{resumen.perdidos}</span>
          </div>
          <div className="resumen-card">
            <span className="resumen-label">Pendientes</span>
            <span className="resumen-value resumen-pendientes">{resumen.pendientes}</span>
          </div>
        </div>

        {!sorteos || sorteos.length === 0 ? (
          <div className="sin-sorteos">
            <p>No hay tickets guardados aún.</p>
            <p className="texto-secundario">Los tickets aparecerán aquí después de generarlos.</p>
          </div>
        ) : gruposTickets.length === 0 ? (
          <div className="sin-sorteos">
            {hayFiltroActivo ? (
              <>
                <p>No hay tickets que coincidan con los filtros.</p>
                <p className="texto-secundario">
                  Total de tickets guardados: {sorteos.length}.
                </p>
              </>
            ) : (
              <>
                <p>No se encontraron tickets para mostrar.</p>
                <p className="texto-secundario">
                  Total de tickets guardados: {sorteos.length}.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="sorteos-list">
            {gruposTickets.map((grupo, grupoIndex) => {
              const totalMonto = grupo.tickets.reduce((sum, t) => sum + (parseFloat(t.monto) || 0), 0);
              const totalTickets = grupo.tickets.length;
              const loteriasGrupo = Array.from(
                new Set(grupo.tickets.map(t => t.loteriaNombre).filter(Boolean))
              );

              const todosNumerosSet = new Set();
              grupo.tickets.forEach((t) => {
                const numero = t.numero || (t.numeros && t.numeros[0]);
                if (numero) {
                  todosNumerosSet.add(String(numero).trim());
                }
              });
              const todosNumeros = Array.from(todosNumerosSet)
                .filter(n => n && n.length > 0)
                .sort((a, b) => {
                  const numA = parseInt(a, 10);
                  const numB = parseInt(b, 10);
                  if (!isNaN(numA) && !isNaN(numB)) {
                    return numA - numB;
                  }
                  return a.localeCompare(b);
                });

              const estadosGrupo = grupo.tickets.map(t => {
                const info = resultadoTicketsMapa[normalizarId(t)] || { estado: 'pendiente', premio: 0 };
                return info.estado;
              });
              const premioGrupo = grupo.tickets.reduce(
                (sum, t) => sum + (resultadoTicketsMapa[normalizarId(t)]?.premio || 0),
                0
              );
              let estadoGrupo = 'pendiente';
              if (estadosGrupo.some(e => e === 'gano')) {
                estadoGrupo = 'gano';
              } else if (estadosGrupo.every(e => e === 'perdio')) {
                estadoGrupo = 'perdio';
              }
              const estadoGrupoLabel = estadoGrupo === 'gano' ? 'Ganó' : estadoGrupo === 'perdio' ? 'Perdió' : 'Pendiente';

              const grupoKey = grupo.id || `grupo-${grupoIndex}`;
              const grupoPuedeEliminarse = puedeEliminarGrupo(grupo);

              return (
                <div key={grupoKey} className="sorteo-item">
                  <div className="sorteo-header">
                    <div className="sorteo-info">
                      <div className="sorteo-id-fecha">
                        {grupo.ticketId && (
                          <span className="sorteo-ticket-id">#{grupo.ticketId}</span>
                        )}
                        <span className="sorteo-fecha">{grupo.fecha}</span>
                      </div>
                      <div className="sorteo-loterias">
                        {loteriasGrupo.map(nombre => (
                          <span key={nombre} className="sorteo-loteria-badge">{nombre}</span>
                        ))}
                      </div>
                    </div>
                    <div className="sorteo-acciones">
                      <span className={`estado-badge estado-${estadoGrupo}`}>{estadoGrupoLabel}</span>
                      <button
                        className="btn-toggle"
                        onClick={() => toggleGrupo(grupoKey)}
                      >
                        {gruposExpandido[grupoKey] ? 'Ocultar' : 'Ver detalle'}
                      </button>
                      <button
                        className="btn-eliminar"
                        disabled={!grupoPuedeEliminarse}
                        onClick={() => {
                          if (!grupoPuedeEliminarse) {
                            alert('Este ticket ya paso de 5 minutos. Solo administracion puede eliminarlo.');
                            return;
                          }

                          const idsGrupo = grupo.tickets.map(ticket => ticket.id);
                          eliminarSorteo(idsGrupo, grupo.tickets[0]?.grupoId || '');
                        }}
                        title={
                          grupoPuedeEliminarse
                            ? 'Eliminar todos los tickets del grupo'
                            : 'Solo administracion puede eliminar tickets despues de 5 minutos'
                        }
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  <div className="sorteo-resumen">
                    <div className="resumen-block">
                      <span className="resumen-titulo">Monto total</span>
                      <span className="resumen-valor">${totalMonto.toFixed(2)}</span>
                    </div>
                    <div className="resumen-block">
                      <span className="resumen-titulo">Premios</span>
                      <span className="resumen-valor premio">${premioGrupo.toFixed(2)}</span>
                    </div>
                    <div className="resumen-block">
                      <span className="resumen-titulo">Jugadas</span>
                      <span className="resumen-valor">{totalTickets}</span>
                    </div>
                    {isAdmin() && (
                      <div className="resumen-block">
                        <span className="resumen-titulo">Punto de venta</span>
                        <span className="resumen-valor resumen-texto">
                          {grupo.tickets[0]?.puntoVentaNombre || 'Sin punto'}
                        </span>
                      </div>
                    )}
                    {isAdmin() && (
                      <div className="resumen-block">
                        <span className="resumen-titulo">Usuario</span>
                        <span className="resumen-valor resumen-texto">
                          {grupo.tickets[0]?.usuarioNombre || grupo.tickets[0]?.vendedorNombre || 'Sin usuario'}
                        </span>
                      </div>
                    )}
                    <div className="resumen-block numeros">
                      <span className="resumen-titulo">Números ({todosNumeros.length})</span>
                      <div className="resumen-numeros">
                        {todosNumeros.map((numero, index) => (
                          <span key={`${grupoKey}-num-${index}`} className="chip-numero">
                            {numero}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {gruposExpandido[grupoKey] && (
                    <div className="sorteo-detalle-expandido">
                      <div className={`detalle-table-header ${isAdmin() ? 'admin-view' : ''}`}>
                        <span>Número</span>
                        <span>Tipo</span>
                        <span>Monto</span>
                        {isAdmin() && <span>Punto</span>}
                        {isAdmin() && <span>Usuario</span>}
                        <span>Premio</span>
                        <span>Resultado</span>
                      </div>
                      <div className="detalle-table-body">
                        {grupo.tickets.map((ticket, index) => {
                          const resultadoTicket = resultadoTicketsMapa[normalizarId(ticket)] || { estado: 'pendiente', premio: 0 };
                          const numeroTicket = ticket.numero || (ticket.numeros && ticket.numeros[0]) || 'N/A';
                          return (
                            <div key={ticket.id || index} className={`detalle-row ${isAdmin() ? 'admin-view' : ''}`}>
                              <span>{numeroTicket}</span>
                              <span>{ticket.tipoApuesta ? getTipoApuestaLabel(ticket.tipoApuesta) : getTipoLabel(ticket.tipo)}</span>
                              <span>${(ticket.monto || 1).toFixed(2)}</span>
                              {isAdmin() && <span>{ticket.puntoVentaNombre || 'Sin punto'}</span>}
                              {isAdmin() && <span>{ticket.usuarioNombre || ticket.vendedorNombre || 'Sin usuario'}</span>}
                              <span>${resultadoTicket.premio.toFixed(2)}</span>
                              <span className={`estado-badge estado-${resultadoTicket.estado}`}>
                                {resultadoTicket.estado === 'gano'
                                  ? 'Ganó'
                                  : resultadoTicket.estado === 'perdio'
                                  ? 'Perdió'
                                  : 'Pendiente'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistorialSorteos;
