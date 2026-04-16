import React, { useEffect, useMemo, useState } from 'react';
import './GestionPuntosVenta.css';
import puntosVentaService from '../services/puntosVentaService';

const formularioInicial = {
  username: '',
  password: '',
  ubicacion: '',
  telefono: '',
  tipo: '',
  porcentajeSocio: '0',
  activo: true
};

const ordenarTerminales = (lista = []) =>
  [...lista].sort((a, b) =>
    String(a.username || a.nombre || '').localeCompare(String(b.username || b.nombre || ''))
  );

function GestionPuntosVenta({ puntosVentaExternos = null, onPuntosVentaChange = null }) {
  const [puntosVenta, setPuntosVenta] = useState([]);
  const [formulario, setFormulario] = useState(formularioInicial);
  const [editandoId, setEditandoId] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (Array.isArray(puntosVentaExternos)) {
      setPuntosVenta(ordenarTerminales(puntosVentaExternos));
      setCargando(false);
      return undefined;
    }

    const cargar = async () => {
      try {
        setCargando(true);
        const data = await puntosVentaService.getPuntosVenta();
        setPuntosVenta(ordenarTerminales(data));
      } catch (error) {
        alert(error.message || 'No se pudieron cargar las terminales');
      } finally {
        setCargando(false);
      }
    };

    cargar();
    return undefined;
  }, [puntosVentaExternos]);

  const totalActivas = useMemo(
    () => puntosVenta.filter((puntoVenta) => puntoVenta.activo).length,
    [puntosVenta]
  );

  const actualizarCampo = (campo, valor) => {
    setFormulario((prev) => ({
      ...prev,
      [campo]: valor
    }));
  };

  const resetFormulario = () => {
    setFormulario(formularioInicial);
    setEditandoId(null);
    setMostrarFormulario(false);
  };

  const construirPayload = () => ({
    username: formulario.username.trim().toLowerCase(),
    password: formulario.password.trim() || undefined,
    ubicacion: formulario.ubicacion.trim(),
    telefono: formulario.telefono.trim(),
    tipo: formulario.tipo.trim(),
    porcentajeSocio: Number(formulario.porcentajeSocio) || 0,
    activo: formulario.activo,
    nombre: formulario.username.trim().toLowerCase(),
    responsable: formulario.username.trim().toLowerCase()
  });

  const guardar = async () => {
    if (!formulario.username.trim()) {
      alert('Debes indicar un nombre de usuario para la terminal');
      return;
    }

    if (formulario.username.trim().length < 3) {
      alert('El nombre de usuario debe tener al menos 3 caracteres');
      return;
    }

    if (!editandoId && !formulario.password.trim()) {
      alert('Debes definir una contrasena para la terminal');
      return;
    }

    if (formulario.password.trim() && formulario.password.trim().length < 6) {
      alert('La contrasena debe tener al menos 6 caracteres');
      return;
    }

    if (!formulario.ubicacion.trim()) {
      alert('Debes indicar la direccion del punto de venta');
      return;
    }

    if (!formulario.telefono.trim()) {
      alert('Debes indicar el numero de cel del punto de venta');
      return;
    }

    if (!formulario.tipo.trim()) {
      alert('Debes indicar el tipo de punto de venta');
      return;
    }

    const porcentajeSocio = Number(formulario.porcentajeSocio);
    if (!Number.isFinite(porcentajeSocio) || porcentajeSocio < 0 || porcentajeSocio > 100) {
      alert('Debes indicar un porcentaje del socio valido entre 0 y 100');
      return;
    }

    setGuardando(true);

    try {
      const payload = construirPayload();

      if (editandoId) {
        const actualizado = await puntosVentaService.updatePuntoVenta(editandoId, payload);
        setPuntosVenta((prev) => {
          const nuevaLista = ordenarTerminales(
            prev.map((item) => (item.id === editandoId ? actualizado : item))
          );
          onPuntosVentaChange?.(nuevaLista);
          return nuevaLista;
        });
      } else {
        const creado = await puntosVentaService.createPuntoVenta(payload);
        setPuntosVenta((prev) => {
          const nuevaLista = ordenarTerminales([...prev, creado]);
          onPuntosVentaChange?.(nuevaLista);
          return nuevaLista;
        });
      }

      resetFormulario();
    } catch (error) {
      alert(error.message || 'No se pudo guardar la terminal');
    } finally {
      setGuardando(false);
    }
  };

  const editar = (puntoVenta) => {
    setFormulario({
      username: puntoVenta.username || puntoVenta.nombre || '',
      password: '',
      ubicacion: puntoVenta.ubicacion || '',
      telefono: puntoVenta.telefono || '',
      tipo: puntoVenta.tipo || '',
      porcentajeSocio: String(Number(puntoVenta.porcentajeSocio) || 0),
      activo: typeof puntoVenta.activo === 'boolean' ? puntoVenta.activo : true
    });
    setEditandoId(puntoVenta.id);
    setMostrarFormulario(true);
  };

  const desactivar = async (id) => {
    if (!window.confirm('Deseas desactivar esta terminal de venta?')) {
      return;
    }

    try {
      await puntosVentaService.deletePuntoVenta(id);
      setPuntosVenta((prev) => {
        const nuevaLista = prev.map((item) => (item.id === id ? { ...item, activo: false } : item));
        onPuntosVentaChange?.(nuevaLista);
        return nuevaLista;
      });
    } catch (error) {
      alert(error.message || 'No se pudo desactivar la terminal');
    }
  };

  return (
    <div className="gestion-puntos-container">
      <div className="gestion-puntos-card">
        <div className="gestion-header">
          <div className="gestion-copy">
            <span className="gestion-kicker">Terminales distribuidas</span>
            <h2 className="card-title">Crear punto de venta con acceso incluido</h2>
            <p>
              Da de alta la terminal con sus credenciales, direccion, celular y tipo
              operativo en un solo formulario.
            </p>
          </div>
          <button
            className="btn-agregar-punto"
            onClick={() => (mostrarFormulario ? resetFormulario() : setMostrarFormulario(true))}
            disabled={guardando}
          >
            {mostrarFormulario ? 'Cerrar formulario' : '+ Nueva terminal'}
          </button>
        </div>

        <div className="terminal-summary-strip">
          <article className="terminal-summary-card">
            <span>Total creadas</span>
            <strong>{puntosVenta.length}</strong>
          </article>
          <article className="terminal-summary-card">
            <span>Activas</span>
            <strong>{totalActivas}</strong>
          </article>
          <article className="terminal-summary-card">
            <span>Inactivas</span>
            <strong>{Math.max(puntosVenta.length - totalActivas, 0)}</strong>
          </article>
        </div>

        {mostrarFormulario && (
          <div className="terminal-form-panel">
            <div className="terminal-form-header">
              <div>
                <span className="terminal-section-kicker">Acceso de la terminal</span>
                <h3>{editandoId ? 'Editar terminal' : 'Nueva terminal de venta'}</h3>
              </div>
              <span className="terminal-form-note">
                {editandoId
                  ? 'Puedes cambiar usuario, datos y contrasena.'
                  : 'Al guardar se crea el punto de venta y su acceso al sistema.'}
              </span>
            </div>

            <div className="terminal-form-grid">
              <label className="terminal-field">
                <span>Nombre de usuario</span>
                <input
                  type="text"
                  placeholder="Ej: sny01"
                  value={formulario.username}
                  onChange={(e) => actualizarCampo('username', e.target.value)}
                />
              </label>

              <label className="terminal-field">
                <span>Contrasena</span>
                <input
                  type="password"
                  placeholder={editandoId ? 'Nueva contrasena (opcional)' : 'Contrasena'}
                  value={formulario.password}
                  onChange={(e) => actualizarCampo('password', e.target.value)}
                />
              </label>

              <label className="terminal-field terminal-field-wide">
                <span>Direccion</span>
                <input
                  type="text"
                  placeholder="Direccion del punto de venta"
                  value={formulario.ubicacion}
                  onChange={(e) => actualizarCampo('ubicacion', e.target.value)}
                />
              </label>

              <label className="terminal-field">
                <span>Numero de cel</span>
                <input
                  type="text"
                  placeholder="Ej: 809-555-0101"
                  value={formulario.telefono}
                  onChange={(e) => actualizarCampo('telefono', e.target.value)}
                />
              </label>

              <label className="terminal-field">
                <span>Tipo de punto de venta</span>
                <input
                  type="text"
                  placeholder="Ej: banca, kiosko, movil"
                  value={formulario.tipo}
                  onChange={(e) => actualizarCampo('tipo', e.target.value)}
                />
              </label>

              <label className="terminal-field">
                <span>Porcentaje del socio (%)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="Ej: 15"
                  value={formulario.porcentajeSocio}
                  onChange={(e) => actualizarCampo('porcentajeSocio', e.target.value)}
                />
              </label>

              <label className="terminal-field terminal-switch">
                <span>Estado</span>
                <button
                  type="button"
                  className={`terminal-toggle ${formulario.activo ? 'activo' : 'inactivo'}`}
                  onClick={() => actualizarCampo('activo', !formulario.activo)}
                >
                  {formulario.activo ? 'Activa' : 'Inactiva'}
                </button>
              </label>
            </div>

            <div className="punto-form-actions">
              <button onClick={guardar} disabled={guardando}>
                {guardando ? 'Guardando...' : editandoId ? 'Actualizar terminal' : 'Crear terminal'}
              </button>
              <button className="secondary" onClick={resetFormulario} disabled={guardando}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {cargando ? (
          <div className="punto-empty">Cargando terminales...</div>
        ) : puntosVenta.length === 0 ? (
          <div className="punto-empty">Todavia no hay terminales creadas.</div>
        ) : (
          <div className="terminal-list">
            {puntosVenta.map((puntoVenta) => (
              <article key={puntoVenta.id} className="terminal-card">
                <div className="terminal-card-head">
                  <div>
                    <span className="terminal-card-code">{puntoVenta.codigo}</span>
                    <h3>{puntoVenta.username || puntoVenta.nombre}</h3>
                  </div>
                  <span className={`estado-badge ${puntoVenta.activo ? 'activo' : 'inactivo'}`}>
                    {puntoVenta.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                <div className="terminal-card-grid">
                  <div>
                    <span className="terminal-meta-label">Tipo</span>
                    <strong>{puntoVenta.tipo || 'Sin definir'}</strong>
                  </div>
                  <div>
                    <span className="terminal-meta-label">Celular</span>
                    <strong>{puntoVenta.telefono || 'Sin numero'}</strong>
                  </div>
                  <div>
                    <span className="terminal-meta-label">% Socio</span>
                    <strong>{(Number(puntoVenta.porcentajeSocio) || 0).toFixed(2)}%</strong>
                  </div>
                  <div className="terminal-meta-wide">
                    <span className="terminal-meta-label">Direccion</span>
                    <strong>{puntoVenta.ubicacion || 'Sin direccion'}</strong>
                  </div>
                </div>

                <div className="tabla-acciones terminal-card-actions">
                  <button onClick={() => editar(puntoVenta)}>Editar</button>
                  {puntoVenta.activo && (
                    <button className="danger" onClick={() => desactivar(puntoVenta.id)}>
                      Desactivar
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default GestionPuntosVenta;
