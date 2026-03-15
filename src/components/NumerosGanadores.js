import React, { useState, useEffect } from 'react';
import './NumerosGanadores.css';
import loteriasService from '../services/loteriasService';

const NumerosGanadores = ({ loterias, setLoterias }) => {
  const [loteriaSeleccionada, setLoteriaSeleccionada] = useState('');
  const [numeroGanador, setNumeroGanador] = useState('');
  const [premio, setPremio] = useState('');
  const [fechaSorteo, setFechaSorteo] = useState(new Date().toISOString().split('T')[0]);
  const [fechaFiltro, setFechaFiltro] = useState('');
  const [guardando, setGuardando] = useState(false);

  const normalizarFecha = (valor) => {
    if (!valor) return null;
    if (valor instanceof Date) {
      const año = valor.getFullYear();
      const mes = String(valor.getMonth() + 1).padStart(2, '0');
      const dia = String(valor.getDate()).padStart(2, '0');
      return `${año}-${mes}-${dia}`;
    }

    const iso = valor.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      return `${iso[1]}-${iso[2]}-${iso[3]}`;
    }

    const partes = valor.split(',');
    const fechaParte = partes[0]?.trim() || '';
    const matchES = fechaParte.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (matchES) {
      const [, dia, mes, año] = matchES;
      return `${año.padStart(4, '0')}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
    }

    const fecha = new Date(valor);
    if (!isNaN(fecha.getTime())) {
      const año = fecha.getFullYear();
      const mes = String(fecha.getMonth() + 1).padStart(2, '0');
      const dia = String(fecha.getDate()).padStart(2, '0');
      return `${año}-${mes}-${dia}`;
    }

    return null;
  };

  // Actualizar lotería seleccionada cuando cambien las loterías
  useEffect(() => {
    if (loterias.length > 0) {
      // Si no hay lotería seleccionada o la seleccionada ya no existe, seleccionar la primera
      const existeSeleccionada = loterias.some(l => l.id.toString() === loteriaSeleccionada);
      if (!loteriaSeleccionada || !existeSeleccionada) {
        setLoteriaSeleccionada(loterias[0].id.toString());
      }
    } else {
      setLoteriaSeleccionada('');
    }
  }, [loterias, loteriaSeleccionada]);

  const agregarNumeroGanador = async () => {
    if (!loteriaSeleccionada) {
      alert('Por favor selecciona una lotería');
      return;
    }

    if (!numeroGanador.trim()) {
      alert('Por favor ingresa el número ganador');
      return;
    }

    const numeroLimpio = numeroGanador.trim().replace(/[^0-9]/g, '');
    if (numeroLimpio.length < 2) {
      alert('El número debe tener al menos 2 dígitos');
      return;
    }

    const premioNum = premio.trim() ? parseFloat(premio.replace(/[^0-9.]/g, '')) || 0 : 0;
    const loteriaActual = loterias.find(l => l.id.toString() === loteriaSeleccionada);
    if (!loteriaActual) {
      alert('No se encontró la lotería seleccionada');
      return;
    }

    const nuevoNumero = {
      id: Date.now().toString(),
      numero: numeroLimpio,
      fecha: fechaSorteo,
      fechaRegistro: new Date().toLocaleString('es-ES'),
      premio: premioNum
    };

    setGuardando(true);
    try {
      const loteriaActualizada = await loteriasService.actualizarLoteria(
        loteriaActual.id,
        {
          numerosGanadores: [...(loteriaActual.numerosGanadores || []), nuevoNumero]
        }
      );

      setLoterias(prev =>
        prev.map(l => (l.id === loteriaActual.id ? loteriaActualizada : l))
      );
      setNumeroGanador('');
      setPremio('');
    } catch (error) {
      alert(error.message || 'No se pudo guardar el número ganador');
    } finally {
      setGuardando(false);
    }
  };

  const eliminarNumeroGanador = async (loteriaId, numeroId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este número ganador?')) {
      return;
    }

    const loteriaActual = loterias.find(l => l.id.toString() === loteriaId.toString());
    if (!loteriaActual) {
      return;
    }

    setGuardando(true);
    try {
      const loteriaActualizada = await loteriasService.actualizarLoteria(
        loteriaActual.id,
        {
          numerosGanadores: (loteriaActual.numerosGanadores || []).filter(
            n => n.id !== numeroId
          )
        }
      );

      setLoterias(prev =>
        prev.map(l => (l.id === loteriaActual.id ? loteriaActualizada : l))
      );
    } catch (error) {
      alert(error.message || 'No se pudo eliminar el número ganador');
    } finally {
      setGuardando(false);
    }
  };

  const loteriaActual = loterias.find(l => l.id.toString() === loteriaSeleccionada);

  return (
    <div className="numeros-ganadores-container">
      <div className="numeros-ganadores-card">
        <h2 className="card-title">Números Ganadores</h2>

        {loterias.length === 0 ? (
          <div className="sin-loterias">
            <p>No hay loterías registradas</p>
            <p className="texto-secundario">Primero agrega una lotería en "Gestionar Loterías"</p>
          </div>
        ) : (
          <>
            <div className="formulario-numero">
              <div className="form-group">
                <label>Lotería:</label>
                <select
                  value={loteriaSeleccionada}
                  onChange={(e) => setLoteriaSeleccionada(e.target.value)}
                  className="select-loteria"
                  disabled={guardando}
                >
                  {loterias.map(loteria => (
                    <option key={loteria.id} value={loteria.id}>
                      {loteria.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Número Ganador:</label>
                <input
                  type="text"
                  value={numeroGanador}
                  onChange={(e) => {
                    const valor = e.target.value.replace(/[^0-9]/g, '');
                    setNumeroGanador(valor);
                  }}
                  placeholder="Ej: 1234"
                  className="input-numero-ganador"
                  maxLength="6"
                  disabled={guardando}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      agregarNumeroGanador();
                    }
                  }}
                />
              </div>

              <div className="form-group">
                <label>Fecha del Sorteo:</label>
                <input
                  type="date"
                  value={fechaSorteo}
                  onChange={(e) => setFechaSorteo(e.target.value)}
                  className="input-fecha-sorteo"
                  disabled={guardando}
                />
              </div>

              <div className="form-group">
                <label>Premio ($):</label>
                <input
                  type="text"
                  value={premio}
                  onChange={(e) => {
                    const valor = e.target.value.replace(/[^0-9.]/g, '');
                    setPremio(valor);
                  }}
                  placeholder="Ej: 1000.00"
                  className="input-premio"
                  disabled={guardando}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      agregarNumeroGanador();
                    }
                  }}
                />
              </div>

              <button className="btn-agregar-ganador" onClick={agregarNumeroGanador} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Agregar Número Ganador'}
              </button>
            </div>

            {loteriaActual && (
              <div className="numeros-ganadores-list">
                <h3>Números Ganadores - {loteriaActual.nombre}</h3>
                       <div className="filtro-fecha-numeros">
                         <label>Filtrar por fecha:</label>
                         <div className="acciones-fecha">
                           <input
                             type="date"
                             value={fechaFiltro}
                             onChange={(e) => setFechaFiltro(e.target.value)}
                           />
                           {fechaFiltro && (
                             <button
                               className="btn-limpiar-fecha"
                               type="button"
                               onClick={() => setFechaFiltro('')}
                             >
                               Mostrar todo
                             </button>
                           )}
                         </div>
                       </div>
                {loteriaActual.numerosGanadores && loteriaActual.numerosGanadores.length > 0 ? (
                  <div className="numeros-list">
                           {loteriaActual.numerosGanadores
                             .filter(numero => {
                               if (!fechaFiltro) return true;
                               const clave = normalizarFecha(numero.fecha);
                               return clave === fechaFiltro;
                             })
                             .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
                             .map(numero => (
                               <div key={numero.id} className="numero-ganador-item">
                                 <div className="numero-ganador-info">
                                   <div className="numero-ganador-header">
                                     <span className="numero-ganador-valor">{numero.numero}</span>
                                     {numero.premio > 0 && (
                                       <span className="numero-ganador-premio">
                                         ${numero.premio.toFixed(2)}
                                       </span>
                                     )}
                                   </div>
                                   <span className="numero-ganador-fecha">
                                     {numero.fecha} - Registrado: {numero.fechaRegistro}
                                   </span>
                                 </div>
                                 <button
                                   className="btn-eliminar-ganador"
                                   onClick={() => eliminarNumeroGanador(loteriaActual.id, numero.id)}
                                   title="Eliminar"
                                   disabled={guardando}
                                 >
                                   ×
                                 </button>
                               </div>
                             ))}
                           {fechaFiltro &&
                             loteriaActual.numerosGanadores.filter(numero => {
                               const clave = normalizarFecha(numero.fecha);
                               return clave === fechaFiltro;
                             }).length === 0 && (
                               <div className="sin-numeros-fecha">
                                 No hay números registrados para esta fecha.
                               </div>
                           )}
                  </div>
                ) : (
                  <div className="sin-numeros">
                    <p>No hay números ganadores registrados para esta lotería</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default NumerosGanadores;
