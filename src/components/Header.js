import React from 'react';
import './Header.css';
import { useAuth } from '../context/AuthContext';

const Header = () => {
  const { user, logout } = useAuth();

  return (
    <header className="header">
      <div className="header-content">
        <div className="header-brandline">
          <span className="header-stamp">TBY SYSTEM GRID</span>
          <span className="header-stamp muted">Railway live</span>
        </div>
        {user && (
          <div className="header-user">
            <span className="user-role">
              {user.rol === 'admin' ? 'Administrador' : 'Punto de venta'}
            </span>
            <div className="user-info">
              <strong>{user.nombre}</strong>
              <span className="user-location">{user.puntoVentaNombre || 'Central'}</span>
            </div>
            <button onClick={logout} className="logout-btn">
              Salir
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
