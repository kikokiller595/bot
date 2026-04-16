import React, { useEffect, useMemo, useState } from 'react';
import './NumerosGanadores.css';
import loteriasService from '../services/loteriasService';

const DRAW_SUFFIXES = new Set(['am', 'pm', 'eve', 'midday', 'mid-day', 'night']);

const capitalizarPalabra = (valor = '') =>
  valor.charAt(0).toUpperCase() + valor.slice(1).toLowerCase();

const obtenerEstadoLoteria = (nombre = '') => {
  const tokens = String(nombre)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const baseTokens = tokens.filter(
    (token) => !DRAW_SUFFIXES.has(String(token).toLowerCase())
  );

  if (baseTokens.length === 0) {
    return 'Especiales';
  }

  return baseTokens.map(capitalizarPalabra).join(' ');
};

const ordenarPorFechaDesc = (a, b) => new Date(b.fecha) - new Date(a.fecha);

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
    .sort(ordenarPorFechaDesc);

  const loteriasPorEstado = useMemo(() => {
    if (!soloLectura) {
      return [];
    }

    const grupos = new Map();

    loterias
      .slice()
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      .forEach((loteria) => {
        const todosLosNumeros = (loteria.numerosGanadores || [])
          .slice()
          .sort(ordenarPorFechaDesc);

        let numerosVisibles = [];
        let fechaReferencia = '';

        if (fechaFiltro) {
          numerosVisibles = todosLosNumeros.filter(
            (numero) => normalizarFecha(numero.fecha) === fechaFiltro
          );
          fechaReferencia = fechaFiltro;
        } else if (todosLosNumeros.length > 0) {
          fechaReferencia = normalizarFecha(todosLosNumeros[0].fecha) || '';
          numerosVisibles = fechaReferencia
            ? todosLosNumeros.filter(
                (numero) => normalizarFecha(numero.fecha) === fechaReferencia
              )
            : [todosLosNumeros[0]];
        }

        const estado = obtenerEstadoLoteria(loteria.nombre);
        const grupoActual = grupos.get(estado) || [];

        grupoActual.push({
          id: loteria.id,
          nombre: loteria.nombre,
          horaCierre: loteria.horaCierre || '',
          fechaReferencia,
          numerosVisibles
        });

        grupos.set(estado, grupoActual);
      });

    return Array.from(grupos.entries())
      .sort(([estadoA], [estadoB]) => {
        if (estadoA === 'Especiales') return 1;
        if (estadoB === 'Especiales') return -1;
        return estadoA.localeCompare(estadoB, 'es');
      })
      .map(([estado, items]) => ({ estado, items }));
  }, [fechaFiltro, loterias, soloLectura]);

  return (
    <div className="numeros-ganadores-container">
      <div className="numeros-ganadores-card">
        <div className="numeros-ganadores-head">
          <h2 className="card-title">Numeros ganadores</h2>
          <p className="numeros-ganadores-copy">
            {soloLectura
              ? 'Consulta los resultados cargados por estado, loteria y fecha.'
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

            {soloLectura ? (
              <div className="numeros-ganadores-resumen">
                <div className="filtro-fecha-numeros filtro-fecha-global">
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
                        Mostrar ultimo resultado
                      </button>
                    )}
                  </div>
                </div>

                <div className="estados-ganadores-lista">
                  {loteriasPorEstado.map((grupo) => (
                    <section key={grupo.estado} className="estado-ganador-bloque">
                      <div className="estado-ganador-head">
                        <h3>{grupo.estado}</h3>
                        <span>{grupo.items.length} loterias</span>
                      </div>

                      <div className="estado-ganador-grid">
                        {grupo.items.map((item) => (
                          <article
                            key={item.id}
                            className={`loteria-resultado-card ${
                              item.numerosVisibles.length === 0 ? 'sin-resultado' : ''
                            }`}
                          >
                            <div className="loteria-resultado-head">
                              <div className="loteria-resultado-copy">
                                <strong>{item.nombre}</strong>
                                <span>
                                  {item.horaCierre
                                    ? `Cierre ${item.horaCierre}`
                                    : 'Sin hora de cierre'}
                                </span>
                              </div>
                              <span className="loteria-resultado-fecha">
                                {item.fechaReferencia || 'Sin fecha cargada'}
                              </span>
                            </div>

                            {item.numerosVisibles.length > 0 ? (
                              <div className="loteria-resultado-numeros">
                                {item.numerosVisibles.map((numero) => (
                                  <div key={numero.id} className="resultado-chip">
                                    <span className="resultado-chip-numero">{numero.numero}</span>
                                    {Number(numero.premio) > 0 && (
                                      <span className="resultado-chip-premio">
                                        ${Number(numero.premio).toFixed(2)}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="loteria-resultado-empty">
                                {fechaFiltro
                                  ? 'No hay resultado para esta fecha.'
                                  : 'Todavia no tiene numeros ganadores cargados.'}
                              </p>
                            )}
                          </article>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            ) : (
              loteriaActual && (
                <div className="numeros-ganadores-list">
                  <h3>Numeros ganadores - {loteriaActual.nombre}</h3>

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

                          <button
                            className="btn-eliminar-ganador"
                            onClick={() => eliminarNumeroGanador(loteriaActual.id, numero.id)}
                            title="Eliminar"
                            disabled={guardando}
                          >
                            x
                          </button>
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
              )
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default NumerosGanadores;
