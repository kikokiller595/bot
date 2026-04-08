import React, { useState, useEffect } from 'react';
import './App.css';
import Header from './components/Header';
import DashboardOperativo from './components/DashboardOperativo';
import GeneradorNumeros from './components/GeneradorNumeros';
import HistorialSorteos from './components/HistorialSorteos';
import ReporteVenta from './components/ReporteVenta';
import PanelAdministracion from './components/PanelAdministracion';
import CalculadoraPremios from './components/CalculadoraPremios';
import { normalizarPremios } from './utils/premiosDefault';
import { useAuth } from './context/AuthContext';
import sorteosService from './services/sorteosService';
import loteriasService from './services/loteriasService';

function App() {
  const { user } = useAuth();
  const [sorteos, setSorteos] = useState([]);
  const [loterias, setLoterias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [panelActivo, setPanelActivo] = useState('resumen');

  const obtenerClaveFecha = (valor) => {
    if (!valor) return null;

    if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
      const anio = valor.getFullYear();
      const mes = String(valor.getMonth() + 1).padStart(2, '0');
      const dia = String(valor.getDate()).padStart(2, '0');
      return `${anio}-${mes}-${dia}`;
    }

    const isoMatch = String(valor).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }

    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) {
      return null;
    }

    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  };

  const formatearMoneda = (valor = 0) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(Number(valor) || 0);

  const panelesAdmin = [
    { id: 'resumen', label: 'Resumen general' },
    { id: 'ventas', label: 'Ventas y tickets' },
    { id: 'premios', label: 'Premios' },
    { id: 'administracion', label: 'Administracion' }
  ];

  const panelesPuntoVenta = [
    { id: 'venta', label: 'Nueva venta' },
    { id: 'historial', label: 'Historial' },
    { id: 'resumen', label: 'Resumen' },
    { id: 'ganadores', label: 'Ganadores' }
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
        const loteriasData = await loteriasService.obtenerLoterias();
        setLoterias(normalizarListaLoterias(loteriasData));
        
        // Cargar sorteos desde el servidor
        const sorteosData = await sorteosService.obtenerSorteos();
        setSorteos(sorteosData);
        
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
    setPanelActivo(user.rol === 'admin' ? 'resumen' : 'venta');
  }, [user]);

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
      
      console.log('App: Guardando sorteo en servidor:', nuevoSorteo);
      
      // Guardar en el servidor
      const sorteoGuardado = await sorteosService.crearSorteo({
        ...nuevoSorteo,
        loteria: nuevoSorteo.loteria || ticket?.loteriaId
      });
      
      // Actualizar estado local
      setSorteos(prevSorteos => {
        const existe = prevSorteos.some(s => s.id === sorteoGuardado.id);
        if (existe) {
          console.log('App: Ticket ya existe, omitiendo:', sorteoGuardado.id);
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
    
    console.log('App: Guardando múltiples sorteos:', tickets.length);
    
    try {
      const sorteosGuardados = await sorteosService.crearMultiplesSorteos(
        tickets.map(ticket => ({
          fecha: ticket.fecha || new Date().toISOString(),
          ticketId: ticket.ticketId,
          numero: ticket.numero || ticket.numeros?.[0],
          monto: ticket.monto || 1,
          tipoApuesta: ticket.tipoApuesta || 'straight',
          loteria: ticket.loteriaId || ticket.configuracion?.loteria,
          grupoId: ticket.grupoId
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

  const eliminarSorteo = async (ids) => {
    try {
      const idsAEliminar = Array.isArray(ids) ? ids : [ids];
      
      // Eliminar del servidor
      await Promise.all(idsAEliminar.map(id => sorteosService.eliminarSorteo(id)));
      
      // Actualizar estado local
      setSorteos(prevSorteos =>
        prevSorteos.filter(sorteo => !idsAEliminar.includes(sorteo.id))
      );
    } catch (error) {
      console.error('Error al eliminar sorteo:', error);
      alert('Error al eliminar el ticket. Por favor, intenta de nuevo.');
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
                  pagadoPorId: mapaActualizados.get(String(sorteo.id))?.pagadoPor || null,
                  pagadoPorNombre: mapaActualizados.get(String(sorteo.id))?.pagadoPorNombre || '',
                  fechaPago: mapaActualizados.get(String(sorteo.id))?.fechaPago || null,
                  puntoVentaPagoId: mapaActualizados.get(String(sorteo.id))?.puntoVentaPago || null,
                  puntoVentaPagoNombre: mapaActualizados.get(String(sorteo.id))?.puntoVentaPagoNombre || ''
                }
              : sorteo
          )
        );
      }

      return actualizados;
    } catch (error) {
      console.error('Error al marcar pago del ticket:', error);
      alert('Error al actualizar el pago del ticket. Intenta de nuevo.');
      throw error;
    }
  };

  const limpiarHistorial = async () => {
    if (window.confirm('¿Estás seguro de que quieres eliminar todo el historial de tickets?')) {
      try {
        // Eliminar todos los sorteos del servidor
        await Promise.all(sorteos.map(sorteo => sorteosService.eliminarSorteo(sorteo.id)));
        
        // Limpiar estado local
        setSorteos([]);
      } catch (error) {
        console.error('Error al limpiar historial:', error);
        alert('Error al limpiar el historial. Por favor, intenta de nuevo.');
      }
    }
  };

  if (loading) {
    return (
      <div className="App">
        <Header />
        <div className="container">
          <div className="state-card">
            <span className="state-kicker">Preparando entorno</span>
            <h2>Cargando datos del sistema...</h2>
            <p>Estamos sincronizando ventas, loterias, resultados y paneles para dejar todo listo.</p>
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
            <span className="state-kicker">Error de sincronizacion</span>
            <h2>{error}</h2>
            <p>Recarga la aplicacion para volver a intentar la conexion con el servicio.</p>
            <button className="state-action" onClick={() => window.location.reload()}>
              Recargar sistema
            </button>
          </div>
        </div>
      </div>
    );
  }

  const panelesDisponibles = user.rol === 'admin' ? panelesAdmin : panelesPuntoVenta;
  const nombrePanel = user.rol === 'admin' ? 'Panel Administrador' : 'Panel Punto de Venta';
  const descripcionPanel = user.rol === 'admin'
    ? 'Control general del sistema, reportes, premios y configuracion.'
    : 'Venta diaria, historial propio, resumen del local y consulta de ganadores.';
  const resumenHero = user.rol === 'admin'
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

  const renderPanelAdmin = () => {
    if (panelActivo === 'resumen') {
      return <DashboardOperativo sorteos={sorteos} loterias={loterias} />;
    }

    if (panelActivo === 'ventas') {
      return (
        <>
          <GeneradorNumeros
            guardarSorteo={guardarSorteo}
            guardarMultiplesSorteos={guardarMultiplesSorteos}
            loterias={loterias}
            sorteos={sorteos}
          />
          <div className="content-grid">
            <HistorialSorteos
              sorteos={sorteos}
              loterias={loterias}
              eliminarSorteo={eliminarSorteo}
              limpiarHistorial={limpiarHistorial}
            />
            <ReporteVenta sorteos={sorteos} loterias={loterias} />
          </div>
        </>
      );
    }

    if (panelActivo === 'premios') {
      return (
        <div className="content-grid panel-single">
          <CalculadoraPremios
            sorteos={sorteos}
            loterias={loterias}
            marcarPagoTicket={marcarPagoTicket}
          />
        </div>
      );
    }

    return (
      <div className="content-grid panel-single">
        <PanelAdministracion loterias={loterias} setLoterias={actualizarLoterias} />
      </div>
    );
  };

  const renderPanelPuntoVenta = () => {
    if (panelActivo === 'venta') {
      return (
        <>
          <DashboardOperativo sorteos={sorteos} loterias={loterias} />
          <GeneradorNumeros
            guardarSorteo={guardarSorteo}
            guardarMultiplesSorteos={guardarMultiplesSorteos}
            loterias={loterias}
            sorteos={sorteos}
          />
        </>
      );
    }

    if (panelActivo === 'historial') {
      return (
        <div className="content-grid panel-single">
          <HistorialSorteos
            sorteos={sorteos}
            loterias={loterias}
            eliminarSorteo={eliminarSorteo}
            limpiarHistorial={limpiarHistorial}
          />
        </div>
      );
    }

    if (panelActivo === 'resumen') {
      return (
        <>
          <DashboardOperativo sorteos={sorteos} loterias={loterias} />
          <div className="content-grid panel-single">
            <ReporteVenta sorteos={sorteos} loterias={loterias} />
          </div>
        </>
      );
    }

    return (
      <div className="content-grid panel-single">
        <CalculadoraPremios
          sorteos={sorteos}
          loterias={loterias}
          marcarPagoTicket={marcarPagoTicket}
        />
      </div>
    );
  };

  return (
    <div className="App">
      <Header />
      <div className="container">
        <div className="panel-shell">
          <section className="workspace-hero">
            <div className="workspace-copy">
              <span className="workspace-kicker">
                {user.rol === 'admin' ? 'Centro de control' : 'Estacion de ventas'}
              </span>
              <h2 className="workspace-title">{nombrePanel}</h2>
              <p className="workspace-description">{descripcionPanel}</p>
              <div className="workspace-inline-meta">
                <span>{user.nombre}</span>
                <span>{user.rol === 'admin' ? 'Administrador' : 'Punto de venta'}</span>
                <span>{user.puntoVentaNombre || 'Central'}</span>
              </div>
            </div>
            <div className="workspace-metrics">
              {resumenHero.map((item) => (
                <div key={item.label} className="workspace-metric">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <small>{item.note}</small>
                </div>
              ))}
              <div className="workspace-metric workspace-metric-wide">
                <span>Fecha</span>
                <strong>{fechaPanel}</strong>
                <small>Operacion sincronizada con el panel central</small>
              </div>
            </div>
          </section>

          <div className="panel-selector">
            <div className="panel-selector-head">
              <div>
                <span className="panel-role-badge">
                  {user.rol === 'admin' ? 'Administrador' : 'Punto de venta'}
                </span>
                <h3 className="panel-selector-title">Navegacion del panel</h3>
                <p className="panel-selector-description">
                  Cambia rapidamente entre las vistas principales del sistema.
                </p>
              </div>
            </div>
            <div className="panel-tabs">
              {panelesDisponibles.map((panel) => (
                <button
                  key={panel.id}
                  className={`panel-tab-button ${panelActivo === panel.id ? 'active' : ''}`}
                  onClick={() => setPanelActivo(panel.id)}
                >
                  {panel.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {user.rol === 'admin' ? renderPanelAdmin() : renderPanelPuntoVenta()}
      </div>
    </div>
  );
}

export default App;
