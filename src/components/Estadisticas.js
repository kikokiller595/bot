import React from 'react';
import './Estadisticas.css';

const Estadisticas = ({ sorteos }) => {
  const calcularEstadisticas = () => {
    if (sorteos.length === 0) {
      return {
        totalSorteos: 0,
        numerosMasFrecuentes: [],
        tipoMasUsado: null,
        promedioNumeros: 0
      };
    }

    // Contar frecuencia de números
    const frecuenciaNumeros = {};
    let totalNumeros = 0;
    const frecuenciaTipos = {};

    sorteos.forEach(sorteo => {
      // Contar tipos
      const tipo = sorteo.tipo || 'ticket';
      frecuenciaTipos[tipo] = (frecuenciaTipos[tipo] || 0) + 1;

      // Contar números - puede ser numeros (array) o numero (string)
      if (sorteo.numeros && Array.isArray(sorteo.numeros)) {
        sorteo.numeros.forEach(numero => {
          frecuenciaNumeros[numero] = (frecuenciaNumeros[numero] || 0) + 1;
          totalNumeros++;
        });
      } else if (sorteo.numero) {
        // Si tiene numero (singular), usarlo
        frecuenciaNumeros[sorteo.numero] = (frecuenciaNumeros[sorteo.numero] || 0) + 1;
        totalNumeros++;
      }
    });

    // Obtener números más frecuentes (top 10)
    const numerosMasFrecuentes = Object.entries(frecuenciaNumeros)
      .map(([numero, frecuencia]) => ({ numero: parseInt(numero), frecuencia }))
      .sort((a, b) => b.frecuencia - a.frecuencia)
      .slice(0, 10);

    // Tipo más usado
    const tipoMasUsado = Object.entries(frecuenciaTipos)
      .sort((a, b) => b[1] - a[1])[0]?.[0];

    const promedioNumeros = totalNumeros / sorteos.length;

    return {
      totalSorteos: sorteos.length,
      numerosMasFrecuentes,
      tipoMasUsado,
      promedioNumeros: promedioNumeros.toFixed(1)
    };
  };

  const stats = calcularEstadisticas();

  const getTipoLabel = (tipo) => {
    const tipos = {
      'simple': 'Número Simple',
      'loto': 'Loto',
      'mega': 'Mega',
      'personalizado': 'Personalizado'
    };
    return tipos[tipo] || tipo;
  };

  return (
    <div className="estadisticas-container">
      <div className="estadisticas-card">
        <h2 className="card-title">Estadísticas</h2>

        {stats.totalSorteos === 0 ? (
          <div className="sin-estadisticas">
            <p>No hay estadísticas disponibles aún.</p>
            <p className="texto-secundario">Genera algunos sorteos para ver estadísticas.</p>
          </div>
        ) : (
          <div className="stats-content">
            <div className="stat-item">
              <div className="stat-value">{stats.totalSorteos}</div>
              <div className="stat-label">Total de Sorteos</div>
            </div>

            <div className="stat-item">
              <div className="stat-value">{stats.promedioNumeros}</div>
              <div className="stat-label">Promedio de Números</div>
            </div>

            {stats.tipoMasUsado && (
              <div className="stat-item">
                <div className="stat-value-small">{getTipoLabel(stats.tipoMasUsado)}</div>
                <div className="stat-label">Tipo Más Usado</div>
              </div>
            )}

            {stats.numerosMasFrecuentes.length > 0 && (
              <div className="numeros-frecuentes">
                <h3>Números Más Frecuentes</h3>
                <div className="frecuencia-list">
                  {stats.numerosMasFrecuentes.map((item, index) => (
                    <div key={index} className="frecuencia-item">
                      <span className="frecuencia-numero">{item.numero}</span>
                      <span className="frecuencia-veces">{item.frecuencia} veces</span>
                      <div className="frecuencia-bar">
                        <div
                          className="frecuencia-bar-fill"
                          style={{
                            width: `${(item.frecuencia / stats.numerosMasFrecuentes[0].frecuencia) * 100}%`
                          }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Estadisticas;

