import React, { useEffect, useState } from 'react';
import './NumerosGanadores.css';
import loteriasService from '../services/loteriasService';

const NumerosGanadores = ({
  loterias = [],
  setLoterias = () => {},
  soloLectura = false
}) => {
  const [loteriaSeleccionada, setLoteriaSeleccionada] = useState('');
  const [numeroGanador, setNumeroGanador] = useState('');
  const [premio, setPremio] = useState('');
  const [fechaSorteo, setFechaSorteo] = useState(new Date().toISOString().split('T')[0]);
  const [fechaFiltro, setFechaFiltro] = useState('');
  const [guardando, setGuardando] = useState(false);

  const normalizarFecha = (valor) => {
    if (!valor) return null;

    if (valor instanceof Date) {
      const anio = valor.getFullYear();
      const mes = String(valor.getMonth() + 1).padStart(2, '0');
      const dia = String(valor.getDate()).padStart(2, '0');
      return `${anio}-${mes}-${dia}`;
    }

    const texto = String(valor);
    const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      return `${iso[1]}-${iso[2]}-${iso[3]}`;
    }

    const fecha = new Date(texto);
    if (!Number.isNaN(fecha.getTime())) {
      const anio = fecha.getFullYear();
      const mes = String(fecha.getMonth() + 1).padStart(2, '0');
      const dia = String(fecha.getDate()).padStart(2, '0');
      return `${anio}-${mes}-${dia}`;
    }

    const formatoLocal = texto.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (formatoLocal) {
      const [, dia, mes, anio] = formatoLocal;
      return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
    }

    return null;
  };

  useEffect(() => {
    if (loterias.length === 0) {
      setLoteriaSeleccionada('');
      return;
    }

    const existeSeleccionada = loterias.some(
      (loteria) => String(loteria.id) === String(loteriaSeleccionada)
    );

    if (!loteriaSeleccionada || !existeSeleccionada) {
      setLoteriaSeleccionada(String(loterias[0].id));
    }
  }, [loterias, loteriaSeleccionada]);

  const agregarNumeroGanador = async () => {
    if (soloLectura) {
      return;
    }

    if (!loteriaSeleccionada) {
      alert('Por favor selecciona una loteria');
      return;
    }

    if (!numeroGanador.trim()) {
      alert('Por favor ingresa el numero ganador');
      return;
    }

    const numeroLimpio = numeroGanador.trim().replace(/[^0-9]/g, '');
    if (numeroLimpio.length < 2) {
      alert('El numero debe tener al menos 2 digitos');
      return;
    }

    const premioNum = premio.trim()
      ? parseFloat(premio.replace(/[^0-9.]/g, '')) || 0
      : 0;
    const loteriaActual = loterias.find(
      (loteria) => String(loteria.id) === String(loteriaSeleccionada)
    );

    if (!loteriaActual) {
      alert('No se encontro la loteria seleccionada');
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
      const loteriaActualizada = await loteriasService.actualizarLoteria(loteriaActual.id, {
        numerosGanadores: [...(loteriaActual.numerosGanadores || []), nuevoNumero]
      });

      setLoterias((prev) =>
        prev.map((loteria) =>
          loteria.id === loteriaActual.id ? loteriaActualizada : loteria
        )
      );
      setNumeroGanador('');
      setPremio('');
    } catch (error) {
      alert(error.message || 'No se pudo guardar el numero ganador');
    } finally {
      setGuardando(false);
    }
  };

  const eliminarNumeroGanador = async (loteriaId, numeroId) => {
    if (soloLectura) {
      return;
    }

    if (!window.confirm('Estas seguro de que quieres eliminar este numero ganador?')) {
      return;
    }

    const loteriaActual = loterias.find(
      (loteria) => String(loteria.id) === String(loteriaId)
    );
    if (!loteriaActual) {
      return;
    }

    setGuardando(true);
    try {
      const loteriaActualizada = await loteriasService.actualizarLoteria(loteriaActual.id, {
        numerosGanadores: (loteriaActual.numerosGanadores || []).filter(
          (numero) => numero.id !== numeroId
        )
      });

      setLoterias((prev) =>
        prev.map((loteria) =>
          loteria.id === loteriaActual.id ? loteriaActualizada : loteria
        )
      );
    } catch (error) {
      alert(error.message || 'No se pudo eliminar el numero ganador');
    } finally {
      setGuardando(false);
    }
  };

  const loteriaActual = loterias.find(
    (loteria) => String(loteria.id) === String(loteriaSeleccionada)
  );

  const numerosFiltrados = (loteriaActual?.numerosGanadores || [])
    .filter((numero) => {
      if (!fechaFiltro) return true;
      return normalizarFecha(numero.fecha) === fechaFiltro;
    })
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  return (
    <div className="numeros-ganadores-container">
      <div className="numeros-ganadores-card">
        <div className="numeros-ganadores-head">
          <h2 className="card-title">Numeros ganadores</h2>
          <p className="numeros-ganadores-copy">
            {soloLectura
              ? 'Consulta los resultados cargados por loteria y por fecha.'
              : 'Carga, revisa y administra los resultados ganadores de cada loteria.'}
          </p>
        </div>

        {loterias.length === 0 ? (
          <div className="sin-loterias">
            <p>No hay loterias registradas</p>
            <p className="texto-secundario">
              Primero agrega una loteria en Gestionar Loterias.
            </p>
          </div>
        ) : (
          <>
            {!soloLectura && (
              <div className="formulario-numero">
                <div className="form-group">
                  <label>Loteria:</label>
                  <select
                    value={loteriaSeleccionada}
                    onChange={(e) => setLoteriaSeleccionada(e.target.value)}
                    className="select-loteria"
                    disabled={guardando}
                  >
                    {loterias.map((loteria) => (
                      <option key={loteria.id} value={loteria.id}>
                        {loteria.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Numero ganador:</label>
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
                  <label>Fecha del sorteo:</label>
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

                <button
                  className="btn-agregar-ganador"
                  onClick={agregarNumeroGanador}
                  disabled={guardando}
                >
                  {guardando ? 'Guardando...' : 'Agregar numero ganador'}
                </button>
              </div>
            )}

            {loteriaActual && (
              <div className="numeros-ganadores-list">
                <h3>Numeros ganadores - {loteriaActual.nombre}</h3>

                {soloLectura && (
                  <div className="numeros-ganadores-toolbar">
                    <div className="form-group">
                      <label>Loteria:</label>
                      <select
                        value={loteriaSeleccionada}
                        onChange={(e) => setLoteriaSeleccionada(e.target.value)}
                        className="select-loteria"
                      >
                        {loterias.map((loteria) => (
                          <option key={loteria.id} value={loteria.id}>
                            {loteria.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

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

                {numerosFiltrados.length > 0 ? (
                  <div className="numeros-list">
                    {numerosFiltrados.map((numero) => (
                      <div key={numero.id} className="numero-ganador-item">
                        <div className="numero-ganador-info">
                          <div className="numero-ganador-header">
                            <span className="numero-ganador-valor">{numero.numero}</span>
                            {Number(numero.premio) > 0 && (
                              <span className="numero-ganador-premio">
                                ${Number(numero.premio).toFixed(2)}
                              </span>
                            )}
                          </div>
                          <span className="numero-ganador-fecha">
                            {numero.fecha} - Registrado: {numero.fechaRegistro}
                          </span>
                        </div>

                        {!soloLectura && (
                          <button
                            className="btn-eliminar-ganador"
                            onClick={() => eliminarNumeroGanador(loteriaActual.id, numero.id)}
                            title="Eliminar"
                            disabled={guardando}
                          >
                            x
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="sin-numeros">
                    <p>
                      {fechaFiltro
                        ? 'No hay numeros registrados para esa fecha.'
                        : 'No hay numeros ganadores registrados para esta loteria.'}
                    </p>
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
