import React, { useState, useEffect, useMemo } from 'react';
import './CalculadoraPremios.css';
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
      const primeros = numeroStr.slice(0, 2);
      const ultimos = numeroStr.slice(-2);
      const ultimosTres = numeroStr.slice(-3);

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

function obtenerDatosTipoApuesta(tipoApuesta = '') {
  const valor = (tipoApuesta || '').toLowerCase();
  switch (valor) {
    case 'box':
      return { clase: 'badge-box', etiqueta: 'Box' };
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
  if (valor === 'pick4tail3' || valor === 'pick4tail3box') return 'ultimos 3';
  if (valor === 'bolita1') return 'primera';
  if (valor === 'bolita2') return 'segunda';
  return posicion || '';
}

const agruparNumerosEnFilas = (numeros = [], maxPorFila = 6) => {
  if (!Array.isArray(numeros) || numeros.length === 0) return [];
  const grupos = [];
  for (let i = 0; i < numeros.length; i += maxPorFila) {
    grupos.push(numeros.slice(i, i + maxPorFila));
  }
  return grupos;
};

const ordenarNumerosTicket = (numeros = []) => {
  return [...numeros].sort((a, b) => {
    const strA = String(a);
    const strB = String(b);
    return strA.localeCompare(strB, 'es', { numeric: true, sensitivity: 'base' });
  });
};

const obtenerClaveAgrupacionTicket = (ticket = {}) =>
  String(ticket.grupoId || ticket.ticketId || ticket.id || '');

const obtenerEtiquetaTicket = (ticket = {}) =>
  String(ticket.ticketId || ticket.grupoId || ticket.id || '');

const construirDetalleTicket = (ticket, todosLosSorteos) => {
  if (!ticket) return [];

  const obtenerEntradas = () => {
    if (ticket.grupoId) {
      return todosLosSorteos.filter(t => t.grupoId === ticket.grupoId);
    }
    return [ticket];
  };

  const entradas = obtenerEntradas();
  const mapa = new Map();

  entradas.forEach(item => {
    const numero = String(item.numero || '').trim();
    if (!numero) return;
    const monto = parseFloat(item.monto) || 0;
    if (monto <= 0) return;
    const tipo = (item.tipoApuesta || 'straight').toLowerCase();

    if (!mapa.has(numero)) {
      mapa.set(numero, {
        numero,
        total: 0,
        tipos: {}
      });
    }

    const data = mapa.get(numero);
    data.total += monto;
    data.tipos[tipo] = (data.tipos[tipo] || 0) + monto;
  });

  const numerosOrdenados = ordenarNumerosTicket(Array.from(mapa.keys()));
  return numerosOrdenados.map(num => mapa.get(num));
};

const agruparResultadosPorTicket = (resultados = []) => {
  const mapa = new Map();

  resultados.forEach(item => {
    const ticketKey = obtenerClaveAgrupacionTicket(item);
    if (!ticketKey) return;

    if (!mapa.has(ticketKey)) {
      mapa.set(ticketKey, {
        id: item.id || ticketKey,
        referenciaPago: ticketKey,
        ticketId: ticketKey,
        ticketEtiqueta: obtenerEtiquetaTicket(item),
        grupoId: item.grupoId || null,
        fecha: item.fecha,
        fechaSorteo: item.fechaSorteo,
        loteriaNombre: item.loteriaNombre,
        puntoVentaId: item.puntoVentaId || '',
        puntoVentaNombre: item.puntoVentaNombre || '',
        usuarioNombre: item.usuarioNombre || '',
        username: item.username || '',
        pagado: Boolean(item.pagado),
        pagadoPorNombre: item.pagadoPorNombre || '',
        fechaPago: item.fechaPago || null,
        puntoVentaPagoNombre: item.puntoVentaPagoNombre || '',
        totalPremio: 0,
        totalMonto: 0,
        detallesPremio: [],
        ticketDetalle: item.ticketDetalle || [],
        posiciones: new Set(),
        numerosGanadores: new Set(),
        detallesPorNumero: new Map(),
        tiposUnicos: new Set()
      });
    }

    const agrupado = mapa.get(ticketKey);
    agrupado.pagado = agrupado.pagado || Boolean(item.pagado);
    if (!agrupado.ticketEtiqueta && item.ticketId) {
      agrupado.ticketEtiqueta = String(item.ticketId);
    }
    if (!agrupado.grupoId && item.grupoId) {
      agrupado.grupoId = item.grupoId;
    }
    if (!agrupado.puntoVentaNombre && item.puntoVentaNombre) {
      agrupado.puntoVentaNombre = item.puntoVentaNombre;
    }
    if (!agrupado.puntoVentaId && item.puntoVentaId) {
      agrupado.puntoVentaId = item.puntoVentaId;
    }
    if (!agrupado.usuarioNombre && item.usuarioNombre) {
      agrupado.usuarioNombre = item.usuarioNombre;
    }
    if (!agrupado.username && item.username) {
      agrupado.username = item.username;
    }
    if (!agrupado.pagadoPorNombre && item.pagadoPorNombre) {
      agrupado.pagadoPorNombre = item.pagadoPorNombre;
    }
    if (!agrupado.fechaPago && item.fechaPago) {
      agrupado.fechaPago = item.fechaPago;
    }
    if (!agrupado.puntoVentaPagoNombre && item.puntoVentaPagoNombre) {
      agrupado.puntoVentaPagoNombre = item.puntoVentaPagoNombre;
    }
    agrupado.totalPremio += item.premio || 0;
    agrupado.totalMonto += parseFloat(item.monto) || 0;
    const tipoNormalizado = (item.tipoApuesta || 'straight').toLowerCase();
    agrupado.tiposUnicos.add(tipoNormalizado);
    agrupado.detallesPremio.push({
      numero: item.numero,
      tipoApuesta: item.tipoApuesta,
      monto: item.monto,
      premio: item.premio,
      posicion: item.posicion,
      numeroGanador: item.numeroGanador
    });
    
    const numeroClave = String(item.numero || '').trim();
    if (numeroClave) {
      if (!agrupado.detallesPorNumero.has(numeroClave)) {
        agrupado.detallesPorNumero.set(numeroClave, {
          numero: numeroClave,
          premioTotal: 0,
          montosPorTipo: {},
          premiosPorTipo: {},
          posiciones: new Set(),
          numerosGanadores: new Set()
        });
      }
      const infoNumero = agrupado.detallesPorNumero.get(numeroClave);
      infoNumero.premioTotal += item.premio || 0;
      infoNumero.montosPorTipo[tipoNormalizado] = (infoNumero.montosPorTipo[tipoNormalizado] || 0) + (parseFloat(item.monto) || 0);
      infoNumero.premiosPorTipo[tipoNormalizado] = (infoNumero.premiosPorTipo[tipoNormalizado] || 0) + (item.premio || 0);
      if (item.posicion) infoNumero.posiciones.add(item.posicion);
      if (item.numeroGanador) infoNumero.numerosGanadores.add(item.numeroGanador);
    }

    if (item.ticketDetalle && item.ticketDetalle.length > 0 && agrupado.ticketDetalle.length === 0) {
      agrupado.ticketDetalle = item.ticketDetalle;
    }
    if (item.posicion) agrupado.posiciones.add(item.posicion);
    if (item.numeroGanador) agrupado.numerosGanadores.add(item.numeroGanador);
  });

  return Array.from(mapa.values())
    .map(entrada => ({
      ...entrada,
      ticketId: entrada.ticketEtiqueta || entrada.ticketId,
      posiciones: Array.from(entrada.posiciones).filter(Boolean),
      numerosGanadores: Array.from(entrada.numerosGanadores).filter(Boolean),
      detallesPremio: entrada.detallesPremio.sort((a, b) => {
        const cmpNumero = String(a.numero).localeCompare(String(b.numero), 'es', { numeric: true, sensitivity: 'base' });
        if (cmpNumero !== 0) return cmpNumero;
        return String(a.tipoApuesta).localeCompare(String(b.tipoApuesta));
      }),
      tiposUnicos: Array.from(entrada.tiposUnicos),
      detallesNumero: ordenarNumerosTicket(Array.from(entrada.detallesPorNumero.keys()))
        .map(numero => {
          const info = entrada.detallesPorNumero.get(numero);
          return {
            numero,
            premioTotal: info.premioTotal,
            montosPorTipo: info.montosPorTipo,
            premiosPorTipo: info.premiosPorTipo,
            posiciones: Array.from(info.posiciones),
            numerosGanadores: Array.from(info.numerosGanadores)
          };
        })
    }))
    .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
};

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

  const fecha = new Date(fechaStr);
  if (!isNaN(fecha.getTime())) {
    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${año}-${mes}-${dia}`;
  }

  return null;
};

const filtrarPorFecha = (lista = [], fechaFiltro = '') => {
  if (!fechaFiltro) return lista;
  return lista.filter(item => {
    const clave = obtenerClaveFecha(item.fecha || item.fechaTicket || item.fechaSorteo);
    return clave === fechaFiltro;
  });
};

const CalculadoraPremios = ({ sorteos, loterias, marcarPagoTicket }) => {
  const { isAdmin } = useAuth();
  const [pestañaActiva, setPestañaActiva] = useState('calcular'); // 'calcular' o 'ganadores'
  const [loteriaSeleccionada, setLoteriaSeleccionada] = useState('');
  const [numeroGanadorSeleccionado, setNumeroGanadorSeleccionado] = useState('');
  const [premiosCalculados, setPremiosCalculados] = useState([]);
  const [procesandoPagos, setProcesandoPagos] = useState({});
  const [pagosMarcados, setPagosMarcados] = useState({});
  const [pagosCargados] = useState(true);
  const [fechaFiltro, setFechaFiltro] = useState('');
  const [puntoVentaFiltro, setPuntoVentaFiltro] = useState('');
  const [mostrarHistorialCompleto, setMostrarHistorialCompleto] = useState(false);
  const [loteriaFiltroHistorial, setLoteriaFiltroHistorial] = useState('');
  const [tipoFiltroHistorial, setTipoFiltroHistorial] = useState(''); // '', '2', '3', '4', etc.
  const [ordenHistorial, setOrdenHistorial] = useState('monto'); // 'monto' o 'conteo'
  const [tipoApuestaFiltro, setTipoApuestaFiltro] = useState(''); // '', 'straight', 'box'
  const [fechaFiltroHistorial, setFechaFiltroHistorial] = useState(''); // Filtro por fecha en formato YYYY-MM-DD

  const formatearPosicion = (valor) => {
    if (!valor) return '-';
    const lower = valor.toString().toLowerCase();
    if (lower.startsWith('pri') || lower === '1') return '1ra';
    if (lower.startsWith('seg') || lower === '2') return '2da';
    if (lower.startsWith('ter') || lower === '3') return '3ra';
    if (lower.includes('bolita1')) return '1ra';
    if (lower.includes('bolita2')) return '2da';
    return valor.toString().toUpperCase();
  };

  const formatearFechaPago = (valor) => {
    if (!valor) return '';
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return '';
    return fecha.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Actualizar lotería seleccionada cuando cambien las loterías
  useEffect(() => {
    if (loterias.length > 0) {
      const existeSeleccionada = loterias.some(l => l.id.toString() === loteriaSeleccionada);
      if (!loteriaSeleccionada || !existeSeleccionada) {
        setLoteriaSeleccionada(loterias[0].id.toString());
      }
    } else {
      setLoteriaSeleccionada('');
    }
  }, [loterias, loteriaSeleccionada]);

  // Obtener números ganadores de la lotería seleccionada
  const numerosGanadores = useMemo(() => {
    if (!loteriaSeleccionada) return [];
    const loteria = loterias.find(l => l.id.toString() === loteriaSeleccionada);
    if (!loteria || !loteria.numerosGanadores) return [];
    return loteria.numerosGanadores.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  }, [loterias, loteriaSeleccionada]);

  // Calcular premios cuando se seleccione un número ganador
  const calcularPremiosParaNumero = (numeroGanador) => {
    console.log('🎯 CALCULADORA DE PREMIOS - INICIO');
    console.log('Número ganador seleccionado:', numeroGanador);
    console.log('Lotería seleccionada:', loteriaSeleccionada);
    
    if (!numeroGanador || !loteriaSeleccionada) {
      console.log('❌ No hay número ganador o lotería seleccionada');
      setPremiosCalculados([]);
      return;
    }

    const loteria = loterias.find(l => l.id && l.id.toString() === loteriaSeleccionada);
    if (!loteria) {
      console.log('❌ No se encontró la lotería');
      setPremiosCalculados([]);
      return;
    }
    console.log('✅ Lotería encontrada:', loteria.nombre);

    // Filtrar tickets de la lotería seleccionada
    const ticketsLoteria = sorteos.filter(ticket => 
      ticket.loteriaId && ticket.loteriaId.toString() === loteriaSeleccionada
    );
    console.log('📊 Tickets de esta lotería:', ticketsLoteria.length);
    console.log('Total de sorteos en sistema:', sorteos.length);

    const premios = [];
    const premiosConfigurados = loteria.premios ? normalizarPremios(loteria.premios) : normalizarPremios();

    const candidatos = extenderNumerosGanadores([numeroGanador]);
    console.log('🎲 Números candidatos (incluyendo derivados):', candidatos.map(c => c.numero));

    candidatos.forEach(candidato => {
      const numeroGanadorStr = String(candidato.numero || '').trim();
      if (!numeroGanadorStr) return;
      
      console.log('\n--- Procesando número ganador:', numeroGanadorStr, '---');
      console.log('Fecha del número ganador:', candidato.fecha);
      console.log('Es derivado:', candidato.esDerivado);

      let ticketsProcesados = 0;
      let ticketsGanadores = 0;

      ticketsLoteria.forEach(ticket => {
        ticketsProcesados++;
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

        const claveTicket = obtenerClaveFecha(ticket.fecha);
        const claveSorteo = obtenerClaveFecha(candidato.fecha || numeroGanador.fecha);
        
        if (ticketsProcesados <= 3) {
          console.log(`  Ticket ${ticketsProcesados}:`, {
            numero: numeroTicketLimpio,
            tipo: tipoApuesta,
            fechaTicket: ticket.fecha,
            claveTicket,
            claveSorteo,
            coincideFecha: claveTicket === claveSorteo
          });
        }
        
        if (claveTicket && claveSorteo && claveTicket !== claveSorteo) {
          if (ticketsProcesados <= 3) {
            console.log('  ❌ Rechazado: Fechas no coinciden');
          }
          return;
        }

        // Validación estricta: Si el número ganador es derivado, solo puede ganar si el ticket es Pick 2 straight
        if (candidato.esDerivado) {
          if (candidato.fuenteDerivada === 'pick4-tail3') {
            if (numeroTicketLimpio.length !== 3) {
              return;
            }
            if (tipoApuesta !== 'pick4tail3' && tipoApuesta !== 'pick4tail3box') {
              return;
            }
          } else {
            // Los números derivados de Pick 2 solo aplican a straight.
            if (numeroTicketLimpio.length !== 2 || tipoApuesta !== 'straight') {
              return;
            }
            if (numeroTicketLimpio !== numeroGanadorStr) {
              return;
            }
          }
        } else {
          // Si el número ganador NO es derivado, las longitudes deben coincidir exactamente
          if (numeroTicketLimpio.length !== numeroGanadorStr.length) {
            return; // Las longitudes no coinciden
          }
        }

        if (numeroCoincide(numeroTicketLimpio, numeroGanadorStr, tipoApuesta, { 
          esDerivado: candidato.esDerivado,
          fuenteDerivada: candidato.fuenteDerivada,
          longitudTicket: numeroTicketLimpio.length 
        })) {
          const monto = parseFloat(ticket.monto) || 0;
          const premio = calcularPremio(
            tipoApuesta,
            numeroTicketLimpio,
            monto,
            premiosConfigurados,
            { posicion: candidato.posicion }
          );
          
          if (ticketsProcesados <= 3) {
            console.log('  ✅ Número coincide! Premio calculado:', premio);
          }
          
          if (premio > 0) {
            ticketsGanadores++;
            const detalleTicket = construirDetalleTicket(ticket, sorteos);

            premios.push({
              id: ticket.id,
              ticketId: ticket.ticketId || ticket.id,
              grupoId: ticket.grupoId || null,
              numero: numeroTicketLimpio,
              tipoApuesta: tipoApuesta,
              monto: monto,
              premio: premio,
              fecha: ticket.fecha,
              numeroGanador: numeroGanadorStr,
              puntoVentaId: ticket.puntoVentaId || '',
              puntoVentaNombre: ticket.puntoVentaNombre || '',
              usuarioNombre: ticket.usuarioNombre || ticket.vendedorNombre || '',
              username: ticket.username || '',
              pagado: Boolean(ticket.pagado),
              pagadoPorNombre: ticket.pagadoPorNombre || '',
              fechaPago: ticket.fechaPago || null,
              puntoVentaPagoNombre: ticket.puntoVentaPagoNombre || '',
              posicion: obtenerPosicionLabel(candidato.posicion, tipoApuesta),
              ticketDetalle: detalleTicket,
              ticketCompleto: detalleTicket.map(d => d.numero).join(', ')
            });
          } else {
            if (ticketsProcesados <= 3) {
              console.log('  ⚠️ Premio calculado es 0');
            }
          }
        } else {
          if (ticketsProcesados <= 3) {
            console.log('  ❌ Número no coincide');
          }
        }
      });
      
      console.log(`Tickets procesados: ${ticketsProcesados}, Ganadores: ${ticketsGanadores}`);
    });

    console.log('\n🏆 RESUMEN FINAL:');
    console.log('Total de premios encontrados:', premios.length);
    console.log('Premios:', premios);
    
    setPremiosCalculados(agruparResultadosPorTicket(premios));
  };

  // Calcular cuando cambie el número ganador seleccionado
  useEffect(() => {
    if (numeroGanadorSeleccionado) {
      const numeroGanador = numerosGanadores.find(n => n.id.toString() === numeroGanadorSeleccionado);
      if (numeroGanador) {
        calcularPremiosParaNumero(numeroGanador);
      }
    } else {
      setPremiosCalculados([]);
    }
  }, [numeroGanadorSeleccionado, sorteos, loteriaSeleccionada]);

  const puntosVentaDisponibles = useMemo(() => {
    const mapa = new Map();

    sorteos.forEach((ticket) => {
      const id = String(ticket.puntoVentaId || '');
      const nombre = String(ticket.puntoVentaNombre || '').trim();
      if (!id || !nombre || mapa.has(id)) return;
      mapa.set(id, { id, nombre });
    });

    return Array.from(mapa.values()).sort((a, b) =>
      a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
    );
  }, [sorteos]);

  const aplicarFiltrosPremios = (lista = []) => {
    let resultado = filtrarPorFecha(lista, fechaFiltro);

    if (puntoVentaFiltro) {
      resultado = resultado.filter(
        (item) => String(item.puntoVentaId || '') === puntoVentaFiltro
      );
    }

    return resultado;
  };

  const premiosFiltrados = useMemo(
    () => aplicarFiltrosPremios(premiosCalculados),
    [premiosCalculados, fechaFiltro, puntoVentaFiltro]
  );

  const totalPremios = premiosFiltrados.reduce((sum, p) => sum + (p.totalPremio || 0), 0);
  const totalGanadoresCalcular = premiosFiltrados.length;
  const pagadosCalcular = premiosFiltrados.filter(p => p.pagado).length;

  // Obtener todos los tickets ganadores de todas las loterías
  const todosTicketsGanadores = useMemo(() => {
    if (!loterias || loterias.length === 0) return [];
    
    const ticketsGanadores = [];
    
    loterias.forEach(loteria => {
      if (!loteria.numerosGanadores || loteria.numerosGanadores.length === 0) return;
      const premiosConfigurados = loteria.premios ? normalizarPremios(loteria.premios) : normalizarPremios();
      
      const candidatos = extenderNumerosGanadores(loteria.numerosGanadores);

      candidatos.forEach(numeroGanador => {
        const ticketsLoteria = sorteos.filter(ticket => 
          ticket.loteriaId && ticket.loteriaId.toString() === loteria.id.toString()
        );
        
        ticketsLoteria.forEach(ticket => {
          // Detectar tipo de apuesta - usar tipoApuesta si existe, sino detectar del formato
          let tipoApuestaDetectado = (ticket.tipoApuesta || ticket.tipo || '').toLowerCase().trim();
          
          const numeroTicket = String(ticket.numero || '').trim();
          
          // Si no hay tipo explícito, detectar por el formato del número original
          if (!tipoApuestaDetectado && numeroTicket) {
            const numeroLower = numeroTicket.toLowerCase().trim();
            if (numeroLower.match(/^\d{2}\+1$/)) {
              tipoApuestaDetectado = 'bolita1';
            } else if (numeroLower.match(/^\d{2}\+2$/)) {
              tipoApuestaDetectado = 'bolita2';
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
          
          // Validación estricta: Si el número ganador es derivado, solo puede ganar si el ticket es Pick 2 straight
          if (numeroGanador.esDerivado) {
            if (numeroGanador.fuenteDerivada === 'pick4-tail3') {
              if (numeroTicketLimpio.length !== 3) {
                return;
              }
              if (tipoApuesta !== 'pick4tail3' && tipoApuesta !== 'pick4tail3box') {
                return;
              }
            } else {
              if (numeroTicketLimpio.length !== 2) {
                return;
              }
              if (tipoApuesta !== 'straight') {
                return;
              }
              if (numeroTicketLimpio !== numeroGanadorStr) {
                return;
              }
              if (numeroGanadorStr.length !== 2) {
                return;
              }
            }
          } else {
            // Si el número ganador NO es derivado, las longitudes deben coincidir exactamente
            if (numeroTicketLimpio.length !== numeroGanadorStr.length) {
              return; // Las longitudes no coinciden - no puede ganar
            }
          }
          
          // Llamar a numeroCoincide con información sobre si es derivado
          if (numeroCoincide(numeroTicketLimpio, numeroGanadorStr, tipoApuesta, { 
            esDerivado: numeroGanador.esDerivado,
            fuenteDerivada: numeroGanador.fuenteDerivada,
            longitudTicket: numeroTicketLimpio.length 
          })) {
            const claveTicket = obtenerClaveFecha(ticket.fecha);
            const claveSorteo = obtenerClaveFecha(numeroGanador.fecha);
            if (claveTicket && claveSorteo && claveTicket !== claveSorteo) {
              return; // Las fechas no coinciden
            }

            const monto = parseFloat(ticket.monto) || 0;
            const premio = calcularPremio(
              tipoApuesta,
              numeroTicketLimpio,
              monto,
              premiosConfigurados,
              { posicion: numeroGanador.posicion }
            );
            
            if (premio > 0) {
            const detalleTicket = construirDetalleTicket(ticket, sorteos);

              ticketsGanadores.push({
                id: ticket.id,
                ticketId: ticket.ticketId || ticket.id,
                grupoId: ticket.grupoId || null,
                numero: numeroTicketLimpio,
                tipoApuesta: tipoApuesta,
                monto: monto,
                premio: premio,
                fecha: ticket.fecha,
                numeroGanador: numeroGanadorStr,
                loteriaNombre: loteria.nombre,
                fechaSorteo: numeroGanador.fecha,
                puntoVentaId: ticket.puntoVentaId || '',
                puntoVentaNombre: ticket.puntoVentaNombre || '',
                usuarioNombre: ticket.usuarioNombre || ticket.vendedorNombre || '',
                username: ticket.username || '',
                pagado: Boolean(ticket.pagado),
                pagadoPorNombre: ticket.pagadoPorNombre || '',
                fechaPago: ticket.fechaPago || null,
                puntoVentaPagoNombre: ticket.puntoVentaPagoNombre || '',
                posicion: obtenerPosicionLabel(numeroGanador.posicion, tipoApuesta),
                ticketDetalle: detalleTicket,
                ticketCompleto: detalleTicket.map(d => d.numero).join(', ')
              });
            }
          }
        });
      });
    });
    
    return agruparResultadosPorTicket(ticketsGanadores);
  }, [sorteos, loterias]);

  const todosTicketsFiltrados = useMemo(
    () => aplicarFiltrosPremios(todosTicketsGanadores),
    [todosTicketsGanadores, fechaFiltro, puntoVentaFiltro]
  );

  const totalGanadoresGeneral = todosTicketsFiltrados.length;
  const pagadosGenerales = todosTicketsFiltrados.filter(p => p.pagado).length;

  // Cargar pagos marcados desde localStorage al montar el componente

  // Guardar pagos marcados en localStorage cuando cambien (solo después de cargar)

  // Limpiar pagos marcados de tickets que ya no existen (solo después de cargar)
  useEffect(() => {
    if (!pagosCargados) return; // No limpiar hasta que se hayan cargado los datos iniciales
    if (premiosCalculados.length === 0 && todosTicketsGanadores.length === 0) {
      return;
    }

    setPagosMarcados(prev => {
      const actualizados = { ...prev };
      // Normalizar todos los IDs a strings para comparación
      const idsActuales = new Set([
        ...premiosCalculados.map(p => String(p.ticketId || p.id || '')),
        ...todosTicketsGanadores.map(p => String(p.ticketId || p.id || ''))
      ].filter(id => id)); // Filtrar IDs vacíos

      // Eliminar solo los pagos de tickets que ya no existen
      Object.keys(actualizados).forEach(id => {
        const idNormalizado = String(id);
        if (!idsActuales.has(idNormalizado)) {
          delete actualizados[idNormalizado];
        }
      });

      return actualizados;
    });
  }, [premiosCalculados, todosTicketsGanadores, pagosCargados]);

  // El filtro de lotería para historial se inicializa vacío por defecto (todas las loterías)

  // Historial completo de todos los números jugados
  const historialCompleto = useMemo(() => {
    if (!sorteos || sorteos.length === 0) {
      return [];
    }

    const loteriaIdFiltro = loteriaFiltroHistorial ? loteriaFiltroHistorial : null;
    const numerosMap = {};

    sorteos.forEach(ticket => {
      // Si hay filtro de lotería, solo incluir tickets de esa lotería
      if (loteriaIdFiltro && ticket.loteriaId && String(ticket.loteriaId) !== loteriaIdFiltro) {
        return;
      }
      
      // Si hay filtro de fecha, solo incluir tickets de esa fecha
      if (fechaFiltroHistorial) {
        const claveTicket = obtenerClaveFecha(ticket.fecha);
        if (claveTicket !== fechaFiltroHistorial) {
          return;
        }
      }
      
      const numeroTicket = String(ticket.numero || '').trim();
      if (!numeroTicket) return;

      // Detectar tipo de apuesta - usar tipoApuesta si existe, sino detectar del formato
      let tipoDetectado = '';
      
      // Primero intentar obtener del campo tipoApuesta o tipo del ticket
      const tipoTicket = (ticket.tipoApuesta || ticket.tipo || '').toString().toLowerCase().trim();
      
      // También verificar el formato del número original para detectar tipo
      const numeroLower = numeroTicket.toLowerCase().trim();
      let tipoPorFormato = '';
      
      if (numeroLower.match(/^\d{2}\+1$/)) {
        tipoPorFormato = 'bolita1';
      } else if (numeroLower.match(/^\d{2}\+2$/)) {
        tipoPorFormato = 'bolita2';
      } else if (numeroLower.match(/^\d{3}b\+$/)) {
        tipoPorFormato = 'pick4tail3box';
      } else if (numeroLower.match(/^\d{3}b$/)) {
        tipoPorFormato = 'pick4tail3';
      } else if (numeroLower.endsWith('+') && !numeroLower.match(/\+\d$/)) {
        // Termina en + pero no es bolita (ej: "123+")
        tipoPorFormato = 'box';
      } else if (numeroLower.match(/^\d$/)) {
        tipoPorFormato = 'singulation';
      } else if (numeroLower.endsWith('q')) {
        tipoPorFormato = 'straight';
      } else {
        tipoPorFormato = 'straight';
      }
      
      // Usar tipo del ticket si existe y es válido, sino usar el detectado por formato
      if (tipoTicket && (tipoTicket === 'box' || tipoTicket === 'straight' || tipoTicket === 'singulation' || 
          tipoTicket === 'bolita1' || tipoTicket === 'bolita2' || tipoTicket === 'pick4tail3' || tipoTicket === 'pick4tail3box')) {
        tipoDetectado = tipoTicket;
      } else {
        tipoDetectado = tipoPorFormato;
      }
      
      // Asegurar que tenga un valor
      if (!tipoDetectado) {
        tipoDetectado = 'straight';
      }

      // Limpiar el número base (sin sufijos como +, q, +1, +2)
      const numeroBase = numeroTicket.replace(/[^0-9]/g, '');
      if (!numeroBase) return;

      // Filtrar por tipo (longitud del número): Pick 2, Pick 3, Pick 4, etc.
      if (tipoFiltroHistorial) {
        const longitudFiltro = parseInt(tipoFiltroHistorial);
        if (numeroBase.length !== longitudFiltro) {
          return;
        }
      }

      const montoTicket = parseFloat(ticket.monto) || 0;
      if (montoTicket <= 0) return; // Ignorar tickets sin monto

      if (!numerosMap[numeroBase]) {
        numerosMap[numeroBase] = {
          numero: numeroBase,
          longitud: numeroBase.length,
          straight: { conteo: 0, monto: 0 },
          box: { conteo: 0, monto: 0 },
          pick4tail3: { conteo: 0, monto: 0 },
          pick4tail3box: { conteo: 0, monto: 0 },
          bolita1: { conteo: 0, monto: 0 },
          bolita2: { conteo: 0, monto: 0 },
          singulation: { conteo: 0, monto: 0 },
          total: { conteo: 0, monto: 0 }
        };
      }

      // Mapear el tipo detectado a la clave correcta
      let tipoKey = 'straight'; // Valor por defecto
      if (tipoDetectado === 'box') {
        tipoKey = 'box';
      } else if (tipoDetectado === 'pick4tail3') {
        tipoKey = 'pick4tail3';
      } else if (tipoDetectado === 'pick4tail3box') {
        tipoKey = 'pick4tail3box';
      } else if (tipoDetectado === 'singulation') {
        tipoKey = 'singulation';
      } else if (tipoDetectado === 'bolita1') {
        tipoKey = 'bolita1';
      } else if (tipoDetectado === 'bolita2') {
        tipoKey = 'bolita2';
      } else if (tipoDetectado === 'straight') {
        tipoKey = 'straight';
      }

      // Incrementar contadores y montos
      if (numerosMap[numeroBase][tipoKey]) {
        numerosMap[numeroBase][tipoKey].conteo += 1;
        numerosMap[numeroBase][tipoKey].monto += montoTicket;
      }

      // Incrementar totales generales
      numerosMap[numeroBase].total.conteo += 1;
      numerosMap[numeroBase].total.monto += montoTicket;
    });

    // Convertir a array y filtrar por tipo de apuesta si es necesario
    let resultados = Object.values(numerosMap);

    // Filtrar por tipo de apuesta (straight, box)
    if (tipoApuestaFiltro && tipoApuestaFiltro.trim() !== '') {
      if (tipoApuestaFiltro === 'straight') {
        // Filtrar números que tengan al menos una jugada straight, singulation, bolita1 o bolita2
        resultados = resultados.filter(item => {
          return item.straight.conteo > 0 || 
                 item.pick4tail3.conteo > 0 ||
                 item.singulation.conteo > 0 || 
                 item.bolita1.conteo > 0 || 
                 item.bolita2.conteo > 0;
        });

        // Recalcular totales solo con straight, singulation, bolita1, bolita2 (ignorar box)
        resultados = resultados.map(item => {
          const nuevoTotal = {
            conteo: item.straight.conteo + item.pick4tail3.conteo + item.singulation.conteo + item.bolita1.conteo + item.bolita2.conteo,
            monto: item.straight.monto + item.pick4tail3.monto + item.singulation.monto + item.bolita1.monto + item.bolita2.monto
          };
          // Crear una copia del item con los totales recalculados
          return {
            ...item,
            total: nuevoTotal,
            // Opcional: poner box en 0 para que se vea más claro
            box: { conteo: 0, monto: 0 }
          };
        });

      } else if (tipoApuestaFiltro === 'box') {
        // Filtrar números que tengan jugadas box
        resultados = resultados.filter(item => {
          return item.box.conteo > 0 || item.pick4tail3box.conteo > 0;
        });

        // Recalcular totales solo con box (ignorar straight)
        resultados = resultados.map(item => {
          // Crear una copia del item con los totales solo de box
          return {
            ...item,
            total: { conteo: item.box.conteo + item.pick4tail3box.conteo, monto: item.box.monto + item.pick4tail3box.monto },
            // Opcional: poner straight en 0 para que se vea más claro
            straight: { conteo: 0, monto: 0 },
            pick4tail3: { conteo: 0, monto: 0 },
            pick4tail3box: { conteo: item.pick4tail3box.conteo, monto: item.pick4tail3box.monto },
            singulation: { conteo: 0, monto: 0 },
            bolita1: { conteo: 0, monto: 0 },
            bolita2: { conteo: 0, monto: 0 }
          };
        });
      }
    }

    // Ordenar por monto total (mayor a menor) o por conteo (mayor a menor)
    resultados.sort((a, b) => {
      if (ordenHistorial === 'monto') {
        // Ordenar por monto total de mayor a menor
        if (b.total.monto !== a.total.monto) {
          return b.total.monto - a.total.monto;
        }
        // Si el monto es igual, ordenar por conteo
        return b.total.conteo - a.total.conteo;
      } else {
        // Ordenar por conteo de mayor a menor
        if (b.total.conteo !== a.total.conteo) {
          return b.total.conteo - a.total.conteo;
        }
        // Si el conteo es igual, ordenar por monto
        return b.total.monto - a.total.monto;
      }
    });

    return resultados;
  }, [sorteos, loteriaFiltroHistorial, tipoFiltroHistorial, ordenHistorial, tipoApuestaFiltro, fechaFiltroHistorial]);

  const obtenerEtiquetaTipo = (tipo = '') => {
    const valor = tipo.toLowerCase();
    if (valor === 'bolita1') return 'Bolita 1';
    if (valor === 'bolita2') return 'Bolita 2';
    if (valor === 'singulation') return 'Singulation';
    if (valor === 'pick4tail3') return 'Ultimos 3 Pick 4';
    if (valor === 'pick4tail3box') return 'Ultimos 3 Pick 4 Box';
    if (valor === 'box') return 'Box';
    if (valor === 'straight') return 'Straight';
    return tipo;
  };

  const togglePago = async (ticket) => {
    const referencia = obtenerClaveAgrupacionTicket(ticket);
    if (!referencia || !marcarPagoTicket) return;

    setProcesandoPagos((prev) => ({
      ...prev,
      [referencia]: true
    }));

    try {
      await marcarPagoTicket({
        id: ticket.id,
        ticketId: ticket.ticketId,
        grupoId: ticket.grupoId,
        pagado: !ticket.pagado
      });
    } catch (error) {
      console.error('CalculadoraPremios: error al actualizar pago', error);
    } finally {
      setProcesandoPagos((prev) => {
        const siguiente = { ...prev };
        delete siguiente[referencia];
        return siguiente;
      });
    }
  };

  return (
    <div className="calculadora-premios-container">
      <div className="calculadora-premios-card">
        <h2 className="card-title">Calculadora de Premios</h2>

        {/* Pestañas */}
        <div className="tabs-container">
          <button
            className={`tab-button ${pestañaActiva === 'calcular' ? 'active' : ''}`}
            onClick={() => setPestañaActiva('calcular')}
          >
            Calcular Premios
          </button>
          <button
            className={`tab-button ${pestañaActiva === 'ganadores' ? 'active' : ''}`}
            onClick={() => setPestañaActiva('ganadores')}
          >
            Tickets Ganadores ({todosTicketsFiltrados.length})
          </button>
        </div>

        {pestañaActiva === 'calcular' && (
          <>
            {loterias.length === 0 ? (
              <div className="sin-loterias">
                <p>No hay loterías registradas</p>
                <p className="texto-secundario">Primero agrega una lotería en "Gestionar Loterías"</p>
              </div>
            ) : numerosGanadores.length === 0 ? (
              <div className="sin-numeros">
                <p>No hay números ganadores registrados</p>
                <p className="texto-secundario">Agrega números ganadores para calcular premios</p>
              </div>
            ) : (
              <>
                <div className="filtros-premios">
              <div className="form-group">
                <label>Lotería:</label>
                <select
                  value={loteriaSeleccionada}
                  onChange={(e) => {
                    setLoteriaSeleccionada(e.target.value);
                    setNumeroGanadorSeleccionado('');
                  }}
                  className="select-loteria-premios"
                >
                  {loterias.map(loteria => (
                    <option key={loteria.id} value={loteria.id}>
                      {loteria.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Número Ganador:</label>
                <select
                  value={numeroGanadorSeleccionado}
                  onChange={(e) => setNumeroGanadorSeleccionado(e.target.value)}
                  className="select-numero-ganador"
                >
                  <option value="">Selecciona un número ganador</option>
                  {numerosGanadores.map(numero => (
                    <option key={numero.id} value={numero.id}>
                      {numero.numero} - {numero.fecha} {numero.premio > 0 ? `($${numero.premio.toFixed(2)})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group form-fecha-filtro">
                <label>Fecha de premio:</label>
                <div className="filtro-fecha-acciones">
                  <input
                    type="date"
                    value={fechaFiltro}
                    onChange={(e) => setFechaFiltro(e.target.value)}
                  />
                  {fechaFiltro && (
                    <button
                      type="button"
                      className="btn-limpiar-fecha"
                      onClick={() => setFechaFiltro('')}
                    >
                      Mostrar todo
                    </button>
                  )}
                </div>
              </div>
              {isAdmin() && puntosVentaDisponibles.length > 0 && (
                <div className="form-group">
                  <label>Punto de venta:</label>
                  <select
                    value={puntoVentaFiltro}
                    onChange={(e) => setPuntoVentaFiltro(e.target.value)}
                    className="select-loteria-premios"
                  >
                    <option value="">Todos los puntos</option>
                    {puntosVentaDisponibles.map((punto) => (
                      <option key={punto.id} value={punto.id}>
                        {punto.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {premiosCalculados.length > 0 && (
              <div className="resultados-premios">
                <div className="resumen-premios">
                  <div className="resumen-item-premio">
                    <span className="resumen-label">Total de Tickets Ganadores:</span>
                    <span className="resumen-value">{premiosCalculados.length}</span>
                  </div>
                  <div className="resumen-item-premio">
                    <span className="resumen-label">Total a Pagar:</span>
                    <span className="resumen-value resumen-total">${totalPremios.toFixed(2)}</span>
                  </div>
                  <div className="resumen-item-premio">
                    <span className="resumen-label">Pagados:</span>
                    <span className="resumen-value">{pagadosCalcular} / {totalGanadoresCalcular}</span>
                  </div>
                </div>

                <div className="lista-premios">
                  <h3>Tickets Ganadores</h3>
                    <div className="premios-table premios-table-calcular">
                      <div className="premios-table-header">
                        <div className="col-ticket-id">Ticket ID</div>
                        <div className="col-numero-premio">Número</div>
                        <div className="col-ticket-completo">Ticket completo</div>
                        <div className="col-tipo-premio">Tipo</div>
                        <div className="col-posicion-premio">Posición</div>
                        <div className="col-monto-premio">Monto Apostado</div>
                        <div className="col-pagado">Pagado</div>
                        <div className="col-premio">Premio</div>
                      </div>
                      <div className="premios-table-body">
                      {premiosFiltrados.map((premio, index) => (
                        <div key={index} className="premio-row">
                          <div className="col-ticket-id" data-label="Ticket ID">
                            <div>{premio.ticketId}</div>
                            {isAdmin() && (premio.puntoVentaNombre || premio.usuarioNombre) && (
                              <div className="ticket-meta-origen">
                                {premio.puntoVentaNombre && <span>{premio.puntoVentaNombre}</span>}
                                {premio.usuarioNombre && <span>{premio.usuarioNombre}</span>}
                              </div>
                            )}
                            {premio.pagado && (premio.pagadoPorNombre || premio.fechaPago) && (
                              <div className="ticket-meta-pago">
                                {premio.pagadoPorNombre && <span>Pago: {premio.pagadoPorNombre}</span>}
                                {premio.puntoVentaPagoNombre && <span>{premio.puntoVentaPagoNombre}</span>}
                                {premio.fechaPago && <span>{formatearFechaPago(premio.fechaPago)}</span>}
                              </div>
                            )}
                          </div>
                          <div className="col-numero-premio" data-label="Números">
                            <div className="ticket-completo-grid">
                              {agruparNumerosEnFilas(
                                (premio.detallesNumero && premio.detallesNumero.length > 0
                                  ? premio.detallesNumero.map(d => d.numero)
                                  : [premio.numero]
                                )
                                  .filter(Boolean)
                                  .map(num => String(num).trim()),
                                8
                              ).map((fila, filaIdx) => (
                                <div key={`${premio.ticketId}-numeros-${filaIdx}`} className="ticket-completo-row">
                                  {fila.map((num, idx) => (
                                    <span key={`${premio.ticketId}-numero-${filaIdx}-${idx}`} className="ticket-numero-valor">
                                      {num}
                                    </span>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="col-ticket-completo" data-label="Ticket completo">
                            <div className="ticket-completo-grid">
                              {agruparNumerosEnFilas(
                                (premio.ticketDetalle && premio.ticketDetalle.length > 0
                                  ? premio.ticketDetalle.map(d => d.numero)
                                  : [premio.numero]
                                )
                                  .filter(Boolean)
                                  .map(num => String(num).trim()),
                                8
                              ).map((fila, filaIdx) => (
                                <div key={`${premio.ticketId}-ticket-${filaIdx}`} className="ticket-completo-row">
                                  {fila.map((num, idx) => (
                                    <span key={`${premio.ticketId}-ticket-num-${filaIdx}-${idx}`} className="ticket-numero-valor">
                                      {num}
                                    </span>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="col-tipo-premio" data-label="Tipos">
                            {premio.tiposUnicos && premio.tiposUnicos.length > 1 ? (
                              <span className="badge-multiple">Múltiples</span>
                            ) : (
                              (() => {
                                const tipoUnico = premio.tiposUnicos?.[0];
                                if (!tipoUnico) return <span className="badge-straight">Straight</span>;
                                const datos = obtenerDatosTipoApuesta(tipoUnico);
                                return <span className={datos.clase}>{datos.etiqueta}</span>;
                              })()
                            )}
                          </div>
                          <div className="col-posicion-premio" data-label="Posición">
                            {premio.posiciones && premio.posiciones.length > 1
                              ? 'Varias'
                              : formatearPosicion(premio.posiciones?.[0])}
                          </div>
                          <div className="col-monto-premio" data-label="Monto">
                            ${premio.totalMonto.toFixed(2)}
                          </div>
                          <div className="col-pagado" data-label="Pagado">
                            <label className="checkbox-pagado">
                              <input
                                type="checkbox"
                                checked={Boolean(premio.pagado)}
                                disabled={Boolean(procesandoPagos[obtenerClaveAgrupacionTicket(premio)])}
                                onChange={() => togglePago(premio)}
                              />
                              <span>
                                {procesandoPagos[obtenerClaveAgrupacionTicket(premio)] ? 'Guardando...' : 'Pagado'}
                              </span>
                            </label>
                          </div>
                          <div className="col-premio" data-label="Premio">
                            ${premio.totalPremio.toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

                {numeroGanadorSeleccionado && premiosCalculados.length === 0 && (
                  <div className="sin-premios">
                    <p>No hay tickets ganadores para este número</p>
                    <p className="texto-secundario">No se encontraron tickets que coincidan con el número ganador</p>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {pestañaActiva === 'ganadores' && (
          <div className="tickets-ganadores-tab">
            {todosTicketsGanadores.length === 0 ? (
              <div className="sin-premios">
                <p>No hay tickets ganadores</p>
                <p className="texto-secundario">Los tickets ganadores aparecerán aquí cuando se registren números ganadores</p>
              </div>
            ) : (
              <>
                <div className="resumen-premios">
                  <div className="resumen-item-premio">
                    <span className="resumen-label">Total de Tickets Ganadores:</span>
                    <span className="resumen-value">{todosTicketsGanadores.length}</span>
                  </div>
                  <div className="resumen-item-premio">
                    <span className="resumen-label">Total a Pagar:</span>
                    <span className="resumen-value resumen-total">
                      ${todosTicketsFiltrados.reduce((sum, t) => sum + (t.totalPremio || 0), 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="resumen-item-premio">
                    <span className="resumen-label">Pagados:</span>
                    <span className="resumen-value">{pagadosGenerales} / {totalGanadoresGeneral}</span>
                  </div>
                </div>

                <div className="lista-premios">
                  <h3>Todos los Tickets Ganadores</h3>
                  <div className="filtro-fecha-general">
                    <label>Fecha de premio:</label>
                    <div className="filtro-fecha-acciones">
                      <input
                        type="date"
                        value={fechaFiltro}
                        onChange={(e) => setFechaFiltro(e.target.value)}
                      />
                      {fechaFiltro && (
                        <button
                          type="button"
                          className="btn-limpiar-fecha"
                          onClick={() => setFechaFiltro('')}
                        >
                          Mostrar todo
                        </button>
                      )}
                    </div>
                  </div>
                  {isAdmin() && puntosVentaDisponibles.length > 0 && (
                    <div className="filtro-fecha-general">
                      <label>Punto de venta:</label>
                      <div className="filtro-fecha-acciones">
                        <select
                          value={puntoVentaFiltro}
                          onChange={(e) => setPuntoVentaFiltro(e.target.value)}
                          className="select-numero-ganador"
                        >
                          <option value="">Todos los puntos</option>
                          {puntosVentaDisponibles.map((punto) => (
                            <option key={punto.id} value={punto.id}>
                              {punto.nombre}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                  <div className="premios-table">
                    <div className="premios-table-header">
                      <div className="col-loteria">Lotería</div>
                      <div className="col-ticket-id">Ticket ID</div>
                      <div className="col-numero-premio">Número</div>
                      <div className="col-ticket-completo">Ticket completo</div>
                      <div className="col-tipo-premio">Tipo</div>
                      <div className="col-posicion-premio">Posición</div>
                      <div className="col-monto-premio">Monto</div>
                      <div className="col-pagado">Pagado</div>
                      <div className="col-premio">Premio</div>
                      <div className="col-fecha-sorteo">Fecha Sorteo</div>
                    </div>
                    <div className="premios-table-body">
                      {todosTicketsFiltrados.map((ticket, index) => (
                        <div key={index} className="premio-row ganador-row">
                          <div className="col-loteria" data-label="Lotería">{ticket.loteriaNombre}</div>
                          <div className="col-ticket-id" data-label="Ticket ID">
                            <div>{ticket.ticketId}</div>
                            {isAdmin() && (ticket.puntoVentaNombre || ticket.usuarioNombre) && (
                              <div className="ticket-meta-origen">
                                {ticket.puntoVentaNombre && <span>{ticket.puntoVentaNombre}</span>}
                                {ticket.usuarioNombre && <span>{ticket.usuarioNombre}</span>}
                              </div>
                            )}
                            {ticket.pagado && (ticket.pagadoPorNombre || ticket.fechaPago) && (
                              <div className="ticket-meta-pago">
                                {ticket.pagadoPorNombre && <span>Pago: {ticket.pagadoPorNombre}</span>}
                                {ticket.puntoVentaPagoNombre && <span>{ticket.puntoVentaPagoNombre}</span>}
                                {ticket.fechaPago && <span>{formatearFechaPago(ticket.fechaPago)}</span>}
                              </div>
                            )}
                          </div>
                          <div className="col-numero-premio" data-label="Números">
                            <div className="ticket-completo-grid">
                              {agruparNumerosEnFilas(
                                (ticket.detallesNumero && ticket.detallesNumero.length > 0
                                  ? ticket.detallesNumero.map(d => d.numero)
                                  : [ticket.numero]
                                )
                                  .filter(Boolean)
                                  .map(num => String(num).trim()),
                                8
                              ).map((fila, filaIdx) => (
                                <div key={`${ticket.ticketId}-numeros-${filaIdx}`} className="ticket-completo-row">
                                  {fila.map((num, idx) => (
                                    <span key={`${ticket.ticketId}-numero-${filaIdx}-${idx}`} className="ticket-numero-valor">
                                      {num}
                                    </span>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="col-ticket-completo" data-label="Ticket completo">
                            <div className="ticket-completo-grid">
                              {agruparNumerosEnFilas(
                                (ticket.ticketDetalle && ticket.ticketDetalle.length > 0
                                  ? ticket.ticketDetalle.map(d => d.numero)
                                  : [ticket.numero]
                                )
                                  .filter(Boolean)
                                  .map(num => String(num).trim()),
                                8
                              ).map((fila, filaIdx) => (
                                <div key={`${ticket.ticketId}-ticket-${filaIdx}`} className="ticket-completo-row">
                                  {fila.map((num, idx) => (
                                    <span key={`${ticket.ticketId}-ticket-num-${filaIdx}-${idx}`} className="ticket-numero-valor">
                                      {num}
                                    </span>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="col-tipo-premio" data-label="Tipos">
                            {ticket.tiposUnicos && ticket.tiposUnicos.length > 1 ? (
                              <span className="badge-multiple">Múltiples</span>
                            ) : (
                              (() => {
                                const tipoUnico = ticket.tiposUnicos?.[0];
                                if (!tipoUnico) return <span className="badge-straight">Straight</span>;
                                const datos = obtenerDatosTipoApuesta(tipoUnico);
                                return <span className={datos.clase}>{datos.etiqueta}</span>;
                              })()
                            )}
                          </div>
                          <div className="col-posicion-premio" data-label="Posición">
                            {ticket.posiciones && ticket.posiciones.length > 1
                              ? 'Varias'
                              : formatearPosicion(ticket.posiciones?.[0])}
                          </div>
                          <div className="col-monto-premio" data-label="Monto">
                            ${ticket.totalMonto.toFixed(2)}
                          </div>
                          <div className="col-pagado" data-label="Pagado">
                            <label className="checkbox-pagado">
                              <input
                                type="checkbox"
                                checked={Boolean(ticket.pagado)}
                                disabled={Boolean(procesandoPagos[obtenerClaveAgrupacionTicket(ticket)])}
                                onChange={() => togglePago(ticket)}
                              />
                              <span>
                                {procesandoPagos[obtenerClaveAgrupacionTicket(ticket)] ? 'Guardando...' : 'Pagado'}
                              </span>
                            </label>
                          </div>
                          <div className="col-premio" data-label="Premio">
                            ${ticket.totalPremio.toFixed(2)}
                          </div>
                          <div className="col-fecha-sorteo" data-label="Fecha">
                            {ticket.fechaSorteo || ticket.fecha}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Historial completo de números jugados - Cuadro separado */}
      <div className="historial-completo-wrapper">
        <div className="historial-completo-container">
          <div className="historial-completo-header">
            <h2 className="historial-title">Historial de Números Jugados</h2>
            <div className="historial-header-controls">
              {loterias.length > 0 && (
                <select
                  value={loteriaFiltroHistorial}
                  onChange={(e) => setLoteriaFiltroHistorial(e.target.value)}
                  className="select-loteria-historial"
                >
                  <option value="">Todas las loterías</option>
                  {loterias.map(loteria => (
                    <option key={loteria.id} value={loteria.id}>
                      {loteria.nombre}
                    </option>
                  ))}
                </select>
              )}
              <select
                value={tipoFiltroHistorial}
                onChange={(e) => setTipoFiltroHistorial(e.target.value)}
                className="select-tipo-historial"
              >
                <option value="">Todos los tipos</option>
                <option value="1">Pick 1 (Singulation)</option>
                <option value="2">Pick 2</option>
                <option value="3">Pick 3</option>
                <option value="4">Pick 4</option>
                <option value="5">Pick 5</option>
                <option value="6">Pick 6</option>
              </select>
              <select
                value={tipoApuestaFiltro}
                onChange={(e) => setTipoApuestaFiltro(e.target.value)}
                className="select-apuesta-historial"
              >
                <option value="">Todas las apuestas</option>
                <option value="straight">Solo Straight</option>
                <option value="box">Solo Box</option>
              </select>
              <select
                value={ordenHistorial}
                onChange={(e) => setOrdenHistorial(e.target.value)}
                className="select-orden-historial"
              >
                <option value="monto">Ordenar por Monto (Mayor a Menor)</option>
                <option value="conteo">Ordenar por Cantidad (Mayor a Menor)</option>
              </select>
              <input
                type="date"
                value={fechaFiltroHistorial}
                onChange={(e) => setFechaFiltroHistorial(e.target.value)}
                className="input-fecha-historial"
                placeholder="Filtrar por fecha"
              />
              <button 
                className="btn-toggle-historial" 
                onClick={() => setMostrarHistorialCompleto(!mostrarHistorialCompleto)}
              >
                {mostrarHistorialCompleto ? 'Ocultar' : 'Mostrar'} Historial
              </button>
            </div>
          </div>
          {mostrarHistorialCompleto && (
            <div className="historial-completo-content">
              {historialCompleto.length === 0 ? (
                <div className="sin-historial">
                  No hay números jugados
                  {loteriaFiltroHistorial ? ' en la lotería seleccionada' : ''}
                  {tipoFiltroHistorial ? ` para Pick ${tipoFiltroHistorial}` : ''}
                  {tipoApuestaFiltro ? ` con tipo ${tipoApuestaFiltro === 'straight' ? 'Straight' : 'Box'}` : ''}
                  {fechaFiltroHistorial ? ` en la fecha ${new Date(fechaFiltroHistorial + 'T00:00:00').toLocaleDateString('es-ES')}` : ''}
                </div>
              ) : (
                <div className="tabla-historial">
                  <div className="historial-resumen-filtros">
                    <span className="contador-resultados">
                      Mostrando {historialCompleto.length} número{historialCompleto.length !== 1 ? 's' : ''}
                      {tipoFiltroHistorial ? ` (Pick ${tipoFiltroHistorial})` : ''}
                      {tipoApuestaFiltro && (
                        <span className="filtro-activo-badge">
                          🔍 Solo {tipoApuestaFiltro === 'straight' ? 'Straight' : 'Box'}
                        </span>
                      )}
                      {fechaFiltroHistorial && (
                        <span className="filtro-activo-badge">
                          📅 {new Date(fechaFiltroHistorial + 'T00:00:00').toLocaleDateString('es-ES')}
                        </span>
                      )}
                      {ordenHistorial === 'monto' ? ' - Ordenado por Monto' : ' - Ordenado por Cantidad'}
                    </span>
                  </div>
                  <div className="tabla-historial-header">
                    <div className="col-numero-hist">Número</div>
                    <div className={`col-straight-hist ${tipoApuestaFiltro === 'box' ? 'col-filtrada' : tipoApuestaFiltro === 'straight' ? 'col-destacada' : ''}`}>
                      Straight
                    </div>
                    <div className={`col-box-hist ${tipoApuestaFiltro === 'straight' ? 'col-filtrada' : tipoApuestaFiltro === 'box' ? 'col-destacada' : ''}`}>
                      Box
                    </div>
                    <div className={`col-bolita1-hist ${tipoApuestaFiltro === 'box' ? 'col-filtrada' : tipoApuestaFiltro === 'straight' ? 'col-destacada' : ''}`}>
                      Bolita 1
                    </div>
                    <div className={`col-bolita2-hist ${tipoApuestaFiltro === 'box' ? 'col-filtrada' : tipoApuestaFiltro === 'straight' ? 'col-destacada' : ''}`}>
                      Bolita 2
                    </div>
                    <div className={`col-singulation-hist ${tipoApuestaFiltro === 'box' ? 'col-filtrada' : tipoApuestaFiltro === 'straight' ? 'col-destacada' : ''}`}>
                      Singulation
                    </div>
                    <div className="col-total-hist">Total</div>
                  </div>
                  <div className="tabla-historial-body">
                    {historialCompleto.map((item, index) => (
                      <div key={`${item.numero}-${index}`} className="fila-historial">
                        <div className="col-numero-hist">
                          <span className="numero-historial">{item.numero}</span>
                          <span className="numero-tipo-badge">Pick {item.longitud}</span>
                        </div>
                        <div className={`col-straight-hist ${tipoApuestaFiltro === 'box' ? 'col-filtrada' : tipoApuestaFiltro === 'straight' ? 'col-destacada' : ''}`}>
                          {item.straight.conteo > 0 && (
                            <div className="stat-item">
                              <span className="stat-count">{item.straight.conteo}</span>
                              <span className="stat-amount">${item.straight.monto.toFixed(2)}</span>
                            </div>
                          )}
                          {item.straight.conteo === 0 && <span className="stat-empty">-</span>}
                        </div>
                        <div className={`col-box-hist ${tipoApuestaFiltro === 'straight' ? 'col-filtrada' : tipoApuestaFiltro === 'box' ? 'col-destacada' : ''}`}>
                          {item.box.conteo > 0 && (
                            <div className="stat-item">
                              <span className="stat-count">{item.box.conteo}</span>
                              <span className="stat-amount">${item.box.monto.toFixed(2)}</span>
                            </div>
                          )}
                          {item.box.conteo === 0 && <span className="stat-empty">-</span>}
                        </div>
                        <div className={`col-bolita1-hist ${tipoApuestaFiltro === 'box' ? 'col-filtrada' : tipoApuestaFiltro === 'straight' ? 'col-destacada' : ''}`}>
                          {item.bolita1.conteo > 0 && (
                            <div className="stat-item">
                              <span className="stat-count">{item.bolita1.conteo}</span>
                              <span className="stat-amount">${item.bolita1.monto.toFixed(2)}</span>
                            </div>
                          )}
                          {item.bolita1.conteo === 0 && <span className="stat-empty">-</span>}
                        </div>
                        <div className={`col-bolita2-hist ${tipoApuestaFiltro === 'box' ? 'col-filtrada' : tipoApuestaFiltro === 'straight' ? 'col-destacada' : ''}`}>
                          {item.bolita2.conteo > 0 && (
                            <div className="stat-item">
                              <span className="stat-count">{item.bolita2.conteo}</span>
                              <span className="stat-amount">${item.bolita2.monto.toFixed(2)}</span>
                            </div>
                          )}
                          {item.bolita2.conteo === 0 && <span className="stat-empty">-</span>}
                        </div>
                        <div className={`col-singulation-hist ${tipoApuestaFiltro === 'box' ? 'col-filtrada' : tipoApuestaFiltro === 'straight' ? 'col-destacada' : ''}`}>
                          {item.singulation.conteo > 0 && (
                            <div className="stat-item">
                              <span className="stat-count">{item.singulation.conteo}</span>
                              <span className="stat-amount">${item.singulation.monto.toFixed(2)}</span>
                            </div>
                          )}
                          {item.singulation.conteo === 0 && <span className="stat-empty">-</span>}
                        </div>
                        <div className="col-total-hist">
                          <div className="stat-item total">
                            <span className="stat-count">{item.total.conteo}</span>
                            <span className="stat-amount">${item.total.monto.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="tabla-historial-footer">
                    <div className="footer-label">Total General:</div>
                    <div className="footer-value">
                      {historialCompleto.reduce((sum, item) => sum + item.total.conteo, 0)} jugadas · 
                      ${historialCompleto.reduce((sum, item) => sum + item.total.monto, 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CalculadoraPremios;
