import React, { useMemo } from 'react';
import './DashboardOperativo.css';
import { useAuth } from '../context/AuthContext';

const obtenerClaveFecha = (valor) => {
  if (!valor) {
    return null;
  }

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

const agruparPorTicket = (sorteos = []) => {
  const mapa = new Map();

  sorteos.forEach((sorteo) => {
    const ticketId = String(sorteo.ticketId || sorteo.id || '');
    if (!ticketId) {
      return;
    }

    if (!mapa.has(ticketId)) {
      mapa.set(ticketId, {
        ticketId,
        fecha: sorteo.fecha || '',
        fechaISO: sorteo.fechaISO || sorteo.fecha || '',
        puntoVentaNombre: sorteo.puntoVentaNombre || 'Sin punto de venta',
        usuarioNombre: sorteo.usuarioNombre || sorteo.vendedorNombre || 'Sin usuario',
        loterias: new Set(),
        monto: 0,
        jugadas: 0
      });
    }

    const item = mapa.get(ticketId);
    item.monto += Number(sorteo.monto) || 0;
    item.jugadas += 1;
    if (sorteo.loteriaNombre) {
      item.loterias.add(sorteo.loteriaNombre);
    }
  });

  return Array.from(mapa.values())
    .map((item) => ({
      ...item,
      loterias: Array.from(item.loterias)
    }))
    .sort((a, b) => new Date(b.fechaISO || 0) - new Date(a.fechaISO || 0));
};

function DashboardOperativo({ sorteos = [], loterias = [] }) {
  const { user } = useAuth();
  const hoy = useMemo(() => obtenerClaveFecha(new Date()), []);

  const sorteosHoy = useMemo(
    () =>
      sorteos.filter(
        (sorteo) => obtenerClaveFecha(sorteo.fechaISO || sorteo.fecha) === hoy
      ),
    [sorteos, hoy]
  );

  const ticketsHoy = useMemo(() => agruparPorTicket(sorteosHoy), [sorteosHoy]);
  const ticketsRecientes = useMemo(() => agruparPorTicket(sorteos).slice(0, 5), [sorteos]);

  const resumenHoy = useMemo(() => {
    const totalVendido = sorteosHoy.reduce(
      (sum, sorteo) => sum + (Number(sorteo.monto) || 0),
      0
    );

    return {
      totalVendido,
      totalJugadas: sorteosHoy.length,
      totalTickets: ticketsHoy.length
    };
  }, [sorteosHoy, ticketsHoy]);

  const ventasPorLoteriaHoy = useMemo(() => {
    const mapa = new Map();

    sorteosHoy.forEach((sorteo) => {
      const nombre = sorteo.loteriaNombre || 'Sin loteria';
      if (!mapa.has(nombre)) {
        mapa.set(nombre, {
          nombre,
          ventas: 0,
          jugadas: 0
        });
      }

      const item = mapa.get(nombre);
      item.ventas += Number(sorteo.monto) || 0;
      item.jugadas += 1;
    });

    return Array.from(mapa.values()).sort((a, b) => b.ventas - a.ventas);
  }, [sorteosHoy]);

  const ventasPorPuntoVentaHoy = useMemo(() => {
    const mapa = new Map();

    sorteosHoy.forEach((sorteo) => {
      const nombre = sorteo.puntoVentaNombre || 'Sin punto de venta';
      if (!mapa.has(nombre)) {
        mapa.set(nombre, {
          nombre,
          ventas: 0,
          jugadas: 0,
          tickets: new Set()
        });
      }

      const item = mapa.get(nombre);
      item.ventas += Number(sorteo.monto) || 0;
      item.jugadas += 1;
      item.tickets.add(String(sorteo.ticketId || sorteo.id || ''));
    });

    return Array.from(mapa.values())
      .map((item) => ({
        nombre: item.nombre,
        ventas: item.ventas,
        jugadas: item.jugadas,
        tickets: item.tickets.size
      }))
      .sort((a, b) => b.ventas - a.ventas);
  }, [sorteosHoy]);

  const puntosActivos = useMemo(() => {
    const nombres = new Set(
      sorteos
        .map((sorteo) => sorteo.puntoVentaNombre)
        .filter(Boolean)
    );
    return nombres.size;
  }, [sorteos]);

  const tituloSecundario =
    user?.rol === 'admin'
      ? 'Resumen central de ventas y actividad por local'
      : `${user?.puntoVentaNombre || 'Punto de venta'} - actividad del dia`;

  const tarjetas = [
    {
      label: 'Ventas del dia',
      value: `$${resumenHoy.totalVendido.toFixed(2)}`,
      note: `${resumenHoy.totalJugadas} jugadas procesadas`
    },
    {
      label: 'Tickets activos',
      value: resumenHoy.totalTickets,
      note: 'Resumen del turno actual'
    },
    {
      label: 'Loterias en movimiento',
      value: loterias.length,
      note: 'Catalogo visible hoy'
    },
    {
      label: user?.rol === 'admin' ? 'Locales con actividad' : 'Sesion activa',
      value: user?.rol === 'admin' ? puntosActivos : user?.username || 'Sin usuario',
      note: user?.rol === 'admin' ? 'Puntos con movimiento' : user?.puntoVentaNombre || 'Punto central'
    }
  ];

  return (
    <div className="dashboard-operativo">
      <div className="dashboard-operativo-card">
        <div className="dashboard-header">
          <div>
            <span className="dashboard-eyebrow">
              {user?.rol === 'admin' ? 'Briefing central' : 'Pulso del local'}
            </span>
            <h2 className="dashboard-title">
              {user?.rol === 'admin' ? 'Pulso general de la red' : 'Ritmo operativo del turno'}
            </h2>
            <p className="dashboard-subtitle">{tituloSecundario}</p>
          </div>
          <div className="dashboard-meta">
            <span>Hoy: {hoy}</span>
            <span>Loterias activas: {loterias.length}</span>
          </div>
        </div>

        <div className="dashboard-cards">
          {tarjetas.map((tarjeta) => (
            <article key={tarjeta.label} className="dashboard-stat">
              <span className="stat-label">{tarjeta.label}</span>
              <strong className="stat-value">{tarjeta.value}</strong>
              <small className="stat-note">{tarjeta.note}</small>
            </article>
          ))}
        </div>

        <div className="dashboard-grid">
          <section className="dashboard-panel">
            <div className="dashboard-panel-header">
              <span className="dashboard-panel-kicker">
                {user?.rol === 'admin' ? 'Lectura comercial' : 'Lectura por loteria'}
              </span>
              <h3>
                {user?.rol === 'admin'
                  ? 'Ventas de hoy por punto de venta'
                  : 'Ventas de hoy por loteria'}
              </h3>
            </div>

            {user?.rol === 'admin' ? (
              ventasPorPuntoVentaHoy.length === 0 ? (
                <p className="dashboard-empty">Todavia no hay ventas registradas hoy.</p>
              ) : (
                <div className="dashboard-table">
                  <div className="dashboard-table-header">
                    <span>Punto de venta</span>
                    <span>Tickets</span>
                    <span>Jugadas</span>
                    <span>Ventas</span>
                  </div>
                  {ventasPorPuntoVentaHoy.map((item) => (
                    <div key={item.nombre} className="dashboard-table-row">
                      <span>{item.nombre}</span>
                      <span>{item.tickets}</span>
                      <span>{item.jugadas}</span>
                      <span>${item.ventas.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )
            ) : ventasPorLoteriaHoy.length === 0 ? (
              <p className="dashboard-empty">Todavia no hay ventas por loteria hoy.</p>
            ) : (
              <div className="dashboard-table">
                <div className="dashboard-table-header">
                  <span>Loteria</span>
                  <span>Jugadas</span>
                  <span>Ventas</span>
                </div>
                {ventasPorLoteriaHoy.map((item) => (
                  <div key={item.nombre} className="dashboard-table-row compact">
                    <span>{item.nombre}</span>
                    <span>{item.jugadas}</span>
                    <span>${item.ventas.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="dashboard-panel">
            <div className="dashboard-panel-header">
              <span className="dashboard-panel-kicker">Actividad reciente</span>
              <h3>
                {user?.rol === 'admin' ? 'Ultimos tickets del sistema' : 'Tus ultimos tickets'}
              </h3>
            </div>

            {ticketsRecientes.length === 0 ? (
              <p className="dashboard-empty">Aun no hay tickets para mostrar.</p>
            ) : (
              <div className="dashboard-ticket-list">
                {ticketsRecientes.map((ticket) => (
                  <div key={ticket.ticketId} className="ticket-mini-card">
                    <div className="ticket-mini-top">
                      <strong>#{ticket.ticketId}</strong>
                      <span>${ticket.monto.toFixed(2)}</span>
                    </div>
                    <div className="ticket-mini-middle">
                      <span>{ticket.puntoVentaNombre}</span>
                      <span>{ticket.usuarioNombre}</span>
                    </div>
                    <div className="ticket-mini-bottom">
                      <span>{ticket.jugadas} jugadas</span>
                      <span>{ticket.loterias.join(', ') || 'Sin loterias'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default DashboardOperativo;
