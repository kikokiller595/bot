import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import Header from './components/Header';
import DashboardOperativo from './components/DashboardOperativo';
import GeneradorNumeros from './components/GeneradorNumeros';
import HistorialSorteos from './components/HistorialSorteos';
import ReporteVenta from './components/ReporteVenta';
import PanelAdministracion from './components/PanelAdministracion';
import CalculadoraPremios from './components/CalculadoraPremios';
import NumerosGanadores from './components/NumerosGanadores';
import RecogidaSocios from './components/RecogidaSocios';
import { normalizarPremios } from './utils/premiosDefault';
import { obtenerClaveFecha } from './utils/dateParser';
import { useAuth } from './context/AuthContext';
import sorteosService from './services/sorteosService';
import loteriasService from './services/loteriasService';
import puntosVentaService from './services/puntosVentaService';

function App() {
  const { user } = useAuth();
  const [sorteos, setSorteos] = useState([]);
  const [loterias, setLoterias] = useState([]);
  const [puntosVenta, setPuntosVenta] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [panelActivo, setPanelActivo] = useState('venta');
  const [menuRapidoAbierto, setMenuRapidoAbierto] = useState(false);
  const menuRapidoRef = useRef(null);
  const [periodoBoard, setPeriodoBoard] = useState('hoy'); // 'hoy' | 'semana' | 'personalizado'
  const [boardDesde, setBoardDesde] = useState('');
  const [boardHasta, setBoardHasta] = useState('');


  const formatearMoneda = (valor = 0) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(Number(valor) || 0);

  const panelesAdmin = [
    {
      id: 'venta',
      label: 'Punto de venta',
      code: '01',
      summary: 'Registra jugadas y emite tickets desde la vista de administrador.'
    },
    {
      id: 'historial',
      label: 'Historial de tickets',
      code: '02',
      summary: 'Consulta tickets guardados, revisa detalles y administra historial.'
    },
    {
      id: 'reportes',
      label: 'Reportes',
      code: '03',
      summary: 'Analiza ventas, resultados y movimiento por fechas y por punto.'
    },
    {
      id: 'premios',
      label: 'Premios',
      code: '04',
      summary: 'Consulta ganadores, pagos y balances de premios.'
    },
    {
      id: 'recogida',
      label: 'Recogida',
      code: '05',
      summary: 'Control semanal de cobros y recogida de dinero por punto de venta.'
    },
    {
      id: 'administracion',
      label: 'Configuracion',
      code: '06',
      summary: 'Loterias, usuarios, puntos de venta y resultados.'
    },
    {
      id: 'resumen',
      label: 'Pulso general',
      code: '07',
      summary: 'Ventas del dia, actividad y panorama de toda la red.'
    }
  ];

  const panelesSupervisor = [
    {
      id: 'venta',
      label: 'Punto de venta',
      code: '01',
      summary: 'Registra jugadas para cualquier terminal de la red.'
    },
    {
      id: 'historial',
      label: 'Historial de tickets',
      code: '02',
      summary: 'Consulta tickets de toda la red de puntos de venta.'
    },
    {
      id: 'reportes',
      label: 'Reportes',
      code: '03',
      summary: 'Analiza ventas y resultados de toda la red.'
    },
    {
      id: 'premios',
      label: 'Premios',
      code: '04',
      summary: 'Consulta ganadores y balances de premios.'
    },
    {
      id: 'ganadores',
      label: 'Numeros ganadores',
      code: '05',
      summary: 'Consulta los resultados cargados para cada loteria.'
    }
  ];

  const panelesPuntoVenta = [
    {
      id: 'venta',
      label: 'Punto de venta',
      code: '01',
      summary: 'Terminal dedicada para registrar jugadas y emitir tickets del local.'
    },
    {
      id: 'historial',
      label: 'Historial de tickets',
      code: '02',
      summary: 'Consulta y revisa los tickets registrados desde el punto de venta.'
    },
    {
      id: 'reportes',
      label: 'Reportes',
      code: '03',
      summary: 'Revisa ventas, montos y resultados operativos del punto de venta.'
    },
    {
      id: 'ganadores',
      label: 'Numeros ganadores',
      code: '04',
      summary: 'Consulta los resultados cargados para cada loteria.'
    }
  ];

  const fechaPanel = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(new Date());

  const hoyClave = obtenerClaveFecha(new Date());
  const sorteosHoy = sorteos.filter(
    (sorteo) => obtenerClaveFecha(sorteo.fechaISO || sorteo.fecha) === hoyClave
  );
  const ventaHoy = sorteosHoy.reduce(
    (total, sorteo) => total + (Number(sorteo.monto) || 0),
    0
  );
  const ventaAcumulada = sorteos.reduce(
    (total, sorteo) => total + (Number(sorteo.monto) || 0),
    0
  );
  const ticketsTotales = new Set(
    sorteos
      .map((sorteo) => String(sorteo.ticketId || sorteo.grupoId || sorteo.id || ''))
      .filter(Boolean)
  ).size;

  // ── Rango del board (Hoy / Semana lunes-domingo / Personalizado) ──
  const obtenerRangoBoard = () => {
    if (periodoBoard === 'semana') {
      const hoy = new Date();
      const dia = hoy.getDay(); // 0=domingo, 1=lunes...
      const diffLunes = dia === 0 ? -6 : 1 - dia;
      const lunes = new Date(hoy);
      lunes.setDate(hoy.getDate() + diffLunes);
      const domingo = new Date(lunes);
      domingo.setDate(lunes.getDate() + 6);
      return { desde: obtenerClaveFecha(lunes), hasta: obtenerClaveFecha(domingo) };
    }
    if (periodoBoard === 'personalizado') {
      return { desde: boardDesde || null, hasta: boardHasta || null };
    }
    return { desde: hoyClave, hasta: hoyClave };
  };
  const rangoBoard = obtenerRangoBoard();

  const sorteosPeriodo = sorteos.filter((sorteo) => {
    const clave = obtenerClaveFecha(sorteo.fechaISO || sorteo.fecha);
    if (!clave) return false;
    if (rangoBoard.desde && clave < rangoBoard.desde) return false;
    if (rangoBoard.hasta && clave > rangoBoard.hasta) return false;
    return true;
  });
  const ventaPeriodo = sorteosPeriodo.reduce(
    (total, sorteo) => total + (Number(sorteo.monto) || 0),
    0
  );
  const premiosPeriodo = sorteosPeriodo
    .filter((s) => s.ganador === true)
    .reduce((total, s) => total + (Number(s.premio) || 0), 0);
  const ticketsPeriodo = new Set(
    sorteosPeriodo
      .map((sorteo) => String(sorteo.ticketId || sorteo.grupoId || sorteo.id || ''))
      .filter(Boolean)
  ).size;

  const formatearFechaCorta = (clave) => {
    if (!clave) return '';
    const partes = String(clave).split('-');
    if (partes.length !== 3) return clave;
    const fecha = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
    if (Number.isNaN(fecha.getTime())) return clave;
    return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(fecha);
  };

  let rangoBoardLabel;
  if (periodoBoard === 'hoy') {
    rangoBoardLabel = fechaPanel;
  } else if (rangoBoard.desde && rangoBoard.hasta) {
    rangoBoardLabel = `${formatearFechaCorta(rangoBoard.desde)} — ${formatearFechaCorta(rangoBoard.hasta)}`;
  } else {
    rangoBoardLabel = 'Selecciona las fechas';
  }

  const labelVentaPeriodo =
    periodoBoard === 'hoy' ? 'Venta del dia' : periodoBoard === 'semana' ? 'Venta de la semana' : 'Venta del periodo';
  const puntosActivos = new Set(
    sorteos.map((sorteo) => String(sorteo.puntoVentaNombre || '').trim()).filter(Boolean)
  ).size;

  const normalizarHoraCierre = (valor) => {
    if (!valor) return '';
    const limpio = String(valor).trim();
    const match12 = limpio.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match12) {
      const hora = Math.min(Math.max(parseInt(match12[1], 10), 1), 12);
      return `${String(hora).padStart(2, '0')}:${match12[2]} ${match12[3].toUpperCase()}`;
    }

    const match24 = limpio.match(/^(\d{1,2}):(\d{2})$/);
    if (match24) {
      let hora = parseInt(match24[1], 10);
      const minuto = match24[2];
      const periodo = hora >= 12 ? 'PM' : 'AM';
      hora = hora % 12;
      if (hora === 0) hora = 12;
      return `${String(hora).padStart(2, '0')}:${minuto} ${periodo}`;
    }

    return limpio;
  };

  const normalizarListaLoterias = (lista = []) => {
    if (!Array.isArray(lista)) return [];
    return lista.map(loteria => ({
      ...loteria,
      premios: normalizarPremios(loteria?.premios),
      horaCierre: normalizarHoraCierre(loteria?.horaCierre)
    }));
  };

  const actualizarLoterias = (nuevasLoterias) => {
    if (typeof nuevasLoterias === 'function') {
      setLoterias(prev => normalizarListaLoterias(nuevasLoterias(prev)));
    } else {
      setLoterias(normalizarListaLoterias(nuevasLoterias));
    }
  };

  // Cargar datos desde el servidor al iniciar
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Cargar loterías desde el servidor
        const [loteriasData, sorteosData, puntosVentaData] = await Promise.all([
          loteriasService.obtenerLoterias(),
          sorteosService.obtenerSorteos(),
          (user?.rol === 'admin' || user?.rol === 'supervisor')
            ? puntosVentaService.getPuntosVenta()
            : puntosVentaService.getMiPuntoVenta().then((data) => (data ? [data] : []))
        ]);
        setLoterias(normalizarListaLoterias(loteriasData));
        setSorteos(sorteosData);
        setPuntosVenta(Array.isArray(puntosVentaData) ? puntosVentaData : []);
        
      } catch (error) {
        console.error('Error al cargar datos:', error);
        setError('Error al cargar los datos. Por favor, recarga la página.');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      cargarDatos();
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setPanelActivo('venta');
  }, [user]);

  useEffect(() => {
    if (!menuRapidoAbierto) return undefined;

    const handleClickFuera = (event) => {
      if (menuRapidoRef.current && !menuRapidoRef.current.contains(event.target)) {
        setMenuRapidoAbierto(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setMenuRapidoAbierto(false);
      }
    };

    document.addEventListener('mousedown', handleClickFuera);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickFuera);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuRapidoAbierto]);

  const guardarSorteo = async (configuracion, numeros, ticket = null) => {
    try {
      const nuevoSorteo = ticket || {
        fecha: new Date().toISOString(),
        configuracion,
        numeros,
        tipo: configuracion.tipo || 'ticket',
        numero: numeros[0],
        monto: configuracion.monto || 1,
        tipoApuesta: configuracion.tipoApuesta || 'straight',
        loteria: configuracion.loteria || configuracion.loteriaId || configuracion.nombre
      };
      
      // Si el ticket tiene grupoId, asegurarse de que se preserve
      if (ticket && ticket.grupoId) {
        nuevoSorteo.grupoId = ticket.grupoId;
      }
      
      // Guardar en el servidor
      const sorteoGuardado = await sorteosService.crearSorteo({
        ...nuevoSorteo,
        loteria: nuevoSorteo.loteria || ticket?.loteriaId
      });
      
      // Actualizar estado local
      setSorteos(prevSorteos => {
        const existe = prevSorteos.some(s => s.id === sorteoGuardado.id);
        if (existe) {
          return prevSorteos;
        }
        return [sorteoGuardado, ...prevSorteos];
      });
      
      return sorteoGuardado;
    } catch (error) {
      console.error('Error al guardar sorteo:', error);
      alert('Error al guardar el ticket. Por favor, intenta de nuevo.');
      throw error;
    }
  };
  
  // Función para guardar múltiples sorteos a la vez
  const guardarMultiplesSorteos = async (tickets) => {
    if (!tickets || tickets.length === 0) return;
    
    try {
      const sorteosGuardados = await sorteosService.crearMultiplesSorteos(
        tickets.map(ticket => ({
          fecha: ticket.fecha || new Date().toISOString(),
          ticketId: ticket.ticketId,
          numero: ticket.numero || ticket.numeros?.[0],
          monto: ticket.monto || 1,
          tipoApuesta: ticket.tipoApuesta || 'straight',
          loteria: ticket.loteriaId || ticket.configuracion?.loteria,
          grupoId: ticket.grupoId,
          puntoVentaDestinoId: ticket.puntoVentaDestinoId || ''
        }))
      );
      
      // Actualizar estado local
      setSorteos(prevSorteos => {
        const ticketsNuevos = sorteosGuardados.filter(t => 
          !prevSorteos.some(s => s.id === t.id)
        );
        return [...ticketsNuevos, ...prevSorteos];
      });
      
      return sorteosGuardados;
    } catch (error) {
      console.error('Error al guardar múltiples sorteos:', error);
      alert('Error al guardar algunos tickets. Por favor, verifica e intenta de nuevo.');
      throw error;
    }
  };

  const eliminarSorteo = async (ids, grupoId = '') => {
    try {
      const idsAEliminar = Array.isArray(ids) ? ids : [ids];
      
      if (grupoId && idsAEliminar.length > 1) {
        await sorteosService.eliminarGrupoSorteos(grupoId);
      } else {
        await Promise.all(idsAEliminar.map(id => sorteosService.eliminarSorteo(id)));
      }
      
      // Actualizar estado local
      setSorteos(prevSorteos =>
        prevSorteos.filter(sorteo => !idsAEliminar.includes(sorteo.id))
      );
    } catch (error) {
      console.error('Error al eliminar sorteo:', error);
      const mensajeServidor = error?.response?.data?.message;
      alert(mensajeServidor || 'Error al eliminar el ticket. Por favor, intenta de nuevo.');
    }
  };

  const transferirGrupo = async (grupoId, puntoVentaId, puntoVentaNombre) => {
    try {
      await sorteosService.transferirGrupo(grupoId, puntoVentaId);
      setSorteos(prev =>
        prev.map(s =>
          String(s.grupoId) === String(grupoId)
            ? { ...s, puntoVentaId: puntoVentaId || null, puntoVentaNombre: puntoVentaNombre || 'Administracion Central' }
            : s
        )
      );
    } catch (error) {
      console.error('Error al transferir grupo:', error);
      alert(error?.response?.data?.message || 'Error al transferir los tickets.');
    }
  };

  const marcarPagoTicket = async ({ id, ticketId, grupoId, pagado }) => {
    try {
      const actualizados = await sorteosService.marcarTicketPagado({
        id,
        ticketId,
        grupoId,
        pagado
      });

      const idsActualizados = new Set(
        (actualizados || []).map((item) => String(item.id)).filter(Boolean)
      );

      if (idsActualizados.size > 0) {
        const mapaActualizados = new Map(
          (actualizados || []).map((item) => [String(item.id), item])
        );

        setSorteos((prevSorteos) =>
          prevSorteos.map((sorteo) =>
            idsActualizados.has(String(sorteo.id))
              ? {
                  ...sorteo,
                  pagado: Boolean(pagado),
                  ganador: Boolean(
                    mapaActualizados.get(String(sorteo.id))?.ganador ??
                    sorteo.ganador
                  ),
                  numeroGanador:
                    mapaActualizados.get(String(sorteo.id))?.numeroGanador ??
                    sorteo.numeroGanador,
                  premio:
                    Number(mapaActualizados.get(String(sorteo.id))?.premio) ||
                    Number(sorteo.premio) ||
                    0,
                  pagadoPorId: mapaActualizados.get(String(sorteo.id))?.pagadoPor || null,
                  pagadoPorNombre: mapaActualizados.get(String(sorteo.id))?.pagadoPorNombre || '',
                  fechaPago: mapaActualizados.get(String(sorteo.id))?.fechaPago || null,
                  puntoVentaPagoId: mapaActualizados.get(String(sorteo.id))?.puntoVentaPago || null,
                  puntoVentaPagoNombre: mapaActualizados.get(String(sorteo.id))?.puntoVentaPagoNombre || '',
                  pagoPremioId: mapaActualizados.get(String(sorteo.id))?.pagoPremio || null
                }
              : sorteo
          )
        );
      }

      return actualizados;
    } catch (error) {
      console.error('Error al marcar pago del ticket:', error);
      alert(error.message || 'Error al actualizar el pago del ticket. Intenta de nuevo.');
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="App">
        <Header />
        <div className="container">
          <div className="state-card">
            <span className="state-kicker">Cabina en arranque</span>
            <h2>Estamos montando el tablero operativo.</h2>
            <p>Sincronizando ventas, loterias, resultados y paneles para abrir la nueva vista completa del sistema.</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="App">
        <Header />
        <div className="container">
          <div className="state-card state-card-error">
            <span className="state-kicker">Conexion interrumpida</span>
            <h2>{error}</h2>
            <p>La interfaz nueva no pudo completar la sincronizacion. Recarga el sistema para volver a intentar la conexion.</p>
            <button className="state-action" onClick={() => window.location.reload()}>
              Recargar sistema
            </button>
          </div>
        </div>
      </div>
    );
  }

  const esAdmin = user.rol === 'admin';
  const esSupervisor = user.rol === 'supervisor';
  const panelesDisponibles = esAdmin ? panelesAdmin : esSupervisor ? panelesSupervisor : panelesPuntoVenta;
  const mostrarNavegacion = panelesDisponibles.length > 1;
  const mostrarResumenSuperior = esAdmin && panelActivo === 'resumen';
  const mostrarSidebar = false;
  const panelActivoData = panelesDisponibles.find((panel) => panel.id === panelActivo) || panelesDisponibles[0];
  const nombrePanel = esAdmin ? 'Panel Administrador' : esSupervisor ? 'Panel Supervisor' : 'Panel Punto de Venta';
  const descripcionPanel = esAdmin
    ? 'Control general del sistema, reportes, premios y configuracion.'
    : esSupervisor
    ? 'Supervision de la red, ventas, reportes y registro de tickets para cualquier terminal.'
    : 'Terminal de venta dedicada para registrar jugadas del local sin mezclar otras areas.';
  const resumenHero = (esAdmin || esSupervisor)
    ? [
        {
          label: 'Venta del dia',
          value: formatearMoneda(ventaHoy),
          note: `${sorteosHoy.length} jugadas registradas hoy`
        },
        {
          label: 'Tickets en sistema',
          value: ticketsTotales,
          note: `${formatearMoneda(ventaAcumulada)} acumulados`
        },
        {
          label: 'Loterias activas',
          value: loterias.length,
          note: 'Catalogo disponible'
        },
        {
          label: 'Puntos activos',
          value: puntosActivos,
          note: 'Locales con movimiento'
        }
      ]
    : [
        {
          label: 'Venta del dia',
          value: formatearMoneda(ventaHoy),
          note: `${sorteosHoy.length} jugadas cargadas`
        },
        {
          label: 'Tus tickets',
          value: ticketsTotales,
          note: `${formatearMoneda(ventaAcumulada)} en sistema`
        },
        {
          label: 'Loterias listas',
          value: loterias.length,
          note: 'Disponibles para vender'
        },
        {
          label: 'Sesion',
          value: user.username || user.nombre,
          note: user.puntoVentaNombre || 'Operacion central'
        }
      ];

  const cambiarPanel = (panelId) => {
    setPanelActivo(panelId);
    setMenuRapidoAbierto(false);
  };

  const renderPanelAdmin = () => {
    if (panelActivo === 'resumen') {
      return <DashboardOperativo sorteos={sorteos} loterias={loterias} />;
    }

    if (panelActivo === 'venta') {
      return (
        <div className="content-grid panel-single">
          <GeneradorNumeros
            guardarSorteo={guardarSorteo}
            guardarMultiplesSorteos={guardarMultiplesSorteos}
            loterias={loterias}
            sorteos={sorteos}
            puntosVenta={puntosVenta}
          />
        </div>
      );
    }

    if (panelActivo === 'historial') {
      return (
        <div className="content-grid panel-single">
          <HistorialSorteos
            sorteos={sorteos}
            loterias={loterias}
            eliminarSorteo={eliminarSorteo}
            puntosVenta={puntosVenta}
            transferirGrupo={transferirGrupo}
          />
        </div>
      );
    }

    if (panelActivo === 'reportes') {
      return (
        <div className="content-grid panel-single">
          <ReporteVenta sorteos={sorteos} loterias={loterias} puntosVenta={puntosVenta} />
        </div>
      );
    }

    if (panelActivo === 'premios') {
      return (
        <div className="content-grid panel-single">
          <CalculadoraPremios
            sorteos={sorteos}
            loterias={loterias}
            puntosVenta={puntosVenta}
            marcarPagoTicket={marcarPagoTicket}
          />
        </div>
      );
    }

    if (panelActivo === 'recogida') {
      return (
        <div className="content-grid panel-single">
          <RecogidaSocios sorteos={sorteos} puntosVenta={puntosVenta} />
        </div>
      );
    }

    return (
      <div className="content-grid panel-single">
        <PanelAdministracion
          loterias={loterias}
          setLoterias={actualizarLoterias}
          puntosVenta={puntosVenta}
          setPuntosVenta={setPuntosVenta}
        />
      </div>
    );
  };

  const renderPanelSupervisor = () => {
    if (panelActivo === 'venta') {
      return (
        <div className="content-grid panel-single">
          <GeneradorNumeros
            guardarSorteo={guardarSorteo}
            guardarMultiplesSorteos={guardarMultiplesSorteos}
            loterias={loterias}
            sorteos={sorteos}
            puntosVenta={puntosVenta}
          />
        </div>
      );
    }

    if (panelActivo === 'historial') {
      return (
        <div className="content-grid panel-single">
          <HistorialSorteos
            sorteos={sorteos}
            loterias={loterias}
            eliminarSorteo={eliminarSorteo}
            puntosVenta={puntosVenta}
            transferirGrupo={transferirGrupo}
          />
        </div>
      );
    }

    if (panelActivo === 'reportes') {
      return (
        <div className="content-grid panel-single">
          <ReporteVenta sorteos={sorteos} loterias={loterias} puntosVenta={puntosVenta} />
        </div>
      );
    }

    if (panelActivo === 'premios') {
      return (
        <div className="content-grid panel-single">
          <CalculadoraPremios
            sorteos={sorteos}
            loterias={loterias}
            puntosVenta={puntosVenta}
            marcarPagoTicket={marcarPagoTicket}
          />
        </div>
      );
    }

    if (panelActivo === 'ganadores') {
      return (
        <div className="content-grid panel-single">
          <NumerosGanadores
            loterias={loterias}
            setLoterias={actualizarLoterias}
            soloLectura
          />
        </div>
      );
    }

    return (
      <div className="content-grid panel-single">
        <GeneradorNumeros
          guardarSorteo={guardarSorteo}
          guardarMultiplesSorteos={guardarMultiplesSorteos}
          loterias={loterias}
          sorteos={sorteos}
          puntosVenta={puntosVenta}
        />
      </div>
    );
  };

  const renderPanelPuntoVenta = () => {
    if (panelActivo === 'historial') {
      return (
        <div className="content-grid panel-single">
          <HistorialSorteos
            sorteos={sorteos}
            loterias={loterias}
            eliminarSorteo={eliminarSorteo}
            puntosVenta={puntosVenta}
            transferirGrupo={transferirGrupo}
          />
        </div>
      );
    }

    if (panelActivo === 'reportes') {
      return (
        <div className="content-grid panel-single">
          <ReporteVenta sorteos={sorteos} loterias={loterias} puntosVenta={puntosVenta} />
        </div>
      );
    }

    if (panelActivo === 'ganadores') {
      return (
        <div className="content-grid panel-single">
          <NumerosGanadores
            loterias={loterias}
            setLoterias={actualizarLoterias}
            soloLectura
          />
        </div>
      );
    }

    return (
      <div className="content-grid panel-single">
        <GeneradorNumeros
          guardarSorteo={guardarSorteo}
          guardarMultiplesSorteos={guardarMultiplesSorteos}
          loterias={loterias}
          sorteos={sorteos}
          puntosVenta={puntosVenta}
        />
      </div>
    );
  };

  return (
    <div className={`App ${esAdmin ? 'app-admin' : esSupervisor ? 'app-supervisor' : 'app-punto-venta'}`}>
      <Header
        mostrarNavegacion={mostrarNavegacion}
        menuRapidoAbierto={menuRapidoAbierto}
        setMenuRapidoAbierto={setMenuRapidoAbierto}
        menuRapidoRef={menuRapidoRef}
        panelActivo={panelActivo}
        panelActivoData={panelActivoData}
        panelesDisponibles={panelesDisponibles}
        cambiarPanel={cambiarPanel}
      />
      <div className="container">
        <div className={`studio-shell ${mostrarSidebar ? '' : 'studio-shell-full'}`}>
          {mostrarSidebar && (
            <aside className="studio-sidebar">
              <section className="sidebar-card sidebar-brand-card">
                <span className="sidebar-kicker">
                  {user.rol === 'admin' ? 'Control central' : 'Cabina local'}
                </span>
                <h2 className="sidebar-title">{nombrePanel}</h2>
                <p className="sidebar-description">{descripcionPanel}</p>
              </section>

              <section className="sidebar-card">
                <div className="sidebar-session-grid">
                  <div className="sidebar-session-item">
                    <span>Sesion</span>
                    <strong>{user.nombre}</strong>
                  </div>
                  <div className="sidebar-session-item">
                    <span>Modo</span>
                    <strong>{user.rol === 'admin' ? 'Administrador' : 'Punto de venta'}</strong>
                  </div>
                  <div className="sidebar-session-item">
                    <span>Operacion</span>
                    <strong>{user.puntoVentaNombre || 'Central'}</strong>
                  </div>
                  <div className="sidebar-session-item">
                    <span>Fecha</span>
                    <strong>{fechaPanel}</strong>
                  </div>
                </div>
              </section>

              <section className="sidebar-card">
                <div className="sidebar-stats-grid">
                  {resumenHero.map((item) => (
                    <div key={item.label} className="sidebar-stat-chip">
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                      <small>{item.note}</small>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          )}

          <main className="studio-stage">
            {mostrarResumenSuperior && (
              <>
                <section className="stage-masthead">
                  <div className="stage-masthead-copy">
                    <span className="masthead-kicker">
                      {panelActivoData.code} / {user.rol === 'admin' ? 'Administracion' : 'Operacion diaria'}
                    </span>
                    <h1 className="stage-title">{panelActivoData.label}</h1>
                    <p className="stage-description">{panelActivoData.summary}</p>
                  </div>

                  <div className="stage-masthead-board">
                    <div className="board-periodo-selector">
                      <button
                        type="button"
                        className={periodoBoard === 'hoy' ? 'activo' : ''}
                        onClick={() => setPeriodoBoard('hoy')}
                      >
                        Hoy
                      </button>
                      <button
                        type="button"
                        className={periodoBoard === 'semana' ? 'activo' : ''}
                        onClick={() => setPeriodoBoard('semana')}
                      >
                        Semana
                      </button>
                      <button
                        type="button"
                        className={periodoBoard === 'personalizado' ? 'activo' : ''}
                        onClick={() => setPeriodoBoard('personalizado')}
                      >
                        Personalizado
                      </button>
                    </div>

                    {periodoBoard === 'personalizado' && (
                      <div className="board-fechas">
                        <label>
                          <span>Desde</span>
                          <input
                            type="date"
                            value={boardDesde}
                            onChange={(e) => setBoardDesde(e.target.value)}
                          />
                        </label>
                        <label>
                          <span>Hasta</span>
                          <input
                            type="date"
                            value={boardHasta}
                            onChange={(e) => setBoardHasta(e.target.value)}
                          />
                        </label>
                      </div>
                    )}

                    <div className="board-row">
                      <span>{periodoBoard === 'hoy' ? 'Fecha de trabajo' : 'Periodo'}</span>
                      <strong>{rangoBoardLabel}</strong>
                    </div>
                    <div className="board-row">
                      <span>Tickets del periodo</span>
                      <strong>{ticketsPeriodo}</strong>
                    </div>
                    <div className="board-row">
                      <span>Loterias visibles</span>
                      <strong>{loterias.length}</strong>
                    </div>
                    <div className="board-row board-row--highlight-verde">
                      <span>{labelVentaPeriodo}</span>
                      <strong>{formatearMoneda(ventaPeriodo)}</strong>
                    </div>
                    <div className="board-row board-row--highlight-amarillo">
                      <span>Premios del periodo</span>
                      <strong>{formatearMoneda(premiosPeriodo)}</strong>
                    </div>
                  </div>
                </section>

                <section className="stage-ribbon">
                  {resumenHero.map((item) => (
                    <article key={item.label} className="ribbon-card">
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                      <p>{item.note}</p>
                    </article>
                  ))}
                </section>
              </>
            )}

            <section className="stage-body">
              {esAdmin ? renderPanelAdmin() : esSupervisor ? renderPanelSupervisor() : renderPanelPuntoVenta()}
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;
