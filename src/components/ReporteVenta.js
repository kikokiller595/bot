import React, { useState, useMemo, useEffect } from 'react';
import './ReporteVenta.css';
import { calcularPremio, numeroCoincide } from '../utils/calcularPremios';
import { normalizarPremios } from '../utils/premiosDefault';
import { useAuth } from '../context/AuthContext';

function extenderNumerosGanadores(numeros = []) {
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
}

function obtenerDatosTipoApuesta(tipoApuesta = '', tipoFallback = '') {
  const valor = (tipoApuesta || tipoFallback || 'straight').toLowerCase();
  switch (valor) {
    case 'box':
      return { clase: 'badge-box', etiqueta: 'Box' };
    case 'pick4head3':
      return { clase: 'badge-straight', etiqueta: 'Primeros 3 Pick 4' };
    case 'pick4head3box':
      return { clase: 'badge-box', etiqueta: 'Primeros 3 Pick 4 Box' };
    case 'pick4tail3':
      return { clase: 'badge-straight', etiqueta: 'Ultimos 3 Pick 4' };
    case 'pick4tail3box':
      return { clase: 'badge-box', etiqueta: 'Ultimos 3 Pick 4 Box' };
    case 'bolita1':
      return { clase: 'badge-bolita1', etiqueta: 'Bolita 1' };
    case 'bolita2':
      return { clase: 'badge-bolita2', etiqueta: 'Bolita 2' };
    case 'singulation':
      return { clase: 'badge-singulation', etiqueta: 'Singulation' };
    default:
      return { clase: 'badge-straight', etiqueta: 'Straight' };
  }
}

function obtenerPosicionLabel(posicion = '', tipoApuesta = '') {
  if (posicion) return posicion;
  const valor = (tipoApuesta || '').toLowerCase();
  if (valor === 'pick4head3' || valor === 'pick4head3box') return 'primeros 3';
  if (valor === 'pick4tail3' || valor === 'pick4tail3box') return 'ultimos 3';
  if (valor === 'bolita1') return 'primera';
  if (valor === 'bolita2') return 'segunda';
  return posicion || '';
}

// Función para obtener la clave de fecha en formato YYYY-MM-DD
const obtenerClaveFecha = (fechaStr) => {
  if (!fechaStr) return null;

  if (fechaStr instanceof Date && !isNaN(fechaStr.getTime())) {
    const año = fechaStr.getFullYear();
    const mes = String(fechaStr.getMonth() + 1).padStart(2, '0');
    const dia = String(fechaStr.getDate()).padStart(2, '0');
    return `${año}-${mes}-${dia}`;
  }

  const isoMatch = fechaStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const partes = fechaStr.split(',');
  const fechaParte = partes[0]?.trim() || '';
  const matchES = fechaParte.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (matchES) {
    const [, dia, mes, año] = matchES;
    return `${año.padStart(4, '0')}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }

  const fecha = parsearFecha(fechaStr);
  if (fecha && !isNaN(fecha.getTime())) {
    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${año}-${mes}-${dia}`;
  }

  return null;
};

