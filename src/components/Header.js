import React from 'react';
import './Header.css';
import { useAuth } from '../context/AuthContext';

const Header = () => {
  const { user, logout } = useAuth();

  return (
    <header className="header">
      <div className="header-content">
        <div>
          <h1 className="header-title">TBY Sistemas</h1>
          <p className="header-subtitle">Sistema de Loteria</p>
        </div>
        {user && (
          <div className="header-user">
            <span className="user-info">
              <strong>{user.nombre}</strong>
              <span className="user-role">
                {user.rol === 'admin' ? '(Administrador)' : '(Punto de venta)'}
              </span>
              {user.puntoVentaNombre && (
                <span className="user-role">{user.puntoVentaNombre}</span>
              )}
            </span>
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
