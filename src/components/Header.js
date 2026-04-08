import React from 'react';
import './Header.css';
import { useAuth } from '../context/AuthContext';

const Header = () => {
  const { user, logout } = useAuth();

  return (
    <header className="header">
      <div className="header-content">
        <div className="header-brand">
          <span className="header-brand-chip">TBY SISTEMAS</span>
          <div className="header-brand-copy">
            <strong>Cabina central de loteria</strong>
            <span>ventas, supervisión y premios desde una sola consola</span>
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
    </header>
  );
};

export default Header;