// Función para obtener la fecha local en formato YYYY-MM-DD (sin problemas de zona horaria)
const obtenerFechaLocal = () => {
  const ahora = new Date();
  const año = ahora.getFullYear();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${año}-${mes}-${dia}`;
};

const obtenerClavePuntoVenta = (ticket = {}) => {
  const id = String(ticket.puntoVentaId || '').trim();
  if (id) return `id:${id}`;
  const nombre = String(ticket.puntoVentaNombre || '').trim();
  if (nombre) return `nombre:${nombre.toLowerCase()}`;
  return 'sin-punto';
};

const ReporteVenta = ({ sorteos, loterias = [], puntosVenta = [] }) => {
  const { isAdmin, user } = useAuth();
  const [fechaInicio, setFechaInicio] = useState(obtenerFechaLocal());
  const [fechaFin, setFechaFin] = useState(obtenerFechaLocal());
  const [puntoVentaFiltro, setPuntoVentaFiltro] = useState('');
  const [mostrarDetalle, setMostrarDetalle] = useState(true);
  const [ultimaActualizacion, setUltimaActualizacion] = useState(new Date());
  const reporteRef = React.useRef(null);

  // Actualizar timestamp cuando cambien los sorteos
  useEffect(() => {
    setUltimaActualizacion(new Date());
  }, [sorteos]);

  // Función auxiliar para parsear fechas en diferentes formatos
  const parsearFecha = (fechaStr) => {
    if (!fechaStr) return null;
    
    // Si ya es un objeto Date, retornarlo
    if (fechaStr instanceof Date) return fechaStr;

    // Manejar formato ISO simple (YYYY-MM-DD o YYYY-MM-DDTHH:mm:ss)
    const isoMatch = fechaStr.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
    if (isoMatch) {
      const [, añoIso, mesIso, diaIso] = isoMatch;
      const fecha = new Date(parseInt(añoIso, 10), parseInt(mesIso, 10) - 1, parseInt(diaIso, 10));
      if (!isNaN(fecha.getTime())) {
        return fecha;
      }
    }
    
    // Primero intentar parsear formato localizado (ej: "6/11/2025, 19:20:36")
    // toLocaleString('es-ES') devuelve formato DD/MM/YYYY
    // IMPORTANTE: No usar new Date(fechaStr) directamente porque interpreta como M/D/YYYY
    const partes = fechaStr.split(',');
    if (partes.length > 0) {
      const fechaParte = partes[0].trim();
      // Formato: DD/MM/YYYY (formato español)
      const fechaMatch = fechaParte.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (fechaMatch) {
        const [, dia, mes, año] = fechaMatch;
        let horas = 0;
        let minutos = 0;
        let segundos = 0;

        // Intentar extraer la parte horaria si existe
        const resto = partes.length > 1 ? partes.slice(1).join(',').trim() : fechaStr.replace(fechaParte, '').trim();
        if (resto) {
          const horaMatch = resto.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?|AM|PM)?/i);
          if (horaMatch) {
            horas = parseInt(horaMatch[1], 10);
            minutos = parseInt(horaMatch[2], 10);
            segundos = horaMatch[3] ? parseInt(horaMatch[3], 10) : 0;
            const sufijo = horaMatch[4]?.toLowerCase();
            if (sufijo) {
              const esPM = sufijo.includes('p');
              const esAM = sufijo.includes('a');
              if (esPM && horas < 12) {
                horas += 12;
              }
              if (esAM && horas === 12) {
                horas = 0;
              }
            }
          }
        }
        // Formato español: DD/MM/YYYY - crear fecha manualmente
        const fecha = new Date(parseInt(año), parseInt(mes) - 1, parseInt(dia), horas, minutos, segundos);
        if (!isNaN(fecha.getTime())) {
          return fecha;
        }
      }
    }
    
    // Si no es formato localizado, intentar ISO
    const fecha = new Date(fechaStr);
    if (!isNaN(fecha.getTime())) {
      return fecha;
    }
    
    console.warn('ReporteVenta: No se pudo parsear fecha:', fechaStr);
    return null;
  };

  const fechaAClave = (valorFecha) => {
    const fecha = valorFecha instanceof Date ? valorFecha : parsearFecha(valorFecha);
    if (!fecha) return null;
    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${año}-${mes}-${dia}`;
  };

  const obtenerFechaReferenciaTicket = (ticket = {}) =>
    ticket?.fechaISO || ticket?.fecha || ticket?.createdAt || null;

  const obtenerMontoPremioTicket = (ticket = {}) =>
    Number(ticket.totalPremio ?? ticket.premio) || 0;

  const agruparPremiosPorTicket = (resultados = []) => {
    const mapa = new Map();

    resultados.forEach((item) => {
      const clave = String(item.grupoId || item.ticketId || item.id || '').trim();
      if (!clave) return;

      if (!mapa.has(clave)) {
        mapa.set(clave, {
          ...item,
          ticketId: item.ticketId || clave,
          referenciaPago: clave,
          totalPremio: 0,
          totalMonto: 0,
          cantidadAciertos: 0
        });
      }

      const agrupado = mapa.get(clave);
      agrupado.pagado = Boolean(agrupado.pagado || item.pagado);
      agrupado.totalPremio += Number(item.premio) || 0;
      agrupado.totalMonto += Number(item.monto) || 0;
      agrupado.cantidadAciertos += 1;

      if (!agrupado.fechaTicket && item.fechaTicket) {
        agrupado.fechaTicket = item.fechaTicket;
      }
      if (!agrupado.fechaSorteo && item.fechaSorteo) {
        agrupado.fechaSorteo = item.fechaSorteo;
      }
      if (!agrupado.loteriaNombre && item.loteriaNombre) {
        agrupado.loteriaNombre = item.loteriaNombre;
      }
      if (!agrupado.puntoVentaId && item.puntoVentaId) {
        agrupado.puntoVentaId = item.puntoVentaId;
      }
      if (!agrupado.puntoVentaNombre && item.puntoVentaNombre) {
        agrupado.puntoVentaNombre = item.puntoVentaNombre;
      }
      if (!agrupado.usuarioNombre && item.usuarioNombre) {
        agrupado.usuarioNombre = item.usuarioNombre;
      }
      if (!agrupado.numero && item.numero) {
        agrupado.numero = item.numero;
      }
    });

    return Array.from(mapa.values()).sort((a, b) => {
      const fechaA = parsearFecha(a.fechaTicket || a.fecha || a.fechaSorteo || 0);
      const fechaB = parsearFecha(b.fechaTicket || b.fecha || b.fechaSorteo || 0);
      return (fechaB?.getTime() || 0) - (fechaA?.getTime() || 0);
    });
  };

  const opcionesPuntoVenta = useMemo(() => {
    const mapa = new Map();

    sorteos.forEach((ticket) => {
      const clave = obtenerClavePuntoVenta(ticket);
      if (!clave || mapa.has(clave)) return;

      mapa.set(clave, {
        value: clave,
        label: String(ticket.puntoVentaNombre || '').trim() || 'Sin punto de venta'
      });
    });

    return Array.from(mapa.values()).sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));
  }, [sorteos]);

  const puntosVentaMap = useMemo(() => {
    const mapa = new Map();

    (puntosVenta || []).forEach((punto) => {
      const id = String(punto.id || punto._id || '').trim();
      const nombre = String(punto.nombre || '').trim();

      if (id) {
        mapa.set(`id:${id}`, punto);
      }
      if (nombre) {
        mapa.set(`nombre:${nombre.toLowerCase()}`, punto);
      }
    });

    return mapa;
  }, [puntosVenta]);

  const resolverPuntoVenta = (clave, nombreFallback = '') => {
    if (clave && puntosVentaMap.has(clave)) {
      return puntosVentaMap.get(clave);
    }

    const nombre = String(nombreFallback || '').trim().toLowerCase();
    if (nombre && puntosVentaMap.has(`nombre:${nombre}`)) {
      return puntosVentaMap.get(`nombre:${nombre}`);
    }

    return null;
  };

  const etiquetaPuntoVentaSeleccionado = useMemo(() => {
    if (!puntoVentaFiltro) return 'Todos los puntos';
    return opcionesPuntoVenta.find((item) => item.value === puntoVentaFiltro)?.label || 'Punto filtrado';
  }, [opcionesPuntoVenta, puntoVentaFiltro]);

  // Filtrar tickets por rango de fechas
  const ticketsEnRango = useMemo(() => {
    if (!sorteos || sorteos.length === 0) {
      console.log('ReporteVenta: No hay sorteos');
      return [];
    }

    console.log('ReporteVenta: Filtrando', sorteos.length, 'tickets');
    console.log('ReporteVenta: Rango de fechas:', fechaInicio, 'a', fechaFin);

    const fechaInicioDate = new Date(`${fechaInicio}T00:00:00`);
    const fechaFinDate = new Date(`${fechaFin}T23:59:59.999`);

    const filtrados = sorteos.filter(ticket => {
      const fechaReferenciaTicket = obtenerFechaReferenciaTicket(ticket);

      if (!fechaReferenciaTicket) {
        console.log('ReporteVenta: Ticket sin fecha:', ticket.id);
        return false;
      }

      if (puntoVentaFiltro && obtenerClavePuntoVenta(ticket) !== puntoVentaFiltro) {
        return false;
      }
      
      const ticketFecha = parsearFecha(fechaReferenciaTicket);
      if (!ticketFecha) {
        console.log(
          'ReporteVenta: No se pudo parsear fecha:',
          fechaReferenciaTicket,
          'del ticket:',
          ticket.id
        );
        return false;
      }
      
      const enRango = ticketFecha >= fechaInicioDate && ticketFecha <= fechaFinDate;
      if (!enRango) {
        console.log('ReporteVenta: Ticket fuera de rango:', {
          ticketFecha: ticketFecha.toISOString(),
          fechaInicio: fechaInicioDate.toISOString(),
          fechaFin: fechaFinDate.toISOString()
        });
      }
      
      return enRango;
    });

    console.log('ReporteVenta: Tickets filtrados:', filtrados.length, 'de', sorteos.length);
    return filtrados;
  }, [sorteos, fechaInicio, fechaFin, puntoVentaFiltro]);

  const ticketsGanadoresEnRango = useMemo(() => {
    console.log('📊 REPORTE DE VENTAS - Calculando tickets ganadores');
    console.log('Rango de fechas:', fechaInicio, 'a', fechaFin);
    
    if (!loterias || loterias.length === 0 || !ticketsEnRango || ticketsEnRango.length === 0) {
      console.log('❌ No hay loterías o sorteos');
      return [];
    }

    const fechaInicioDate = new Date(`${fechaInicio}T00:00:00`);
    const fechaFinDate = new Date(`${fechaFin}T23:59:59.999`);
    const resultados = [];

    console.log('Total de loterías:', loterias.length);
    console.log('Total de sorteos en rango:', ticketsEnRango.length);

    loterias.forEach(loteria => {
      if (!loteria || !loteria.numerosGanadores || loteria.numerosGanadores.length === 0) return;

      console.log(`\n🎰 Procesando lotería: ${loteria.nombre}`);
      console.log('Números ganadores:', loteria.numerosGanadores.length);

      const premiosLoteria = normalizarPremios(loteria.premios);

      const numerosCandidatos = extenderNumerosGanadores(loteria.numerosGanadores);
      console.log('Números candidatos (con derivados):', numerosCandidatos.map(n => n.numero));

      numerosCandidatos.forEach(numeroGanador => {
        const fechaGanadorDate = numeroGanador.fecha ? parsearFecha(numeroGanador.fecha) : null;
        if (fechaGanadorDate) {
          if (fechaGanadorDate < fechaInicioDate || fechaGanadorDate > fechaFinDate) {
            return;
          }
        }

        console.log(`  Procesando número ganador: ${numeroGanador.numero}, Fecha: ${numeroGanador.fecha}`);

        // Obtener clave de fecha del número ganador
        const claveFechaGanador = obtenerClaveFecha(numeroGanador.fecha);
        console.log('  Clave fecha ganador:', claveFechaGanador);

        let ticketsProcesados = 0;
        let ticketsCoinciden = 0;

        ticketsEnRango.forEach(ticket => {
          ticketsProcesados++;
          if (!ticket.loteriaId || ticket.loteriaId.toString() !== loteria.id.toString()) return;

          // Detectar tipo de apuesta - usar tipoApuesta si existe, sino detectar del formato
          let tipoApuestaDetectado = (ticket.tipoApuesta || ticket.tipo || '').toLowerCase().trim();
          
          const numeroTicket = String(ticket.numero || '').trim();
          if (!numeroTicket) return;
          
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
          if (!numeroTicketLimpio) return;

          const numeroGanadorStr = String(numeroGanador.numero || '').trim();
          if (!numeroGanadorStr) return;

          // VALIDACIÓN CRÍTICA: El ticket y el número ganador deben ser del mismo día
          const claveFechaTicket = obtenerClaveFecha(obtenerFechaReferenciaTicket(ticket));
          
          if (ticketsProcesados <= 3) {
            console.log(`    Ticket ${ticketsProcesados}:`, {
              numero: numeroTicketLimpio,
              fechaTicket: obtenerFechaReferenciaTicket(ticket),
              claveTicket: claveFechaTicket,
              claveGanador: claveFechaGanador,
              coincideFecha: claveFechaTicket === claveFechaGanador
            });
          }
          
          if (claveFechaTicket && claveFechaGanador && claveFechaTicket !== claveFechaGanador) {
            if (ticketsProcesados <= 3) {
              console.log('    ❌ Rechazado: Fechas no coinciden');
            }
            return; // Las fechas no coinciden - no puede ganar
          }

          // Validación estricta: Si el número ganador es derivado, solo puede ganar si el ticket es Pick 2 straight
          if (numeroGanador.esDerivado) {
            if (numeroGanador.fuenteDerivada === 'pick4-tail3') {
              if (numeroTicketLimpio.length !== 3) {
                return;
              }
              if (tipoApuesta !== 'pick4tail3' && tipoApuesta !== 'pick4tail3box') {
                return;
              }
            } else if (numeroGanador.fuenteDerivada === 'pick4-head3') {
              if (numeroTicketLimpio.length !== 3) {
                return;
              }
              if (tipoApuesta !== 'pick4head3' && tipoApuesta !== 'pick4head3box') {
                return;
              }
            } else {
              if (numeroTicketLimpio.length !== 2 || tipoApuesta !== 'straight') {
                return;
              }
              if (numeroTicketLimpio !== numeroGanadorStr) {
                return;
              }
            }
          } else {
            // Si el número ganador NO es derivado, las longitudes deben coincidir exactamente
            const esLongitudCompatible =
              tipoApuesta === 'bolita1' || tipoApuesta === 'bolita2'
                ? numeroTicketLimpio.length === 2 && numeroGanadorStr.length === 3
                : tipoApuesta === 'singulation'
                  ? numeroTicketLimpio.length === 1 && numeroGanadorStr.length >= 1
                  : numeroTicketLimpio.length === numeroGanadorStr.length;
            if (!esLongitudCompatible) {
              return; // Las longitudes no coinciden
            }
          }

          if (numeroCoincide(numeroTicketLimpio, numeroGanadorStr, tipoApuesta, { 
            esDerivado: numeroGanador.esDerivado,
            fuenteDerivada: numeroGanador.fuenteDerivada,
            longitudTicket: numeroTicketLimpio.length 
          })) {
            ticketsCoinciden++;
            const monto = parseFloat(ticket.monto) || 0;
            if (monto <= 0) return;

            const premio = calcularPremio(
              tipoApuesta,
              numeroTicketLimpio,
              monto,
              premiosLoteria,
              { posicion: numeroGanador.posicion }
            );

            if (ticketsProcesados <= 3) {
              console.log('    ✅ Número coincide! Premio:', premio);
            }

            if (premio > 0) {
              resultados.push({
                ticketId: ticket.ticketId || ticket.id,
                grupoId: ticket.grupoId || null,
                numero: numeroTicketLimpio,
                tipoApuesta,
                monto,
                premio,
                fechaTicket: obtenerFechaReferenciaTicket(ticket),
                fechaSorteo: numeroGanador.fecha,
                loteriaNombre: loteria.nombre,
                puntoVentaId: ticket.puntoVentaId || '',
                puntoVentaNombre: ticket.puntoVentaNombre || '',
                usuarioNombre: ticket.usuarioNombre || ticket.vendedorNombre || '',
                pagado: Boolean(ticket.pagado),
                posicion: obtenerPosicionLabel(numeroGanador.posicion, tipoApuesta)
              });
            } else {
              if (ticketsProcesados <= 3) {
                console.log('    ⚠️ Premio es 0');
              }
            }
          }
        });
        
        console.log(`  Tickets procesados: ${ticketsProcesados}, Coincidencias: ${ticketsCoinciden}`);
      });
    });

    console.log('\n🏆 RESUMEN REPORTE:');
    console.log('Total de resultados antes de agrupar:', resultados.length);

    // Agrupar resultados por ticketId y tomar solo el premio más alto para cada ticket
    // Esto evita que un ticket que gana múltiples veces se sume múltiples veces
    const agrupados = agruparPremiosPorTicket(resultados);
    console.log('Total de tickets ganadores agrupados:', agrupados.length);
    console.log('Premios totales:', agrupados.reduce((sum, t) => sum + obtenerMontoPremioTicket(t), 0));
    
    return agrupados;
  }, [ticketsEnRango, loterias, fechaInicio, fechaFin]);

  // Calcular premios pagados en el rango de fechas
  // Ya están agrupados por ticket, cada uno con su premio más alto
  const totalPremiosDetectados = useMemo(() => (
    ticketsGanadoresEnRango.reduce(
      (total, ticket) => total + obtenerMontoPremioTicket(ticket),
      0
    )
  ), [ticketsGanadoresEnRango]);

  const premiosPagados = useMemo(() => {
    if (!ticketsGanadoresEnRango || ticketsGanadoresEnRango.length === 0) {
      return 0;
    }

    return ticketsGanadoresEnRango.reduce((total, ticket) => (
      ticket.pagado ? total + obtenerMontoPremioTicket(ticket) : total
    ), 0);
  }, [ticketsGanadoresEnRango]);

  // Calcular estadísticas de venta
  const estadisticas = useMemo(() => {
    if (ticketsEnRango.length === 0) {
      return {
        totalTickets: 0,
        totalVenta: 0,
        ticketsStraight: 0,
        ticketsBox: 0,
        ventaStraight: 0,
        ventaBox: 0,
        promedioTicket: 0,
        ticketMasAlto: null,
        ticketMasBajo: null,
        totalPremios: 0,
        totalPremiosPagados: 0,
        ticketsGanadores: 0,
        gananciaNeta: 0
      };
    }

    const stats = {
      totalTickets: ticketsEnRango.length,
      totalVenta: 0,
      ticketsStraight: 0,
      ticketsBox: 0,
      ventaStraight: 0,
      ventaBox: 0,
      promedioTicket: 0,
      ticketMasAlto: null,
      ticketMasBajo: null,
      totalPremios: 0,
      totalPremiosPagados: 0,
      ticketsGanadores: 0
    };

    let montoMaximo = -1;
    let montoMinimo = Infinity;

    ticketsEnRango.forEach(ticket => {
      const monto = parseFloat(ticket.monto) || 1;
      stats.totalVenta += monto;

      const tipoApuesta = (ticket.tipoApuesta || ticket.tipo || 'straight').toLowerCase();
      
      if (
        tipoApuesta === 'straight' ||
        tipoApuesta === 'singulation' ||
        tipoApuesta === 'pick4tail3' ||
        tipoApuesta === 'pick4head3'
      ) {
        stats.ticketsStraight++;
        stats.ventaStraight += monto;
      } else if (
        tipoApuesta === 'box' ||
        tipoApuesta === 'pick4tail3box' ||
        tipoApuesta === 'pick4head3box'
      ) {
        stats.ticketsBox++;
        stats.ventaBox += monto;
      } else if (tipoApuesta === 'bolita1' || tipoApuesta === 'bolita2') {
        stats.ticketsStraight++;
        stats.ventaStraight += monto;
      } else {
        stats.ticketsStraight++;
        stats.ventaStraight += monto;
      }

      // Encontrar ticket más alto y más bajo
      if (monto > montoMaximo) {
        montoMaximo = monto;
        stats.ticketMasAlto = ticket;
      }
      if (monto < montoMinimo) {
        montoMinimo = monto;
        stats.ticketMasBajo = ticket;
      }
    });

    stats.promedioTicket = stats.totalTickets > 0 ? stats.totalVenta / stats.totalTickets : 0;
    stats.totalPremios = totalPremiosDetectados;
    stats.totalPremiosPagados = premiosPagados;
    stats.ticketsGanadores = ticketsGanadoresEnRango.length;
    stats.gananciaNeta = stats.totalVenta - totalPremiosDetectados;

    return stats;
  }, [ticketsEnRango, premiosPagados, ticketsGanadoresEnRango.length, totalPremiosDetectados]);

  const ventasPorPuntoVenta = useMemo(() => {
    const mapa = new Map();

    ticketsEnRango.forEach((ticket) => {
      const clave = obtenerClavePuntoVenta(ticket);
      const nombre = String(ticket.puntoVentaNombre || '').trim() || 'Sin punto de venta';
      if (!mapa.has(clave)) {
        mapa.set(clave, {
          clave,
          nombre,
          tickets: 0,
          total: 0,
          premios: 0,
          premiosPagados: 0
        });
      }

      const item = mapa.get(clave);
      item.tickets += 1;
      item.total += Number(ticket.monto) || 0;
    });

    ticketsGanadoresEnRango.forEach((ticket) => {
      const clave = ticket.puntoVentaId
        ? `id:${String(ticket.puntoVentaId).trim()}`
        : `nombre:${String(ticket.puntoVentaNombre || '').trim().toLowerCase()}`;
      if (!mapa.has(clave)) return;

      const item = mapa.get(clave);
      const montoPremio = obtenerMontoPremioTicket(ticket);
      item.premios += montoPremio;
      if (ticket.pagado) {
        item.premiosPagados += montoPremio;
      }
    });

    const lista = Array.from(mapa.values()).map((item) => {
      const configuracion = resolverPuntoVenta(item.clave, item.nombre);
      const porcentajeSocio = Number(configuracion?.porcentajeSocio) || 0;
      const gananciaNeta = item.total - item.premios;
      return {
        ...item,
        porcentajeSocio,
        gananciaNeta,
        montoSocio: (gananciaNeta * porcentajeSocio) / 100
      };
    });

    return lista.sort((a, b) => b.total - a.total);
  }, [ticketsEnRango, ticketsGanadoresEnRango, puntosVentaMap]);

  const configuracionPuntoActual = useMemo(() => {
    if (puntoVentaFiltro) {
      return resolverPuntoVenta(puntoVentaFiltro, etiquetaPuntoVentaSeleccionado);
    }

    if (!isAdmin() && Array.isArray(puntosVenta) && puntosVenta.length > 0) {
      return puntosVenta[0];
    }

    if (!isAdmin() && user?.puntoVentaId) {
      return resolverPuntoVenta(`id:${String(user.puntoVentaId).trim()}`, user?.puntoVentaNombre);
    }

    return null;
  }, [puntoVentaFiltro, etiquetaPuntoVentaSeleccionado, isAdmin, puntosVenta, user, puntosVentaMap]);

  const resumenSocio = useMemo(() => {
    const porcentajeSeleccionado = Number(configuracionPuntoActual?.porcentajeSocio) || 0;
    const montoSeleccionado =
      configuracionPuntoActual && puntoVentaFiltro
        ? ((estadisticas.gananciaNeta * porcentajeSeleccionado) / 100)
        : (!isAdmin() && configuracionPuntoActual)
        ? ((estadisticas.gananciaNeta * porcentajeSeleccionado) / 100)
        : ventasPorPuntoVenta.reduce((sum, item) => sum + item.montoSocio, 0);

    return {
      porcentajeSeleccionado,
      montoSeleccionado,
      puntosConfigurados: ventasPorPuntoVenta.filter((item) => item.porcentajeSocio > 0).length
    };
  }, [configuracionPuntoActual, puntoVentaFiltro, estadisticas.gananciaNeta, isAdmin, ventasPorPuntoVenta]);

  const montoRestante = useMemo(
    () => estadisticas.gananciaNeta - resumenSocio.montoSeleccionado,
    [estadisticas.gananciaNeta, resumenSocio.montoSeleccionado]
  );

  const puntoReporteLabel = useMemo(() => {
    if (configuracionPuntoActual?.nombre) {
      return configuracionPuntoActual.nombre;
    }

    if (puntoVentaFiltro && isAdmin()) {
      const encontrado = opcionesPuntoVenta.find((opcion) => opcion.value === puntoVentaFiltro);
      return encontrado?.label || 'Punto filtrado';
    }

    if (isAdmin()) {
      return 'Todos los puntos';
    }

    return user?.puntoVentaNombre || user?.username || 'Punto actual';
  }, [configuracionPuntoActual, puntoVentaFiltro, isAdmin, opcionesPuntoVenta, user]);

  const resumenTabla = useMemo(() => ([
    { label: 'Balance actual', value: `$${montoRestante.toFixed(2)}`, tone: montoRestante >= 0 ? 'success' : 'danger' },
    { label: 'Punto', value: puntoReporteLabel },
    { label: 'Usuario', value: user?.username || user?.nombre || 'Sin usuario' },
    { label: 'Tickets vendidos', value: String(estadisticas.totalTickets) },
    { label: 'Venta bruta', value: `$${estadisticas.totalVenta.toFixed(2)}` },
    { label: 'Premios', value: `$${estadisticas.totalPremios.toFixed(2)}` },
    {
      label: 'Porcentaje socio',
      value: configuracionPuntoActual
        ? `${resumenSocio.porcentajeSeleccionado.toFixed(2)}%`
        : `${resumenSocio.puntosConfigurados} configurados`
    },
    { label: 'Monto socio', value: `$${resumenSocio.montoSeleccionado.toFixed(2)}` },
    { label: 'Venta neta', value: `$${estadisticas.gananciaNeta.toFixed(2)}`, tone: estadisticas.gananciaNeta >= 0 ? 'success' : 'danger' },
    { label: 'Te queda', value: `$${montoRestante.toFixed(2)}`, tone: montoRestante >= 0 ? 'success' : 'danger' }
  ]), [
    configuracionPuntoActual,
    estadisticas.gananciaNeta,
    estadisticas.totalPremios,
    estadisticas.totalTickets,
    estadisticas.totalVenta,
    montoRestante,
    puntoReporteLabel,
    resumenSocio.montoSeleccionado,
    resumenSocio.porcentajeSeleccionado,
    resumenSocio.puntosConfigurados,
    user
  ]);

  const formatearFecha = (fechaStr) => {
    try {
      const fecha = parsearFecha(fechaStr);
      if (!fecha) return fechaStr;
      return fecha.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return fechaStr;
    }
  };

  // Función para formatear una fecha Date a YYYY-MM-DD (fecha local)
  const formatearFechaLocal = (fecha) => {
    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${año}-${mes}-${dia}`;
  };

  const establecerHoy = () => {
    const hoy = obtenerFechaLocal();
    setFechaInicio(hoy);
    setFechaFin(hoy);
  };

  const establecerSemana = () => {
    const hoy = new Date();
    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - hoy.getDay());
    
    setFechaInicio(formatearFechaLocal(inicioSemana));
    setFechaFin(formatearFechaLocal(hoy));
  };

  const establecerMes = () => {
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    
    setFechaInicio(formatearFechaLocal(inicioMes));
    setFechaFin(formatearFechaLocal(hoy));
  };

  return (
    <div className="reporte-venta-container">
      <div className="reporte-venta-card">
        <div className="reporte-header">
          <div>
            <h2 className="card-title">Reporte de Ventas</h2>
            <small className="ultima-actualizacion">
              Actualizado: {ultimaActualizacion.toLocaleTimeString('es-ES')} | 
              Punto: {etiquetaPuntoVentaSeleccionado} | 
              Total en sistema: {sorteos?.length || 0} tickets | 
              En rango: {ticketsEnRango.length} tickets
            </small>
          </div>
        </div>

        {/* Filtros de fecha */}
        <div className="filtros-fecha">
          <div className="filtro-rango">
            <div className="filtro-item">
              <label>Desde:</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="input-fecha"
              />
            </div>
            <div className="filtro-item">
              <label>Hasta:</label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="input-fecha"
              />
            </div>
            {isAdmin() && (
              <div className="filtro-item filtro-punto-venta">
                <label>Punto de venta:</label>
                <select
                  value={puntoVentaFiltro}
                  onChange={(e) => setPuntoVentaFiltro(e.target.value)}
                  className="input-fecha"
                >
                  <option value="">Todos</option>
                  {opcionesPuntoVenta.map((opcion) => (
                    <option key={opcion.value} value={opcion.value}>
                      {opcion.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="botones-rapidos">
            <button className="btn-rapido" onClick={establecerHoy}>Hoy</button>
            <button className="btn-rapido" onClick={establecerSemana}>Semana</button>
            <button className="btn-rapido" onClick={establecerMes}>Mes</button>
          </div>
        </div>

        {/* Resumen de ventas */}
        <div className="resumen-ventas">
          <div className="stat-card stat-principal">
            <div className="stat-header-principal">
              <div className="stat-label">Total de Ventas</div>
              <div className="stat-icon">💰</div>
            </div>
            <div className="stat-value-grande">${estadisticas.totalVenta.toFixed(2)}</div>
            <div className="stat-sublabel-principal">
              <span className="stat-badge">{estadisticas.totalTickets} tickets vendidos</span>
            </div>
            <div className="stat-info-extra">
              <div className="info-item">
                <span className="info-label">Straight:</span>
                <span className="info-value">${estadisticas.ventaStraight.toFixed(2)}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Box:</span>
                <span className="info-value">${estadisticas.ventaBox.toFixed(2)}</span>
              </div>
            </div>
            <div className="stat-premios-section">
              <div className="premios-item">
                <span className="premios-label">Premios Detectados:</span>
                <span className="premios-value">${estadisticas.totalPremios.toFixed(2)}</span>
              </div>
              <div className="premios-item">
                <span className="premios-label">Pagados:</span>
                <span className="premios-value">${estadisticas.totalPremiosPagados.toFixed(2)}</span>
              </div>
              <div className="ganancia-neta-item">
                <span className="ganancia-label">Ganancia Neta:</span>
                <span className={`ganancia-value ${estadisticas.gananciaNeta >= 0 ? 'positiva' : 'negativa'}`}>
                  ${estadisticas.gananciaNeta.toFixed(2)}
                </span>
              </div>
              <div className="socio-item">
                <span className="ganancia-label">
                  {configuracionPuntoActual ? 'Socio sobre neta:' : 'Socio estimado:'}
                </span>
                <span className={`ganancia-value ${resumenSocio.montoSeleccionado >= 0 ? 'positiva' : 'negativa'}`}>
                  ${resumenSocio.montoSeleccionado.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="stats-grid stats-grid-clean">
            <div className="stat-card">
              <div className="stat-label">Straight</div>
              <div className="stat-value">${estadisticas.ventaStraight.toFixed(2)}</div>
              <div className="stat-sublabel">{estadisticas.ticketsStraight} tickets</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Box</div>
              <div className="stat-value">${estadisticas.ventaBox.toFixed(2)}</div>
              <div className="stat-sublabel">{estadisticas.ticketsBox} tickets</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Total de Venta</div>
              <div className="stat-value">${estadisticas.totalVenta.toFixed(2)}</div>
              <div className="stat-sublabel">Total vendido</div>
            </div>

            <div className="stat-card stat-premios">
              <div className="stat-label">Premios Detectados</div>
              <div className="stat-value stat-premio-value">${estadisticas.totalPremios.toFixed(2)}</div>
              <div className="stat-sublabel">{estadisticas.ticketsGanadores} tickets ganadores</div>
            </div>

            <div className="stat-card stat-premios">
              <div className="stat-label">Premios Pagados</div>
              <div className="stat-value stat-premio-value">${estadisticas.totalPremiosPagados.toFixed(2)}</div>
              <div className="stat-sublabel">Ya marcados como pagados</div>
            </div>

            <div className={`stat-card ${estadisticas.gananciaNeta >= 0 ? 'stat-ganancia-positiva' : 'stat-ganancia-negativa'}`}>
              <div className="stat-label">Venta neta</div>
              <div className="stat-value">${estadisticas.gananciaNeta.toFixed(2)}</div>
              <div className="stat-sublabel">Ventas - Premios</div>
            </div>

            <div className="stat-card stat-socio-porcentaje">
              <div className="stat-label">Porcentaje socio</div>
              <div className="stat-value">
                {configuracionPuntoActual
                  ? `${resumenSocio.porcentajeSeleccionado.toFixed(2)}%`
                  : `${resumenSocio.puntosConfigurados} puntos`}
              </div>
              <div className="stat-sublabel">
                {configuracionPuntoActual
                  ? 'Configurado para este punto'
                  : 'Con porcentaje configurado'}
              </div>
            </div>

            <div className={`stat-card ${montoRestante >= 0 ? 'stat-ganancia-positiva' : 'stat-ganancia-negativa'}`}>
              <div className="stat-label">Te queda</div>
              <div className="stat-value">${montoRestante.toFixed(2)}</div>
              <div className="stat-sublabel">Neta - porcentaje del socio</div>
            </div>

            <div className={`stat-card ${resumenSocio.montoSeleccionado >= 0 ? 'stat-ganancia-positiva' : 'stat-ganancia-negativa'}`}>
              <div className="stat-label">Monto para socio</div>
              <div className="stat-value">${resumenSocio.montoSeleccionado.toFixed(2)}</div>
              <div className="stat-sublabel">
                {configuracionPuntoActual ? 'Aplicado sobre la neta' : 'Suma estimada por punto'}
              </div>
            </div>
          </div>

          <div className="summary-report-card">
            <div className="summary-report-title">Resumen de reporte</div>
            <div className="summary-report-table">
              {resumenTabla.map((fila) => (
                <div className="summary-report-row" key={fila.label}>
                  <div className="summary-report-label">{fila.label}</div>
                  <div className={`summary-report-value ${fila.tone ? `tone-${fila.tone}` : ''}`}>
                    {fila.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {isAdmin() && ventasPorPuntoVenta.length > 0 && (
            <div className="puntos-venta-resumen">
              <h3>Ventas por Punto de Venta</h3>
              <div className="puntos-venta-grid">
                {ventasPorPuntoVenta.map((punto) => (
                  <div key={punto.nombre} className="punto-venta-card">
                    <div className="punto-venta-nombre">{punto.nombre}</div>
                    <div className="punto-venta-total">${punto.total.toFixed(2)}</div>
                    <div className="punto-venta-tickets">{punto.tickets} tickets</div>
                    <div className="punto-venta-meta">Premios: ${punto.premios.toFixed(2)}</div>
                    <div className="punto-venta-meta">Pagados: ${punto.premiosPagados.toFixed(2)}</div>
                    <div className="punto-venta-meta">Neta: ${punto.gananciaNeta.toFixed(2)}</div>
                    <div className="punto-venta-meta">
                      Socio {punto.porcentajeSocio.toFixed(2)}%: ${punto.montoSocio.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {estadisticas.ticketMasAlto && estadisticas.ticketMasBajo && (
            <div className="stats-extras">
              <div className="stat-extra">
                <span className="extra-label">Ticket más alto:</span>
                <span className="extra-value">
                  ${(estadisticas.ticketMasAlto.monto || 1).toFixed(2)} - {estadisticas.ticketMasAlto.numero || 'N/A'}
                </span>
              </div>
              <div className="stat-extra">
                <span className="extra-label">Ticket más bajo:</span>
                <span className="extra-value">
                  ${(estadisticas.ticketMasBajo.monto || 1).toFixed(2)} - {estadisticas.ticketMasBajo.numero || 'N/A'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Lista de tickets */}
        <div className="tickets-section">
          <div className="tickets-header">
            <h3>Tickets Vendidos ({ticketsEnRango.length})</h3>
            <button
              className="btn-toggle"
              onClick={() => setMostrarDetalle(!mostrarDetalle)}
            >
              {mostrarDetalle ? 'Ocultar' : 'Mostrar'} Detalle
            </button>
          </div>

          {ticketsEnRango.length === 0 ? (
            <div className="sin-tickets">
              <p>No hay tickets en el rango de fechas seleccionado</p>
              <small style={{color: '#999', fontSize: '0.85rem'}}>
                Total de tickets en sistema: {sorteos?.length || 0}
              </small>
            </div>
          ) : (
            <>
              {mostrarDetalle && (
                <div className="tickets-list">
                  <div className="tickets-table-header">
                    <div className="col-id">ID</div>
                    <div className="col-numero">Número</div>
                    <div className="col-tipo">Tipo</div>
                    <div className="col-monto">Monto</div>
                    <div className="col-fecha">Fecha</div>
                  </div>
                  <div className="tickets-table-body">
                    {ticketsEnRango.map(ticket => (
                      <div key={ticket.id} className="ticket-row">
                        <div className="col-id">
                          <div>{ticket.ticketId || ticket.id}</div>
                          {isAdmin() && (ticket.puntoVentaNombre || ticket.usuarioNombre) && (
                            <div className="ticket-meta-origen">
                              {ticket.puntoVentaNombre && <span>{ticket.puntoVentaNombre}</span>}
                              {ticket.usuarioNombre && <span>{ticket.usuarioNombre}</span>}
                            </div>
                          )}
                        </div>
                        <div className="col-numero">{ticket.numero || (ticket.numeros && ticket.numeros[0])}</div>
                        <div className="col-tipo">
                          {(() => {
                            const datos = obtenerDatosTipoApuesta(ticket.tipoApuesta, ticket.tipo);
                            return <span className={datos.clase}>{datos.etiqueta}</span>;
                          })()}
                        </div>
                        <div className="col-monto">${(ticket.monto || 1).toFixed(2)}</div>
                        <div className="col-fecha">{formatearFecha(ticket.fecha)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReporteVenta;
