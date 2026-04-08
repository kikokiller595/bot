import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

import './GeneradorNumeros.css';

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

  const fecha = new Date(fechaStr);
  if (!isNaN(fecha.getTime())) {
    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${año}-${mes}-${dia}`;
  }

  return null;
};

const obtenerFechaActualLocal = () => {
  const ahora = new Date();
  const anio = ahora.getFullYear();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
};

const GeneradorNumeros = ({ guardarSorteo, guardarMultiplesSorteos, loterias = [], sorteos = [] }) => {
  const { user } = useAuth();
  const esAdmin = user?.rol === 'admin';
  const [numero, setNumero] = useState('');
  const [monto, setMonto] = useState('');
  const [loteriasSeleccionadas, setLoteriasSeleccionadas] = useState([]);
  const [historialTemporal, setHistorialTemporal] = useState([]);
  const [ticketAnterior, setTicketAnterior] = useState(null);
  const [impresionAutomatica, setImpresionAutomatica] = useState(() => {
    try {
      return localStorage.getItem('tby_impresion_automatica') === 'true';
    } catch {
      return false;
    }
  });
  const [totalMonto, setTotalMonto] = useState(0);
  const [totalJugadas, setTotalJugadas] = useState(0);
  const inputNumeroRef = useRef(null);
  const inputMontoRef = useRef(null);
  const [horaActual, setHoraActual] = useState(new Date());
  
  // Función para obtener la fecha local en formato YYYY-MM-DD
  const obtenerFechaLocal = () => {
    const ahora = new Date();
    const año = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const dia = String(ahora.getDate()).padStart(2, '0');
    return `${año}-${mes}-${dia}`;
  };
  
  const [fechaSeleccionada, setFechaSeleccionada] = useState(obtenerFechaLocal());

  useEffect(() => {
    if (!esAdmin) {
      const fechaHoy = obtenerFechaActualLocal();
      if (fechaSeleccionada !== fechaHoy) {
        setFechaSeleccionada(fechaHoy);
      }
    }
  }, [esAdmin, fechaSeleccionada]);

  useEffect(() => {
    try {
      localStorage.setItem('tby_impresion_automatica', String(impresionAutomatica));
    } catch {
      // Ignorar errores de almacenamiento local en entornos restringidos.
    }
  }, [impresionAutomatica]);

  // Función para volver al campo de número
  const volverAlNumero = () => {
    setTimeout(() => {
      if (inputNumeroRef.current) {
        inputNumeroRef.current.focus();
      }
    }, 50);
  };

  const seleccionarMontoAlEntrar = () => {
    setTimeout(() => {
      if (inputMontoRef.current) {
        inputMontoRef.current.select();
      }
    }, 0);
  };

  // Actualizar loterías seleccionadas cuando cambie el catálogo
  useEffect(() => {
    if (loterias.length > 0) {
      setLoteriasSeleccionadas(prev => {
        const disponibles = loterias.map(l => l.id.toString());
        const filtradas = prev.filter(id => disponibles.includes(id));
        if (filtradas.length > 0) return filtradas;
        return [disponibles[0]];
      });
    } else {
      setLoteriasSeleccionadas([]);
    }
  }, [loterias]);

  useEffect(() => {
    const timer = setInterval(() => {
      setHoraActual(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setHoraActual(new Date());
  }, [loteriasSeleccionadas]);

  const loteriaEstaCerrada = useCallback((loteria) => {
    if (!loteria || !loteria.horaCierre) return false;

    const horaTexto = loteria.horaCierre.trim();
    if (!horaTexto) return false;

    const match = horaTexto.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return false;

    let horas = parseInt(match[1], 10);
    const minutos = parseInt(match[2], 10);
    const periodo = match[3].toUpperCase();

    if (periodo === 'AM') {
      if (horas === 12) {
        horas = 0;
      }
    } else if (periodo === 'PM') {
      if (horas !== 12) {
        horas += 12;
      }
    }

    const totalMinutosCierre = horas * 60 + minutos;
    const totalMinutosActual = horaActual.getHours() * 60 + horaActual.getMinutes();

    return totalMinutosActual >= totalMinutosCierre;
  }, [horaActual]);

  const loteriasSeleccionadasObjs = useMemo(
    () => loterias.filter(l => loteriasSeleccionadas.includes(l.id.toString())),
    [loteriasSeleccionadas, loterias]
  );

  const loteriasAbiertas = useMemo(
    () => loteriasSeleccionadasObjs.filter(l => !loteriaEstaCerrada(l)),
    [loteriasSeleccionadasObjs, loteriaEstaCerrada]
  );

  const loteriasCerradas = useMemo(
    () => loteriasSeleccionadasObjs.filter(loteriaEstaCerrada),
    [loteriasSeleccionadasObjs, loteriaEstaCerrada]
  );

  const noHaySeleccion = loteriasSeleccionadasObjs.length === 0;
  const todasCerradas = !noHaySeleccion && loteriasAbiertas.length === 0;
  const deshabilitarAcciones = noHaySeleccion || todasCerradas;
  const multiplicadorResumen = loteriasAbiertas.length > 0 ? loteriasAbiertas.length : 1;
  const montoTotalConLoterias = totalMonto * multiplicadorResumen;
  const jugadasConLoterias = totalJugadas * multiplicadorResumen;

  const obtenerEtiquetaTipo = (tipo = '') => {
    const valor = tipo.toLowerCase();
    if (valor === 'bolita1') return 'Bolita 1';
    if (valor === 'bolita2') return 'Bolita 2';
    if (valor === 'singulation') return 'Singulation';
    if (valor === 'box') return 'Box';
    if (valor === 'straight') return 'Straight';
    return tipo;
  };

  const validarFechaPermitida = useCallback(() => {
    if (!fechaSeleccionada) {
      alert('Selecciona una fecha valida para el ticket.');
      return false;
    }

    if (!esAdmin) {
      const fechaHoy = obtenerFechaActualLocal();
      if (fechaSeleccionada !== fechaHoy) {
        setFechaSeleccionada(fechaHoy);
        alert('El punto de venta solo puede registrar tickets con la fecha de hoy.');
        return false;
      }
    }

    return true;
  }, [esAdmin, fechaSeleccionada]);

  const numeroBaseActual = useMemo(() => numero.trim().replace(/[^0-9]/g, ''), [numero]);

  const estadisticasNumero = useMemo(() => {
    if (!numeroBaseActual || loteriasSeleccionadas.length === 0) return null;

    const seleccionadas = new Set(loteriasSeleccionadas.map(String));
    let totalConteo = 0;
    let totalMonto = 0;
    const detalle = {};

    // Obtener la clave de fecha seleccionada (formato YYYY-MM-DD)
    const fechaFiltro = fechaSeleccionada ? obtenerClaveFecha(fechaSeleccionada) : null;

    sorteos.forEach(ticket => {
      const numeroTicket = String(ticket.numero || '').trim();
      if (numeroTicket !== numeroBaseActual) return;
      if (!ticket.loteriaId || !seleccionadas.has(String(ticket.loteriaId))) return;

      // Filtrar por fecha si hay una fecha seleccionada
      if (fechaFiltro) {
        const claveTicket = obtenerClaveFecha(ticket.fecha);
        if (claveTicket !== fechaFiltro) {
          return; // Saltar tickets que no son de la fecha seleccionada
        }
      }

      const tipo = (ticket.tipoApuesta || ticket.tipo || 'straight').toLowerCase();
      const montoTicket = parseFloat(ticket.monto) || 0;

      if (!detalle[tipo]) {
        detalle[tipo] = { conteo: 0, monto: 0 };
      }

      detalle[tipo].conteo += 1;
      detalle[tipo].monto += montoTicket;

      totalConteo += 1;
      totalMonto += montoTicket;
    });

    if (totalConteo === 0) return null;

    return {
      numero: numeroBaseActual,
      totalConteo,
      totalMonto,
      detalle
    };
  }, [numeroBaseActual, sorteos, loteriasSeleccionadas, fechaSeleccionada]);

  // Función para generar todas las permutaciones únicas de un número
  const generarPermutaciones = (num) => {
    try {
      if (!num || num.toString().length === 0) return [];
      const str = num.toString();
      if (str.length === 1) return [str];
      if (str.length > 10) {
        return [str];
      }
      
      const permutaciones = new Set();
      
      const permutar = (arr, inicio = 0) => {
        if (inicio === arr.length - 1) {
          permutaciones.add(arr.join(''));
          return;
        }
        
        const usado = new Set();
        for (let i = inicio; i < arr.length; i++) {
          if (usado.has(arr[i])) continue;
          usado.add(arr[i]);
          
          [arr[inicio], arr[i]] = [arr[i], arr[inicio]];
          permutar([...arr], inicio + 1);
          [arr[inicio], arr[i]] = [arr[i], arr[inicio]];
        }
      };
      
      permutar(str.split(''));
      return Array.from(permutaciones);
    } catch (error) {
      console.error('Error al generar permutaciones:', error);
      return [];
    }
  };

  const escaparHtml = (valor) => String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const imprimirTicket = useCallback((ticket) => {
    if (!ticket) return;

    const ventana = window.open('', '_blank', 'width=420,height=720');
    if (!ventana) {
      alert('No se pudo abrir la ventana de impresion. Revisa si el navegador esta bloqueando ventanas emergentes.');
      return;
    }

    const detalleJugadas = (ticket.tickets || []).map((item) => `
      <tr>
        <td>${escaparHtml(item.loteriaNombre || 'Sin loteria')}</td>
        <td>${escaparHtml(item.numero)}</td>
        <td>${escaparHtml(obtenerEtiquetaTipo(item.tipoApuesta || item.tipo))}</td>
        <td>$${Number(item.monto || 0).toFixed(2)}</td>
      </tr>
    `).join('');

    const loteriasTexto = Array.isArray(ticket.loterias) && ticket.loterias.length > 0
      ? ticket.loterias.join(', ')
      : 'Sin loterias';

    ventana.document.write(`
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="UTF-8" />
          <title>Ticket ${escaparHtml(ticket.ticketId)}</title>
          <style>
            body {
              font-family: "Segoe UI", Arial, sans-serif;
              margin: 0;
              padding: 16px;
              color: #111827;
              background: #ffffff;
            }
            .ticket {
              max-width: 360px;
              margin: 0 auto;
              border: 1px dashed #9ca3af;
              border-radius: 12px;
              padding: 16px;
            }
            .encabezado {
              text-align: center;
              margin-bottom: 12px;
            }
            .encabezado h1 {
              font-size: 22px;
              margin: 0 0 4px;
            }
            .encabezado p {
              margin: 2px 0;
              font-size: 13px;
            }
            .meta {
              background: #f3f4f6;
              border-radius: 10px;
              padding: 10px 12px;
              margin-bottom: 12px;
              font-size: 13px;
            }
            .meta strong {
              display: inline-block;
              min-width: 72px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 13px;
            }
            th, td {
              padding: 8px 4px;
              border-bottom: 1px solid #e5e7eb;
              text-align: left;
            }
            th {
              font-size: 12px;
              text-transform: uppercase;
              color: #4b5563;
            }
            .totales {
              margin-top: 12px;
              padding-top: 12px;
              border-top: 2px solid #111827;
              font-size: 14px;
            }
            .totales div {
              display: flex;
              justify-content: space-between;
              margin-bottom: 6px;
            }
            .pie {
              margin-top: 16px;
              text-align: center;
              font-size: 12px;
              color: #6b7280;
            }
            @media print {
              body {
                padding: 0;
              }
              .ticket {
                border: none;
                border-radius: 0;
                padding: 8px;
              }
            }
          </style>
        </head>
        <body>
          <div class="ticket">
            <div class="encabezado">
              <h1>TBY Sistemas</h1>
              <p>Ticket de venta</p>
            </div>

            <div class="meta">
              <div><strong>Ticket:</strong> ${escaparHtml(ticket.ticketId)}</div>
              <div><strong>Fecha:</strong> ${escaparHtml(ticket.fecha)}</div>
              <div><strong>Loterias:</strong> ${escaparHtml(loteriasTexto)}</div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Loteria</th>
                  <th>Numero</th>
                  <th>Tipo</th>
                  <th>Monto</th>
                </tr>
              </thead>
              <tbody>
                ${detalleJugadas}
              </tbody>
            </table>

            <div class="totales">
              <div><span>Jugadas</span><strong>${Number(ticket.jugadas || 0)}</strong></div>
              <div><span>Total</span><strong>$${Number(ticket.montoTotal || 0).toFixed(2)}</strong></div>
            </div>

            <div class="pie">
              Gracias por su compra
            </div>
          </div>
          <script>
            window.onload = function () {
              window.print();
              window.onafterprint = function () { window.close(); };
            };
          </script>
        </body>
      </html>
    `);
    ventana.document.close();
  }, []);

  const agregarAlHistorial = () => {
    if (!numero.trim()) {
      alert('Por favor ingresa un número');
      return;
    }

    if (noHaySeleccion) {
      alert('Selecciona al menos una lotería para registrar la jugada.');
      return;
    }

    if (!validarFechaPermitida()) {
      return;
    }

    if (todasCerradas) {
      alert('Todas las loterías seleccionadas están cerradas. Podrás ingresar números nuevamente mañana.');
      return;
    }

    const numeroInput = numero.trim().toLowerCase();
    const bolitaMatch = numeroInput.match(/^(\d{2})\+(1|2)$/);
    const esBox = numeroInput.endsWith('+');
    const generarCombinaciones = numeroInput.endsWith('q');
    
    // Caso especial: Bolita (formato NN+1 o NN+2)
    if (bolitaMatch) {
      const numeroBolita = bolitaMatch[1];
      const posicionBolita = bolitaMatch[2];
      const montoBolita = monto.trim() ? parseFloat(monto) || 1 : 1;

      setHistorialTemporal(prev => [
        ...prev,
        {
          id: Date.now(),
          numero: numeroBolita,
          monto: montoBolita,
          tipo: posicionBolita === '1' ? 'Bolita1' : 'Bolita2'
        }
      ]);

      setTotalMonto(prev => prev + montoBolita);
      setTotalJugadas(prev => prev + 1);

      setNumero('');
      volverAlNumero();
      return;
    }

    const numeroLimpio = numeroInput.replace(/[^0-9]/g, '');
    
    if (numeroLimpio.length < 1) {
      alert('El número debe tener al menos 1 dígito');
      return;
    }

    const esSingulation = numeroLimpio.length === 1;

    if (numeroLimpio.length === 2) {
      if (esBox || generarCombinaciones) {
        alert('Los números de 2 dígitos (Pick 2) solo admiten apuestas Straight.');
        return;
      }
      if (monto.includes('+')) {
        alert('Los números de 2 dígitos (Pick 2) no permiten dividir monto en Straight/Box.');
        return;
      }
    }

    // Determinar monto por jugada
    const montoNum = (() => {
      const montoTexto = monto.trim();
      if (generarCombinaciones) {
        const valor = parseFloat(montoTexto);
        return valor > 0 ? valor : 1;
      }
      return montoTexto ? parseFloat(montoTexto) || 1 : 1;
    })();

    // Caso especial: Singulation (1 dígito)
    if (esSingulation) {
      setHistorialTemporal(prev => [
        ...prev,
        {
          id: Date.now(),
          numero: numeroLimpio,
          monto: montoNum,
          tipo: 'Singulation'
        }
      ]);

      setTotalMonto(prev => prev + montoNum);
      setTotalJugadas(prev => prev + 1);

      setNumero('');
      volverAlNumero();
      return;
    }

    // Caso 1: Generar todas las combinaciones (termina en q)
    if (generarCombinaciones) {
      const combinaciones = generarPermutaciones(numeroLimpio);
      if (combinaciones.length === 0) {
        alert('No se pudieron generar combinaciones');
        return;
      }

      combinaciones.forEach((combinacion, index) => {
        setHistorialTemporal(prev => [
          ...prev,
          {
            id: Date.now() + index,
            numero: combinacion,
            monto: montoNum,
            tipo: 'Straight'
          }
        ]);
      });

      setTotalMonto(prev => prev + (montoNum * combinaciones.length));
      setTotalJugadas(prev => prev + combinaciones.length);
      
      // Limpiar solo el campo de número, mantener el monto
      setNumero('');
      // Volver al campo de número
      volverAlNumero();
      return; // Salir aquí
    }
    // Caso 2: Box (termina en +)
    else if (esBox) {
      setHistorialTemporal(prev => [
        ...prev,
        {
          id: Date.now(),
          numero: numeroLimpio,
          monto: montoNum,
          tipo: 'Box'
        }
      ]);

      setTotalMonto(prev => prev + montoNum);
      setTotalJugadas(prev => prev + 1);
      
      // Limpiar solo el campo de número, mantener el monto
      setNumero('');
      // Volver al campo de número
      volverAlNumero();
      return; // Salir aquí
    }
    // Caso 3: Verificar si el monto es formato doble (número+número o decimal+decimal)
    else if (monto.includes('+') && monto.split('+').length === 2) {
      const partes = monto.split('+');
      const parte1 = partes[0].trim();
      const parte2 = partes[1].trim();
      
      // Verificar que ambas partes sean números válidos (enteros o decimales)
      const esNumero1 = /^\d+(\.\d+)?$/.test(parte1);
      const esNumero2 = /^\d+(\.\d+)?$/.test(parte2);
      
      if (esNumero1 && esNumero2) {
        const montos = [parseFloat(parte1) || 0, parseFloat(parte2) || 0];
        const montoStraight = montos[0];
        const montoBox = montos[1];

        // Agregar dos entradas al historial
        setHistorialTemporal(prev => [
          ...prev,
          {
            id: Date.now(),
            numero: numeroLimpio,
            monto: montoStraight,
            tipo: 'Straight'
          },
          {
            id: Date.now() + 1,
            numero: numeroLimpio,
            monto: montoBox,
            tipo: 'Box'
          }
        ]);

        setTotalMonto(prev => prev + montoStraight + montoBox);
        setTotalJugadas(prev => prev + 2);
        
        // Limpiar solo el campo de número, mantener el monto
        setNumero('');
        // Volver al campo de número
        volverAlNumero();
        return; // Salir aquí para no ejecutar el caso 4
      }
    }
    
    // Caso 4: Straight normal
    else {
      setHistorialTemporal(prev => [
        ...prev,
        {
          id: Date.now(),
          numero: numeroLimpio,
          monto: montoNum,
          tipo: 'Straight'
        }
      ]);

      setTotalMonto(prev => prev + montoNum);
      setTotalJugadas(prev => prev + 1);
    }

    // Limpiar solo el campo de número, mantener el monto
    setNumero('');
    // Volver al campo de número
    volverAlNumero();
  };

  const eliminarDelHistorial = (id) => {
    const item = historialTemporal.find(h => h.id === id);
    if (item) {
      setTotalMonto(prev => prev - item.monto);
      setTotalJugadas(prev => prev - 1);
    }
    setHistorialTemporal(prev => prev.filter(h => h.id !== id));
  };

  const generarTicket = () => {
    if (noHaySeleccion) {
      alert('Selecciona al menos una lotería para generar el ticket.');
      return;
    }

    if (todasCerradas) {
      alert('Todas las loterías seleccionadas están cerradas. Podrás generar tickets nuevamente mañana.');
      return;
    }

    if (!validarFechaPermitida()) {
      return;
    }

    if (historialTemporal.length === 0) {
      alert('No hay números en el historial. Agrega números primero.');
      return;
    }

    const timestampBase = Date.now();
    let fechaTicketDate = null;
    try {
      const horaActualCadena = new Date().toTimeString().split(' ')[0];
      fechaTicketDate = new Date(`${fechaSeleccionada}T${horaActualCadena}`);
      if (isNaN(fechaTicketDate.getTime())) {
        fechaTicketDate = new Date();
      }
    } catch {
      fechaTicketDate = new Date();
    }
    const fechaTicket = fechaTicketDate.toLocaleString('es-ES');
    let correlativo = 0;

    const tickets = [];

    loteriasAbiertas.forEach(loteria => {
      historialTemporal.forEach(item => {
        const idTicket = timestampBase + correlativo;
        correlativo += 1;

        tickets.push({
          id: idTicket,
          numero: item.numero,
          monto: item.monto,
          tipoApuesta: item.tipo.toLowerCase(),
          fecha: fechaTicket,
          ticketId: `TKT-${idTicket.toString().slice(-6)}`,
          grupoId: timestampBase,
          loteriaId: loteria.id,
          loteriaNombre: loteria.nombre
        });
      });
    });

    if (tickets.length === 0) {
      alert('No se pudieron generar tickets porque todas las loterías seleccionadas están cerradas.');
      return;
    }

    // Si hay función para guardar múltiples, usarla (más eficiente)
    if (guardarMultiplesSorteos) {
      guardarMultiplesSorteos(tickets);
    } else {
      // Fallback: guardar uno por uno
      tickets.forEach((ticket) => {
        guardarSorteo(
          {
            tipo: 'ticket',
            tipoApuesta: ticket.tipoApuesta,
            monto: ticket.monto
          },
          [ticket.numero],
          ticket
        );
      });
    }

    // Crear ticket consolidado
    const ticketId = Date.now().toString();
    const nuevoTicket = {
      id: ticketId,
      ticketId: ticketId,
      fecha: fechaTicket,
      montoTotal: montoTotalConLoterias,
      jugadas: jugadasConLoterias,
      tickets: tickets,
      loterias: loteriasAbiertas.map(l => l.nombre)
    };

    setTicketAnterior(nuevoTicket);

    if (impresionAutomatica) {
      imprimirTicket(nuevoTicket);
    }

    // Limpiar todo
    setHistorialTemporal([]);
    setTotalMonto(0);
    setTotalJugadas(0);
    setNumero('');
    setMonto('');
  };

  const handleNumeroChange = (e) => {
    let valor = e.target.value.toLowerCase();
    // Permitir números, + y q
    valor = valor.replace(/[^0-9+q]/gi, '');
    
    const tieneMas = valor.includes('+');
    const tieneQ = valor.includes('q');
    const esBolitaParcial = /^\d{0,2}(\+([12]?))?$/.test(valor);
    
    // Si tiene q y +, q tiene prioridad solo si está al final
    if (tieneMas && tieneQ) {
      if (valor.endsWith('q')) {
        valor = valor.replace(/\+/g, '');
      } else if (valor.endsWith('+')) {
        valor = valor.replace(/q/g, '');
      }
    }
    
    // Si tiene + y no está al final, moverlo al final (para Box)
    if (tieneMas && !valor.endsWith('+') && !esBolitaParcial) {
      valor = valor.replace(/\+/g, '') + '+';
    }
    
    // Si tiene q y no está al final, moverla al final
    if (tieneQ && !valor.endsWith('q')) {
      valor = valor.replace(/q/g, '') + 'q';
    }

    // Normalizar entrada parcial de bolita (NN+1 / NN+2)
    if (esBolitaParcial) {
      const partes = valor.split('+');
      let base = partes[0] || '';
      base = base.slice(0, 2);
      let sufijo = partes.length > 1 ? partes[1] : '';
      if (sufijo.length > 1) {
        sufijo = sufijo.slice(0, 1);
      }
      sufijo = sufijo.replace(/[^12]/g, '');
      valor = partes.length > 1 ? `${base}+${sufijo}` : base;
    }
    
    // Limitar longitud
    if (valor.length > 6) {
      valor = valor.slice(0, 6);
    }
    
    setNumero(valor);
  };

  const handleKeyPressNumero = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (numero.trim()) {
        inputMontoRef.current?.focus();
      }
    } else if (e.key === '*') {
      e.preventDefault();
      generarTicket();
    }
  };

  const handleKeyPressMonto = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      agregarAlHistorial();
    } else if (e.key === '*') {
      e.preventDefault();
      generarTicket();
    }
  };

  const limpiarTodo = () => {
    if (window.confirm('¿Limpiar todo el historial temporal?')) {
      setHistorialTemporal([]);
      setTotalMonto(0);
      setTotalJugadas(0);
      setNumero('');
      setMonto('');
    }
  };

  const numeroActual = numero.toLowerCase();
  const bolitaIndicadorParcial = /^\d{1,2}\+([12]?)$/.test(numeroActual);
  const bolitaIndicadorCompleto = numeroActual.match(/^(\d{2})\+(1|2)$/);
  const singulationIndicador = /^\d$/.test(numeroActual);
  const esSingulationIndicador = /^\d$/.test(numeroActual);

  return (
    <div className="generador-container">
      <div className="generador-card">
        <h2 className="card-title">Generar Ticket</h2>

        <div className="ticket-form-simple">
          <div className="impresion-config">
            <label className="impresion-toggle">
              <input
                type="checkbox"
                checked={impresionAutomatica}
                onChange={(e) => setImpresionAutomatica(e.target.checked)}
              />
              <span>Impresion automatica al generar ticket</span>
            </label>
            <span className="impresion-estado">
              {impresionAutomatica ? 'Activada' : 'Desactivada'}
            </span>
          </div>

          {noHaySeleccion && (
            <div className="loteria-info-aviso">
              Selecciona al menos una lotería para registrar tus jugadas.
            </div>
          )}
          {todasCerradas && (
            <div className="loteria-cerrada-aviso">
              Todas las loterías seleccionadas están cerradas desde sus horarios de corte. Podrás continuar mañana.
            </div>
          )}
          {!todasCerradas && loteriasCerradas.length > 0 && (
            <div className="loteria-parcial-aviso">
              Loterías cerradas: {loteriasCerradas.map(l => l.nombre).join(', ')}.
            </div>
          )}
          {/* Área de entrada */}
          <div className="area-entrada">
            <div className="campo-fecha">
              <label>Fecha del Ticket</label>
              <input
                type="date"
                value={fechaSeleccionada}
                onChange={(e) => setFechaSeleccionada(e.target.value)}
                className="input-fecha-ticket"
                disabled={!esAdmin}
              />
              <small className="campo-fecha-ayuda">
                {esAdmin
                  ? 'Administrador: puedes registrar tickets para cualquier fecha.'
                  : 'Punto de venta: solo puedes registrar tickets con la fecha de hoy.'}
              </small>
            </div>

            {loterias.length > 0 && (
              <div className="campo-loteria">
                <label>Loterías</label>
                <div className="lista-loterias">
                  {loterias.map(loteria => {
                    const idStr = loteria.id.toString();
                    const seleccionada = loteriasSeleccionadas.includes(idStr);
                    const cerrada = loteriaEstaCerrada(loteria);
                    return (
                      <label
                        key={loteria.id}
                        className={`loteria-opcion ${cerrada ? 'cerrada' : ''}`}
                      >
                        <input
                          type="checkbox"
                          value={idStr}
                          checked={seleccionada}
                          onChange={(e) => {
                            const value = e.target.value;
                            setLoteriasSeleccionadas(prev => {
                              if (prev.includes(value)) {
                                const actualizadas = prev.filter(id => id !== value);
                                return actualizadas.length > 0 ? actualizadas : [];
                              }
                              return [...prev, value];
                            });
                          }}
                        />
                        <span>{loteria.nombre}</span>
                        {cerrada && (
                          <span className="etiqueta-cerrada">Cerrada</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="campo-numero">
              <label>Número</label>
              <input
                ref={inputNumeroRef}
                type="text"
                value={numero}
                onChange={handleNumeroChange}
                onKeyPress={handleKeyPressNumero}
                placeholder="Ej: 1234, 1234+, 1234q, 22+1, 7"
                className="input-numero-grande"
                maxLength="6"
                autoFocus
                disabled={deshabilitarAcciones}
              />
              <small>
                {esSingulationIndicador ? (
                  <span className="tipo-indicador singulation">Singulation (1 dígito)</span>
                ) : bolitaIndicadorCompleto ? (
                  <span className="tipo-indicador bolita">
                    {bolitaIndicadorCompleto[2] === '1' ? 'Bolita 1' : 'Bolita 2'}
                  </span>
                ) : bolitaIndicadorParcial ? (
                  <span className="tipo-indicador bolita">Bolita (NN+1 / NN+2)</span>
                ) : numeroActual.endsWith('q') ? (
                  <span className="tipo-indicador combinaciones">Todas las combinaciones</span>
                ) : numeroActual.endsWith('+') ? (
                  <span className="tipo-indicador box">Box - Cualquier orden</span>
                ) : (
                  <span className="tipo-indicador straight">Straight - Orden exacto</span>
                )}
              </small>
              {estadisticasNumero && (
                <div className="numero-stats">
                  <div className="numero-stats-title">
                    Historial en las loterías seleccionadas
                  </div>
                  <div className="numero-stats-body">
                    {['straight', 'box', 'bolita1', 'bolita2', 'singulation'].map(tipo => {
                      const datos = estadisticasNumero.detalle[tipo];
                      if (!datos) return null;
                      return (
                        <span key={tipo} className="numero-stats-chip">
                          {obtenerEtiquetaTipo(tipo)}: <strong>{datos.conteo}</strong> jug.{' '}
                          <span className="chip-monto">${datos.monto.toFixed(2)}</span>
                        </span>
                      );
                    })}
                  </div>
                  <div className="numero-stats-total">
                    Total: {estadisticasNumero.totalConteo} jugadas · ${estadisticasNumero.totalMonto.toFixed(2)}
                  </div>
                </div>
              )}
            </div>

            <div className="campo-monto">
              <label>Monto</label>
              <input
                ref={inputMontoRef}
                type="text"
                value={monto}
                 onChange={(e) => setMonto(e.target.value)}
                 onFocus={seleccionarMontoAlEntrar}
                onKeyPress={handleKeyPressMonto}
                placeholder="Ej: 1.00 o 5+5"
                className="input-monto-grande"
              />
              <small>Enter para agregar | * para generar</small>
            </div>
          </div>

          {/* Ticket anterior */}
          {ticketAnterior && (
            <div className="ticket-anterior">
              <div className="ticket-anterior-content">
                <span className="ticket-id">{ticketAnterior.ticketId}</span>
                <span className="ticket-monto">$ {ticketAnterior.montoTotal.toFixed(2)}</span>
                {ticketAnterior.loterias && ticketAnterior.loterias.length > 0 && (
                  <span className="ticket-loterias">
                    {ticketAnterior.loterias.join(', ')}
                  </span>
                )}
                <button
                  className="btn-ticket-print"
                  onClick={() => imprimirTicket(ticketAnterior)}
                >
                  Imprimir ticket
                </button>
                <button className="btn-icon" onClick={() => setTicketAnterior(null)}>🗑️</button>
              </div>
            </div>
          )}

          {/* Mini historial */}
          <div className="mini-historial">
            <div className="mini-historial-header">
              <h3>Números Ingresados</h3>
              <button className="btn-limpiar-mini" onClick={limpiarTodo}>Limpiar</button>
            </div>
            <div className="mini-historial-content">
              {historialTemporal.length === 0 ? (
                <div className="sin-numeros">No hay números ingresados aún</div>
              ) : (
                <div className="lista-numeros">
                  {historialTemporal.map(item => (
                    <div key={item.id} className="item-numero">
                      <span className="numero-item">{item.numero}</span>
                       <span className="tipo-item">{obtenerEtiquetaTipo(item.tipo)}</span>
                      <span className="monto-item">${item.monto.toFixed(2)}</span>
                      <button 
                        className="btn-eliminar-item" 
                        onClick={() => eliminarDelHistorial(item.id)}
                        title="Eliminar"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Resumen */}
          <div className="resumen-area">
            <div className="resumen-item">
              <label>Monto Total:</label>
              <input type="text" value={`$${montoTotalConLoterias.toFixed(2)}`} readOnly className="input-resumen" />
            </div>
            <div className="resumen-item">
              <label>Jugadas:</label>
              <input type="text" value={jugadasConLoterias} readOnly className="input-resumen" />
            </div>
            <div className="resumen-item">
              <label>Pago:</label>
              <input type="text" value={`$${montoTotalConLoterias.toFixed(2)}`} readOnly className="input-resumen" />
            </div>
          </div>

          {/* Botones */}
          <div className="button-group">
            <button
              className="btn btn-primary btn-large"
              onClick={generarTicket}
            disabled={historialTemporal.length === 0 || deshabilitarAcciones}
            >
              Generar Ticket (*)
            </button>
            <button
              className="btn btn-secondary"
              onClick={agregarAlHistorial}
            disabled={!numero.trim() || !monto.trim() || deshabilitarAcciones}
            >
              Agregar (Enter)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeneradorNumeros;
