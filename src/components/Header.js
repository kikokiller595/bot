import React from 'react';
import './Header.css';
import { useAuth } from '../context/AuthContext';

const Header = ({
  mostrarNavegacion = false,
  menuRapidoAbierto = false,
  setMenuRapidoAbierto = null,
  menuRapidoRef = null,
  panelActivo = '',
  panelActivoData = null,
  panelesDisponibles = [],
  cambiarPanel = null
}) => {
  const { user, logout } = useAuth();

  const toggleMenu = () => {
    if (setMenuRapidoAbierto) {
      setMenuRapidoAbierto((prev) => !prev);
    }
  };

  return (
    <header className="header">
      <div
        className={`header-content ${mostrarNavegacion ? 'header-content-with-menu' : ''}`}
        ref={menuRapidoRef}
      >
        <div className="header-main-row">
          <div className="header-brand">
            <span className="header-brand-chip">TBY SISTEMAS</span>
            <div className="header-brand-copy">
              <strong>Cabina central de loteria</strong>
              <span>ventas, supervision y premios desde una sola consola</span>
            </div>
          </div>

          {user && (
            <div className="header-user">
              <div className="header-user-meta">
                <span className="header-user-role">
                  {user.rol === 'admin' ? 'Administrador' : 'Punto de venta'}
                </span>
                <div className="header-user-copy">
                  <strong>{user.nombre}</strong>
                  <span>{user.puntoVentaNombre || 'Central'}</span>
                </div>
              </div>

              <button onClick={logout} className="logout-btn">
                Cerrar sesion
              </button>
            </div>
          )}
        </div>

        {mostrarNavegacion && (
          <div className={`header-menu-row ${menuRapidoAbierto ? 'is-open' : ''}`}>
            <div className="stage-top-nav-bar">
              <button
                type="button"
                className="stage-top-nav-trigger"
                onClick={toggleMenu}
                aria-expanded={menuRapidoAbierto}
                aria-haspopup="true"
              >
                <span className="stage-top-nav-trigger-icon" aria-hidden="true" />
                <span className="stage-top-nav-trigger-label">Menu</span>
                <span className="stage-top-nav-trigger-caret" aria-hidden="true">
                  {menuRapidoAbierto ? '^' : 'v'}
                </span>
              </button>

              <div className="stage-top-nav-current">
                <span>Vista actual</span>
                <strong>{panelActivoData?.label || panelActivo}</strong>
              </div>
            </div>

            {menuRapidoAbierto && (
              <div className="stage-top-nav-dropdown">
                <div className="stage-top-nav-copy">
                  Navega entre las areas principales sin bajar al contenido.
                </div>

                <div className="stage-top-nav-list">
                  {panelesDisponibles.map((panel) => (
                    <button
                      key={panel.id}
                      className={`stage-top-nav-button ${panelActivo === panel.id ? 'is-active' : ''}`}
                      onClick={() => cambiarPanel && cambiarPanel(panel.id)}
                    >
                      <span className="stage-top-nav-code">{panel.code}</span>
                      <span className="stage-top-nav-text">
                        <strong>{panel.label}</strong>
                        <small>{panel.summary}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
