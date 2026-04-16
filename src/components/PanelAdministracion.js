import React, { useState } from 'react';
import './PanelAdministracion.css';
import GestionLoterias from './GestionLoterias';
import NumerosGanadores from './NumerosGanadores';
import GestionPuntosVenta from './GestionPuntosVenta';
import GestionUsuarios from './GestionUsuarios';

const PanelAdministracion = ({ loterias, setLoterias, puntosVenta, setPuntosVenta }) => {
  const [pestanaActiva, setPestanaActiva] = useState('loterias');
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
          <span className="panel-kicker">Centro administrativo</span>
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
      </div>
    </div>
  );
};

export default PanelAdministracion;
