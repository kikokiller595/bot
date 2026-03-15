import React, { useState } from 'react';
import './PanelAdministracion.css';
import GestionLoterias from './GestionLoterias';
import NumerosGanadores from './NumerosGanadores';
import GestionPuntosVenta from './GestionPuntosVenta';
import GestionUsuarios from './GestionUsuarios';

const PanelAdministracion = ({ loterias, setLoterias }) => {
  const [pestanaActiva, setPestanaActiva] = useState('loterias');

  return (
    <div className="panel-administracion-container">
      <div className="panel-administracion-card">
        <div className="panel-header">
          <h2 className="panel-title">Panel de Administracion</h2>
        </div>

        <div className="tabs-panel">
          <button
            className={`tab-panel-button ${pestanaActiva === 'loterias' ? 'active' : ''}`}
            onClick={() => setPestanaActiva('loterias')}
          >
            Gestionar loterias
          </button>
          <button
            className={`tab-panel-button ${pestanaActiva === 'numeros' ? 'active' : ''}`}
            onClick={() => setPestanaActiva('numeros')}
          >
            Numeros ganadores
          </button>
          <button
            className={`tab-panel-button ${pestanaActiva === 'puntos' ? 'active' : ''}`}
            onClick={() => setPestanaActiva('puntos')}
          >
            Puntos de venta
          </button>
          <button
            className={`tab-panel-button ${pestanaActiva === 'usuarios' ? 'active' : ''}`}
            onClick={() => setPestanaActiva('usuarios')}
          >
            Usuarios
          </button>
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
              <GestionPuntosVenta />
            </div>
          )}

          {pestanaActiva === 'usuarios' && (
            <div className="tab-content">
              <GestionUsuarios />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PanelAdministracion;
