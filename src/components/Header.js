import React from 'react';
import './Header.css';
import { useAuth } from '../context/AuthContext';

const Header = () => {
  const { user, logout } = useAuth();

  return (
    <header className="header">
      <div className="header-content">
        <div className="header-brand">
          <div className="header-mark">77</div>
          <div className="header-copy">
            <span className="header-kicker">Red operativa centralizada</span>
            <h1 className="header-title">TBY Sistemas</h1>
            <p className="header-subtitle">Control de loteria, ventas y resultados en una sola vista</p>
          </div>
        </div>
        {user && (
          <div className="header-user">
            <div className="user-info">
              <span className="user-label">Sesion actual</span>
              <strong>{user.nombre}</strong>
            </div>
            <div className="user-tags">
              <span className="user-role">
                {user.rol === 'admin' ? 'Administrador' : 'Punto de venta'}
              </span>
              <span className="user-location">{user.puntoVentaNombre || 'Central'}</span>
            </div>
            <button onClick={logout} className="logout-btn">
              Cerrar sesion
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
