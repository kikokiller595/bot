import React, { useState, useEffect } from 'react';
import './PanelAdministracion.css';
import GestionLoterias from './GestionLoterias';
import NumerosGanadores from './NumerosGanadores';
import GestionPuntosVenta from './GestionPuntosVenta';
import GestionUsuarios from './GestionUsuarios';
import sorteosService from '../services/sorteosService';

const normalizeBaseUrl = (value, fallback = '') =>
  (value || fallback || '').trim().replace(/\/+$/, '');

const defaultBackendUrl =
  process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000';

const BACKEND_URL = normalizeBaseUrl(
  process.env.REACT_APP_BACKEND_URL,
  defaultBackendUrl
);

const HEALTHCHECK_URL = BACKEND_URL ? `${BACKEND_URL}/health` : '/health';

const PanelAdministracion = ({
  loterias,
  setLoterias,
  puntosVenta,
  setPuntosVenta,
  onVentasReiniciadas
}) => {
  const [pestanaActiva, setPestanaActiva] = useState('loterias');
  const [backendStatus, setBackendStatus] = useState('checking');
  const [databaseStatus, setDatabaseStatus] = useState('checking');

  // Estado del modal de reinicio de ventas.
  const [resetModalAbierto, setResetModalAbierto] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetCargando, setResetCargando] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetExito, setResetExito] = useState('');

  const cerrarResetModal = () => {
    if (resetCargando) return;
    setResetModalAbierto(false);
    setResetPassword('');
    setResetError('');
  };

  const confirmarReinicio = async () => {
    if (!resetPassword) {
      setResetError('Ingresa tu contraseña de administrador.');
      return;
    }

    setResetCargando(true);
    setResetError('');
    setResetExito('');

    try {
      const data = await sorteosService.reiniciarVentas(resetPassword);
      const tickets = data?.ticketsEliminados ?? 0;
      const pagos = data?.pagosEliminados ?? 0;
      setResetExito(
        `Listo: se eliminaron ${tickets} tickets y ${pagos} pagos de premios.`
      );
      setResetModalAbierto(false);
      setResetPassword('');
      if (typeof onVentasReiniciadas === 'function') {
        onVentasReiniciadas();
      }
    } catch (error) {
      setResetError(error?.message || 'No se pudo reiniciar el sistema.');
    } finally {
      setResetCargando(false);
    }
  };

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const response = await fetch(HEALTHCHECK_URL);
        if (!active) return;
        if (!response.ok) { setBackendStatus('offline'); setDatabaseStatus('offline'); return; }
        const data = await response.json();
        setBackendStatus('online');
        setDatabaseStatus(data?.database || 'unknown');
      } catch {
        if (active) { setBackendStatus('offline'); setDatabaseStatus('offline'); }
      }
    };
    check();
    const timer = setInterval(check, 10000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  const statusText = () => {
    if (backendStatus === 'online' && databaseStatus === 'connected') return 'System ready';
    if (backendStatus === 'online') return 'Server online — database connecting...';
    if (backendStatus === 'checking') return 'Connecting...';
    return 'Server unavailable';
  };
  const pestanas = [
    {
      id: 'loterias',
      label: 'Loterias',
      description: 'Catalogo, horarios y premios'
    },
    {
      id: 'numeros',
      label: 'Resultados',
      description: 'Carga de numeros ganadores'
    },
    {
      id: 'puntos',
      label: 'Puntos de venta',
      description: 'Locales, responsables y estado'
    },
    {
      id: 'usuarios',
      label: 'Usuarios',
      description: 'Accesos y permisos del sistema'
    }
  ];

  return (
    <div className="panel-administracion-container">
      <div className="panel-administracion-card">
        <div className="panel-header">
          <div className="panel-header-top">
            <span className="panel-kicker">Centro administrativo</span>
            <div className={`panel-system-status panel-system-status--${backendStatus}`}>
              <span className="panel-status-dot" />
              <span>{statusText()}</span>
            </div>
          </div>
          <h2 className="panel-title">Configuracion general del sistema</h2>
          <p className="panel-description">
            Organiza loterias, resultados, locales y accesos desde una sola vista.
          </p>
        </div>

        <div className="tabs-panel">
          {pestanas.map((pestana) => (
            <button
              key={pestana.id}
              className={`tab-panel-button ${pestanaActiva === pestana.id ? 'active' : ''}`}
              onClick={() => setPestanaActiva(pestana.id)}
            >
              <span>{pestana.label}</span>
              <small>{pestana.description}</small>
            </button>
          ))}
        </div>

        <div className="panel-content">
          {pestanaActiva === 'loterias' && (
            <div className="tab-content">
              <GestionLoterias loterias={loterias} setLoterias={setLoterias} />
            </div>
          )}

          {pestanaActiva === 'numeros' && (
            <div className="tab-content">
              <NumerosGanadores loterias={loterias} setLoterias={setLoterias} />
            </div>
          )}

          {pestanaActiva === 'puntos' && (
            <div className="tab-content">
              <GestionPuntosVenta
                puntosVentaExternos={puntosVenta}
                onPuntosVentaChange={setPuntosVenta}
              />
            </div>
          )}

          {pestanaActiva === 'usuarios' && (
            <div className="tab-content">
              <GestionUsuarios />
            </div>
          )}
        </div>

        <div className="danger-zone">
          <div className="danger-zone-info">
            <h3 className="danger-zone-title">Reiniciar el sistema</h3>
            <p className="danger-zone-text">
              Elimina <strong>todos los tickets, ventas y pagos de premios</strong>.
              Las loterías, puntos de venta y usuarios se conservan. Esta acción
              no se puede deshacer.
            </p>
          </div>
          <button
            type="button"
            className="danger-zone-button"
            onClick={() => {
              setResetExito('');
              setResetError('');
              setResetModalAbierto(true);
            }}
          >
            Borrar ventas y premios
          </button>
        </div>

        {resetExito && (
          <div className="danger-zone-success">{resetExito}</div>
        )}
      </div>

      {resetModalAbierto && (
        <div className="reset-modal-overlay" onClick={cerrarResetModal}>
          <div
            className="reset-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="reset-modal-title">Confirmar reinicio</h3>
            <p className="reset-modal-text">
              Se eliminarán <strong>todos los tickets, ventas y pagos de
              premios</strong> de forma permanente. Escribe tu contraseña de
              administrador para confirmar.
            </p>
            <input
              type="password"
              className="reset-modal-input"
              placeholder="Contraseña de administrador"
              value={resetPassword}
              autoFocus
              disabled={resetCargando}
              onChange={(event) => setResetPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') confirmarReinicio();
              }}
            />
            {resetError && (
              <div className="reset-modal-error">{resetError}</div>
            )}
            <div className="reset-modal-actions">
              <button
                type="button"
                className="reset-modal-cancel"
                onClick={cerrarResetModal}
                disabled={resetCargando}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="reset-modal-confirm"
                onClick={confirmarReinicio}
                disabled={resetCargando}
              >
                {resetCargando ? 'Borrando…' : 'Borrar todo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PanelAdministracion;
