import React, { useEffect, useMemo, useState } from 'react';
import './GestionLoterias.css';
import { premiosParaFormulario, normalizarPremios } from '../utils/premiosDefault';
import loteriasService from '../services/loteriasService';
import resultadosBotService from '../services/resultadosBotService';

const buildSlotKey = (slot = {}) =>
  [slot.state, slot.game, String(slot.drawName || '').trim().toLowerCase()]
    .filter(Boolean)
    .join(':');

const buildSlotLabel = (slot = {}) => {
  const stateLabel = String(slot.stateName || slot.state || '').trim();
  const drawLabel = String(slot.drawName || '').trim();
  return [stateLabel, drawLabel].filter(Boolean).join(' / ');
};

const GestionLoterias = ({ loterias, setLoterias }) => {
  const [nombreLoteria, setNombreLoteria] = useState('');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [premiosFormulario, setPremiosFormulario] = useState(premiosParaFormulario());
  const [loteriaEditandoId, setLoteriaEditandoId] = useState(null);
  const [usarHoraCierre, setUsarHoraCierre] = useState(false);
  const [horaCierreHora, setHoraCierreHora] = useState('01');
  const [horaCierreMinuto, setHoraCierreMinuto] = useState('00');
  const [horaCierrePeriodo, setHoraCierrePeriodo] = useState('PM');
  const [guardando, setGuardando] = useState(false);
  const [sincronizandoBot, setSincronizandoBot] = useState(false);
  const [botSyncEnabled, setBotSyncEnabled] = useState(false);
  const [slotPick3Key, setSlotPick3Key] = useState('');
  const [slotPick4Key, setSlotPick4Key] = useState('');
  const [botStatus, setBotStatus] = useState({
    healthy: false,
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastError: '',
    lastSummary: null,
    slots: []
  });

  const horasDisponibles = Array.from({ length: 12 }, (_, i) =>
    String(i + 1).padStart(2, '0')
  );
  const minutosDisponibles = Array.from({ length: 60 }, (_, i) =>
    String(i).padStart(2, '0')
  );

  const actualizarPremio = (grupo, campo, valor) => {
    setPremiosFormulario((prev) => ({
      ...prev,
      [grupo]: {
        ...prev[grupo],
        [campo]: valor
      }
    }));
  };

  const configuredSlots = useMemo(() => {
    const unique = new Map();

    for (const loteria of loterias) {
      for (const game of ['pick3', 'pick4']) {
        const slot = loteria?.botSlots?.[game];
        const key = buildSlotKey(slot);
        if (!key) {
          continue;
        }

        unique.set(key, {
          key,
          state: slot.state,
          stateName: slot.stateName || slot.state?.toUpperCase() || '',
          game: slot.game || game,
          drawName: slot.drawName,
          label: buildSlotLabel({
            ...slot,
            stateName: slot.stateName || slot.state?.toUpperCase() || ''
          })
        });
      }
    }

    return Array.from(unique.values());
  }, [loterias]);

  const slotOptions = useMemo(() => {
    const unique = new Map();

    for (const slot of [...(botStatus.slots || []), ...configuredSlots]) {
      const key = slot.key || buildSlotKey(slot);
      if (!key) {
        continue;
      }

      unique.set(key, {
        ...slot,
        key,
        label: slot.label || buildSlotLabel(slot)
      });
    }

    return Array.from(unique.values()).sort((a, b) =>
      (a.label || '').localeCompare(b.label || '', 'es')
    );
  }, [botStatus.slots, configuredSlots]);

  const slotOptionsByGame = useMemo(
    () => ({
      pick3: slotOptions.filter((slot) => slot.game === 'pick3'),
      pick4: slotOptions.filter((slot) => slot.game === 'pick4')
    }),
    [slotOptions]
  );

  const slotLookup = useMemo(() => {
    const map = new Map();
    for (const slot of slotOptions) {
      map.set(slot.key, slot);
    }
    return map;
  }, [slotOptions]);

  const cargarEstadoBot = async () => {
    try {
      const status = await resultadosBotService.getStatus();
      setBotStatus(status);
    } catch (error) {
      setBotStatus((prev) => ({
        ...prev,
        healthy: false,
        lastError: error.message || 'No se pudo consultar el bot de resultados'
      }));
    }
  };

  useEffect(() => {
    cargarEstadoBot();
  }, []);

  const resetFormulario = () => {
    setNombreLoteria('');
    setPremiosFormulario(premiosParaFormulario());
    setLoteriaEditandoId(null);
    setUsarHoraCierre(false);
    setHoraCierreHora('01');
    setHoraCierreMinuto('00');
    setHoraCierrePeriodo('PM');
    setBotSyncEnabled(false);
    setSlotPick3Key('');
    setSlotPick4Key('');
  };

  const obtenerHoraCierreNormalizada = () => {
    if (!usarHoraCierre) return '';
    if (!horaCierreHora) return '';
    return `${horaCierreHora}:${horaCierreMinuto} ${horaCierrePeriodo}`;
  };

  const parsearHoraAlFormulario = (valor) => {
    if (!valor) return null;
    const limpio = valor.trim();
    const match12 = limpio.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match12) {
      const hora = Math.min(Math.max(parseInt(match12[1], 10), 1), 12);
      return {
        hora: String(hora).padStart(2, '0'),
        minuto: match12[2],
        periodo: match12[3].toUpperCase()
      };
    }

    const match24 = limpio.match(/^(\d{1,2}):(\d{2})$/);
    if (match24) {
      let hora = parseInt(match24[1], 10);
      const minuto = match24[2];
      let periodo = hora >= 12 ? 'PM' : 'AM';
      hora = hora % 12;
      if (hora === 0) hora = 12;
      return {
        hora: String(hora).padStart(2, '0'),
        minuto,
        periodo
      };
    }

    return null;
  };

  const formatearMonto = (valor) => {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return valor;
    return numero % 1 === 0 ? numero.toString() : numero.toFixed(2);
  };

  const formatearHoraCierre = (valor) => {
    if (!valor) return '';
    const horaNormalizada = parsearHoraAlFormulario(valor);
    if (!horaNormalizada) return valor;
    return `${horaNormalizada.hora}:${horaNormalizada.minuto} ${horaNormalizada.periodo}`;
  };

  const formatearFechaSync = (valor) => {
    if (!valor) return 'Sin registro';
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return String(valor);
    return fecha.toLocaleString('es-ES');
  };

  const manejarToggleFormulario = () => {
    if (mostrarFormulario) {
      resetFormulario();
      setMostrarFormulario(false);
    } else {
      resetFormulario();
      setMostrarFormulario(true);
    }
  };

  const construirBotSlotsPayload = () => {
    if (!botSyncEnabled) {
      return {
        pick3: { state: '', drawName: '', game: 'pick3' },
        pick4: { state: '', drawName: '', game: 'pick4' }
      };
    }

    const pick3 = slotLookup.get(slotPick3Key);
    const pick4 = slotLookup.get(slotPick4Key);

    return {
      pick3: pick3
        ? {
            state: pick3.state,
            drawName: pick3.drawName,
            game: 'pick3'
          }
        : { state: '', drawName: '', game: 'pick3' },
      pick4: pick4
        ? {
            state: pick4.state,
            drawName: pick4.drawName,
            game: 'pick4'
          }
        : { state: '', drawName: '', game: 'pick4' }
    };
  };

  const guardarLoteria = async () => {
    if (!nombreLoteria.trim()) {
      alert('Por favor ingresa un nombre para la loteria');
      return;
    }

    const premiosNormalizados = normalizarPremios(premiosFormulario);
    const horaCierreNormalizada = obtenerHoraCierreNormalizada();
    const botSlots = construirBotSlotsPayload();

    setGuardando(true);

    try {
      if (loteriaEditandoId) {
        const loteriaActual = loterias.find((l) => l.id === loteriaEditandoId);
        const loteriaActualizada = await loteriasService.actualizarLoteria(
          loteriaEditandoId,
          {
            nombre: nombreLoteria.trim(),
            premios: premiosNormalizados,
            horaCierre: horaCierreNormalizada,
            numerosGanadores: loteriaActual?.numerosGanadores || [],
            botSyncEnabled,
            botSlots,
            botSyncStatus: loteriaActual?.botSyncStatus || {}
          }
        );

        setLoterias((prev) =>
          prev.map((l) => (l.id === loteriaEditandoId ? loteriaActualizada : l))
        );
      } else {
        const nuevaLoteria = await loteriasService.crearLoteria({
          nombre: nombreLoteria.trim(),
          premios: premiosNormalizados,
          horaCierre: horaCierreNormalizada,
          numerosGanadores: [],
          botSyncEnabled,
          botSlots
        });

        setLoterias((prev) => [...prev, nuevaLoteria]);
      }

      resetFormulario();
      setMostrarFormulario(false);
    } catch (error) {
      alert(error.message || 'No se pudo guardar la loteria');
    } finally {
      setGuardando(false);
    }
  };

  const sincronizarBotAhora = async () => {
    setSincronizandoBot(true);
    try {
      const response = await resultadosBotService.syncNow();
      setBotStatus(response.status);
      const loteriasActualizadas = await loteriasService.obtenerLoterias();
      setLoterias(loteriasActualizadas);
    } catch (error) {
      alert(error.message || 'No se pudo sincronizar con el bot');
    } finally {
      setSincronizandoBot(false);
    }
  };

  const eliminarLoteria = async (id) => {
    if (window.confirm('Estas seguro de que quieres eliminar esta loteria?')) {
      setGuardando(true);
      try {
        await loteriasService.eliminarLoteria(id);
        setLoterias((prev) => prev.filter((l) => l.id !== id));
      } catch (error) {
        alert(error.message || 'No se pudo eliminar la loteria');
      } finally {
        setGuardando(false);
      }
    }
  };

  const editarLoteria = (loteria) => {
    setNombreLoteria(loteria.nombre);
    setPremiosFormulario(premiosParaFormulario(loteria.premios));
    setLoteriaEditandoId(loteria.id);
    setBotSyncEnabled(Boolean(loteria.botSyncEnabled));
    setSlotPick3Key(buildSlotKey(loteria.botSlots?.pick3));
    setSlotPick4Key(buildSlotKey(loteria.botSlots?.pick4));
    const horaParseada = parsearHoraAlFormulario(loteria.horaCierre);
    if (horaParseada) {
      setUsarHoraCierre(true);
      setHoraCierreHora(horaParseada.hora);
      setHoraCierreMinuto(horaParseada.minuto);
      setHoraCierrePeriodo(horaParseada.periodo);
    } else {
      setUsarHoraCierre(false);
      setHoraCierreHora('01');
      setHoraCierreMinuto('00');
      setHoraCierrePeriodo('PM');
    }
    setMostrarFormulario(true);
  };

  const cancelarEdicion = () => {
    resetFormulario();
  };

  return (
    <div className="gestion-loterias-container">
      <div className="gestion-loterias-card">
        <div className="gestion-header">
          <h2 className="card-title">Gestionar loterias</h2>
          <div className="gestion-header-actions">
            <button
              className="btn-sync-bot"
              onClick={sincronizarBotAhora}
              disabled={sincronizandoBot || guardando}
              type="button"
            >
              {sincronizandoBot ? 'Sincronizando...' : 'Sincronizar resultados ahora'}
            </button>
            <button
              className="btn-agregar-loteria"
              onClick={manejarToggleFormulario}
              disabled={guardando}
              type="button"
            >
              {mostrarFormulario ? 'Cerrar formulario' : '+ Agregar loteria'}
            </button>
          </div>
        </div>

        <div className={`bot-status-banner ${botStatus.healthy ? 'healthy' : 'error'}`}>
          <div className="bot-status-copy">
            <strong>
              {botStatus.healthy ? 'Bot de resultados disponible' : 'Bot de resultados sin conexion'}
            </strong>
            <span>
              Ultimo intento: {formatearFechaSync(botStatus.lastAttemptAt)} | Ultima sync correcta:{' '}
              {formatearFechaSync(botStatus.lastSuccessAt)}
            </span>
            {botStatus.lastError && <small>{botStatus.lastError}</small>}
          </div>
        </div>

        {mostrarFormulario && (
          <div className="formulario-agregar">
            {loteriaEditandoId && (
              <div className="mensaje-edicion">Editando loteria existente</div>
            )}

            <div className="formulario-seccion">
              <label className="label-general">Nombre de la loteria</label>
              <input
                type="text"
                value={nombreLoteria}
                onChange={(e) => setNombreLoteria(e.target.value)}
                placeholder="Ej: Connecticut AM"
                className="input-nombre-loteria"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    guardarLoteria();
                  }
                }}
                autoFocus
              />
            </div>

            <div className="formulario-seccion">
              <label className="label-general">Hora de cierre</label>
              <label className="toggle-hora">
                <input
                  type="checkbox"
                  checked={usarHoraCierre}
                  onChange={(e) => {
                    const activo = e.target.checked;
                    setUsarHoraCierre(activo);
                    if (activo && !horaCierreHora) {
                      setHoraCierreHora('01');
                      setHoraCierreMinuto('00');
                      setHoraCierrePeriodo('PM');
                    }
                  }}
                />
                <span>Establecer hora de cierre</span>
              </label>
              <div
                className={`selector-hora ${usarHoraCierre ? '' : 'selector-hora-desactivado'}`}
              >
                <select
                  value={horaCierreHora}
                  onChange={(e) => setHoraCierreHora(e.target.value)}
                  disabled={!usarHoraCierre}
                >
                  {horasDisponibles.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <span className="separator">:</span>
                <select
                  value={horaCierreMinuto}
                  onChange={(e) => setHoraCierreMinuto(e.target.value)}
                  disabled={!usarHoraCierre}
                >
                  {minutosDisponibles.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <select
                  value={horaCierrePeriodo}
                  onChange={(e) => setHoraCierrePeriodo(e.target.value)}
                  disabled={!usarHoraCierre}
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
                {usarHoraCierre && (
                  <button
                    type="button"
                    className="btn-limpiar-hora"
                    onClick={() => setUsarHoraCierre(false)}
                  >
                    Quitar hora
                  </button>
                )}
              </div>
              <small className="ayuda-hora">
                Define la hora limite para generar tickets de esta loteria.
              </small>
            </div>

            <div className="bot-sync-config">
              <div className="bot-sync-header">
                <div>
                  <h4>Resultados desde bot</h4>
                  <p>Mapea esta loteria con el bot de Railway para Pick 3 y Pick 4.</p>
                </div>
                <label className="bot-sync-toggle">
                  <input
                    type="checkbox"
                    checked={botSyncEnabled}
                    onChange={(e) => setBotSyncEnabled(e.target.checked)}
                  />
                  <span>Sincronizar desde bot</span>
                </label>
              </div>

              <div className="bot-slot-grid">
                <div className="formulario-seccion">
                  <label className="label-general">Slot Pick 3</label>
                  <select
                    value={slotPick3Key}
                    onChange={(e) => setSlotPick3Key(e.target.value)}
                    disabled={!botSyncEnabled}
                    className="select-bot-slot"
                  >
                    <option value="">Sin slot</option>
                    {slotOptionsByGame.pick3.map((slot) => (
                      <option key={slot.key} value={slot.key}>
                        {slot.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="formulario-seccion">
                  <label className="label-general">Slot Pick 4</label>
                  <select
                    value={slotPick4Key}
                    onChange={(e) => setSlotPick4Key(e.target.value)}
                    disabled={!botSyncEnabled}
                    className="select-bot-slot"
                  >
                    <option value="">Sin slot</option>
                    {slotOptionsByGame.pick4.map((slot) => (
                      <option key={slot.key} value={slot.key}>
                        {slot.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="formulario-premios">
              <div className="premios-col">
                <h4>Premios Pick 2 (por $1)</h4>
                <div className="grid-premios grid-premios-pick2">
                  <label>Primera</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={premiosFormulario.pick2.straightPrimera}
                    onChange={(e) =>
                      actualizarPremio('pick2', 'straightPrimera', e.target.value)
                    }
                  />

                  <label>Segunda</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={premiosFormulario.pick2.straightSegunda}
                    onChange={(e) =>
                      actualizarPremio('pick2', 'straightSegunda', e.target.value)
                    }
                  />

                  <label>Tercera</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={premiosFormulario.pick2.straightTercera}
                    onChange={(e) =>
                      actualizarPremio('pick2', 'straightTercera', e.target.value)
                    }
                  />
                </div>
              </div>

              <div className="premios-col">
                <h4>Premios Singulation (por $1)</h4>
                <div className="grid-premios">
                  <label>Straight</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={premiosFormulario.singulation.straight}
                    onChange={(e) =>
                      actualizarPremio('singulation', 'straight', e.target.value)
                    }
                  />
                </div>
              </div>

              <div className="premios-col">
                <h4>Premios Pick 3 (por $1)</h4>
                <div className="grid-premios">
                  <label>Straight</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={premiosFormulario.pick3.straight}
                    onChange={(e) => actualizarPremio('pick3', 'straight', e.target.value)}
                  />

                  <label>Triples</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={premiosFormulario.pick3.triple}
                    onChange={(e) => actualizarPremio('pick3', 'triple', e.target.value)}
                  />

                  <label>Box (con par)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={premiosFormulario.pick3.boxPar}
                    onChange={(e) => actualizarPremio('pick3', 'boxPar', e.target.value)}
                  />

                  <label>Box (todos diferentes)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={premiosFormulario.pick3.boxTodosDiferentes}
                    onChange={(e) =>
                      actualizarPremio('pick3', 'boxTodosDiferentes', e.target.value)
                    }
                  />
                </div>
              </div>

              <div className="premios-col">
                <h4>Premios Pick 4 (por $1)</h4>
                <div className="grid-premios">
                  <label>Straight</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={premiosFormulario.pick4.straight}
                    onChange={(e) => actualizarPremio('pick4', 'straight', e.target.value)}
                  />

                  <label>Straight (Cuadruples)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={premiosFormulario.pick4.cuadrupleStraight}
                    onChange={(e) =>
                      actualizarPremio('pick4', 'cuadrupleStraight', e.target.value)
                    }
                  />

                  <label>Box (Cuadruple)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={premiosFormulario.pick4.boxCuadruple}
                    onChange={(e) =>
                      actualizarPremio('pick4', 'boxCuadruple', e.target.value)
                    }
                  />

                  <label>Box (3 iguales)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={premiosFormulario.pick4.boxTresIguales}
                    onChange={(e) =>
                      actualizarPremio('pick4', 'boxTresIguales', e.target.value)
                    }
                  />

                  <label>Box (2 pares)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={premiosFormulario.pick4.boxDosPares}
                    onChange={(e) =>
                      actualizarPremio('pick4', 'boxDosPares', e.target.value)
                    }
                  />

                  <label>Box (1 par)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={premiosFormulario.pick4.boxUnPar}
                    onChange={(e) => actualizarPremio('pick4', 'boxUnPar', e.target.value)}
                  />

                  <label>Box (todos diferentes)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={premiosFormulario.pick4.boxTodosDiferentes}
                    onChange={(e) =>
                      actualizarPremio('pick4', 'boxTodosDiferentes', e.target.value)
                    }
                  />
                </div>
              </div>
            </div>

            <div className="acciones-formulario">
              {loteriaEditandoId && (
                <button
                  type="button"
                  className="btn-cancelar-edicion"
                  onClick={cancelarEdicion}
                >
                  Cancelar edicion
                </button>
              )}
              <button className="btn-guardar-loteria" onClick={guardarLoteria} type="button">
                {guardando
                  ? 'Guardando...'
                  : loteriaEditandoId
                    ? 'Actualizar loteria'
                    : 'Guardar loteria'}
              </button>
            </div>
          </div>
        )}

        {loterias.length === 0 ? (
          <div className="sin-loterias">
            <p>No hay loterias registradas</p>
            <p className="texto-secundario">Agrega una loteria para comenzar</p>
          </div>
        ) : (
          <div className="loterias-list">
            {loterias.map((loteria) => {
              const premios = normalizarPremios(loteria.premios);
              const pick3Slot = loteria.botSlots?.pick3;
              const pick4Slot = loteria.botSlots?.pick4;

              return (
                <div key={loteria.id} className="loteria-item">
                  <div className="loteria-info">
                    <h3 className="loteria-nombre">{loteria.nombre}</h3>
                    <span className="loteria-fecha">Creada: {loteria.fechaCreacion}</span>
                    {loteria.horaCierre && (
                      <span className="loteria-hora">
                        Cierra a las {formatearHoraCierre(loteria.horaCierre)}
                      </span>
                    )}
                    <span className="loteria-numeros">
                      {loteria.numerosGanadores?.length || 0} numeros ganadores registrados
                    </span>

                    <div className="bot-mapping-summary">
                      <strong>Bot:</strong>{' '}
                      {loteria.botSyncEnabled ? 'Activo' : 'Sin sincronizacion'}
                      {loteria.botSyncEnabled && (
                        <div className="bot-mapping-lines">
                          <span>
                            Pick 3:{' '}
                            {buildSlotKey(pick3Slot)
                              ? buildSlotLabel({
                                  ...pick3Slot,
                                  stateName:
                                    pick3Slot.stateName || pick3Slot.state?.toUpperCase()
                                })
                              : 'Sin slot'}
                          </span>
                          <span>
                            Pick 4:{' '}
                            {buildSlotKey(pick4Slot)
                              ? buildSlotLabel({
                                  ...pick4Slot,
                                  stateName:
                                    pick4Slot.stateName || pick4Slot.state?.toUpperCase()
                                })
                              : 'Sin slot'}
                          </span>
                          <span>
                            Ultima sync:{' '}
                            {formatearFechaSync(loteria.botSyncStatus?.lastSuccessAt)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="premios-resumen">
                      <div>
                        <strong>Pick 2:</strong> 1ra ${formatearMonto(premios.pick2.straightPrimera)} - 2da $
                        {formatearMonto(premios.pick2.straightSegunda)} - 3ra $
                        {formatearMonto(premios.pick2.straightTercera)}
                      </div>
                      <div>
                        <strong>Singulation:</strong> Straight $
                        {formatearMonto(premios.singulation.straight)}
                      </div>
                      <div>
                        <strong>Pick 3:</strong> Straight ${formatearMonto(premios.pick3.straight)} - Triples $
                        {formatearMonto(premios.pick3.triple)} - Box Par $
                        {formatearMonto(premios.pick3.boxPar)} - Box Todos Diferentes $
                        {formatearMonto(premios.pick3.boxTodosDiferentes)}
                      </div>
                      <div>
                        <strong>Pick 4:</strong> Straight ${formatearMonto(premios.pick4.straight)} - Straight Cuadruple $
                        {formatearMonto(premios.pick4.cuadrupleStraight)} - Box Cuadruple $
                        {formatearMonto(premios.pick4.boxCuadruple)} - Box 3 iguales $
                        {formatearMonto(premios.pick4.boxTresIguales)} - Box 2 pares $
                        {formatearMonto(premios.pick4.boxDosPares)} - Box 1 par $
                        {formatearMonto(premios.pick4.boxUnPar)} - Box Todos Diferentes $
                        {formatearMonto(premios.pick4.boxTodosDiferentes)}
                      </div>
                    </div>
                  </div>
                  <div className="loteria-acciones">
                    <button
                      className="btn-editar-loteria"
                      onClick={() => editarLoteria(loteria)}
                      title="Editar loteria"
                      disabled={guardando}
                      type="button"
                    >
                      Editar
                    </button>
                    <button
                      className="btn-eliminar-loteria"
                      onClick={() => eliminarLoteria(loteria.id)}
                      title="Eliminar loteria"
                      disabled={guardando}
                      type="button"
                    >
                      x
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default GestionLoterias;
