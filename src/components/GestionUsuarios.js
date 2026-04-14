import React, { useEffect, useMemo, useState } from 'react';
import './GestionUsuarios.css';
import authService from '../services/authService';
import puntosVentaService from '../services/puntosVentaService';

const formularioInicial = {
  rol: 'punto_venta',
  username: '',
  password: '',
  nombre: '',
  email: '',
  ubicacion: '',
  telefono: '',
  tipo: '',
  activo: true
};

const ordenarUsuarios = (lista = []) =>
  [...lista].sort((a, b) =>
    String(a.username || a.nombre || '').localeCompare(String(b.username || b.nombre || ''))
  );

function GestionUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [puntosVenta, setPuntosVenta] = useState([]);
  const [formulario, setFormulario] = useState(formularioInicial);
  const [editandoId, setEditandoId] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const puntosPorId = useMemo(
    () =>
      puntosVenta.reduce((mapa, puntoVenta) => {
        mapa[puntoVenta.id] = puntoVenta;
        return mapa;
      }, {}),
    [puntosVenta]
  );

  const recargarDatos = async () => {
    const [usuariosData, puntosData] = await Promise.all([
      authService.getUsuarios(),
      puntosVentaService.getPuntosVenta()
    ]);
    setUsuarios(ordenarUsuarios(usuariosData));
    setPuntosVenta(puntosData);
  };

  useEffect(() => {
    const cargar = async () => {
      try {
        setCargando(true);
        await recargarDatos();
      } catch (error) {
        alert(error.message || 'No se pudieron cargar los usuarios');
      } finally {
        setCargando(false);
      }
    };

    cargar();
  }, []);

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

  const usuarioEditando = useMemo(
    () => usuarios.find((usuario) => usuario.id === editandoId) || null,
    [usuarios, editandoId]
  );

  const guardarTerminal = async () => {
    if (!formulario.username.trim()) {
      alert('Debes completar el nombre de usuario');
      return;
    }

    if (formulario.username.trim().length < 3) {
      alert('El usuario debe tener al menos 3 caracteres');
      return;
    }

    if (!editandoId && !formulario.password.trim()) {
      alert('Debes definir una contrasena');
      return;
    }

    if (formulario.password.trim() && formulario.password.trim().length < 6) {
      alert('La contrasena debe tener al menos 6 caracteres');
      return;
    }

    if (!formulario.ubicacion.trim()) {
      alert('Debes completar la direccion');
      return;
    }

    if (!formulario.telefono.trim()) {
      alert('Debes completar el numero de cel');
      return;
    }

    if (!formulario.tipo.trim()) {
      alert('Debes indicar el tipo de punto de venta');
      return;
    }

    const payload = {
      username: formulario.username.trim().toLowerCase(),
      password: formulario.password.trim() || undefined,
      ubicacion: formulario.ubicacion.trim(),
      telefono: formulario.telefono.trim(),
      tipo: formulario.tipo.trim(),
      activo: formulario.activo,
      nombre: formulario.username.trim().toLowerCase(),
      responsable: formulario.username.trim().toLowerCase()
    };

    const puntoVentaId =
      usuarioEditando?.rol === 'punto_venta' ? usuarioEditando.puntoVentaId : '';

    if (editandoId && puntoVentaId) {
      await puntosVentaService.updatePuntoVenta(puntoVentaId, payload);
      return;
    }

    await puntosVentaService.createPuntoVenta(payload);
  };

  const guardarAdmin = async () => {
    if (!formulario.nombre.trim() || !formulario.username.trim()) {
      alert('Debes completar nombre y usuario');
      return;
    }

    if (formulario.username.trim().length < 3) {
      alert('El usuario debe tener al menos 3 caracteres');
      return;
    }

    if (!editandoId && !formulario.password.trim()) {
      alert('Debes definir una contrasena');
      return;
    }

    if (formulario.password.trim() && formulario.password.trim().length < 6) {
      alert('La contrasena debe tener al menos 6 caracteres');
      return;
    }

    const payload = {
      nombre: formulario.nombre.trim(),
      username: formulario.username.trim().toLowerCase(),
      rol: 'admin',
      email: formulario.email.trim() || undefined,
      activo: formulario.activo
    };

    if (formulario.password.trim()) {
      payload.password = formulario.password.trim();
    }

    if (editandoId) {
      await authService.updateUsuario(editandoId, payload);
      return;
    }

    await authService.register(payload);
  };

  const guardar = async () => {
    setGuardando(true);

    try {
      if (formulario.rol === 'admin') {
        await guardarAdmin();
      } else {
        await guardarTerminal();
      }

      await recargarDatos();
      resetFormulario();
    } catch (error) {
      alert(error.message || 'No se pudo guardar el usuario');
    } finally {
      setGuardando(false);
    }
  };

  const editar = (usuario) => {
    if (usuario.rol === 'admin') {
      setFormulario({
        rol: 'admin',
        username: usuario.username || '',
        password: '',
        nombre: usuario.nombre || '',
        email: usuario.email || '',
        ubicacion: '',
        telefono: '',
        tipo: '',
        activo: typeof usuario.activo === 'boolean' ? usuario.activo : true
      });
    } else {
      const puntoVenta = puntosPorId[usuario.puntoVentaId] || {};
      setFormulario({
        rol: 'punto_venta',
        username: usuario.username || puntoVenta.username || '',
        password: '',
        nombre: '',
        email: '',
        ubicacion: puntoVenta.ubicacion || '',
        telefono: puntoVenta.telefono || '',
        tipo: puntoVenta.tipo || '',
        activo: typeof usuario.activo === 'boolean' ? usuario.activo : true
      });
    }

    setEditandoId(usuario.id);
    setMostrarFormulario(true);
  };

  const eliminar = async (usuario) => {
    if (!window.confirm('Deseas eliminar este acceso?')) {
      return;
    }

    try {
      if (usuario.rol === 'admin' || !usuario.puntoVentaId) {
        await authService.deleteUsuario(usuario.id);
      } else {
        await puntosVentaService.deletePuntoVenta(usuario.puntoVentaId);
      }

      await recargarDatos();
    } catch (error) {
      alert(error.message || 'No se pudo eliminar el usuario');
    }
  };

  const usuariosOrdenados = useMemo(() => ordenarUsuarios(usuarios), [usuarios]);

  return (
    <div className="gestion-usuarios-container">
      <div className="gestion-usuarios-card">
        <div className="gestion-header">
          <div className="gestion-usuarios-copy">
            <span className="usuarios-kicker">Accesos del sistema</span>
            <h2 className="card-title">Usuarios y terminales</h2>
            <p>
              Crea puntos de venta con su acceso desde aqui y deja los administradores
              bajo un flujo aparte dentro del mismo panel.
            </p>
          </div>
          <button
            className="btn-agregar-usuario"
            onClick={() => (mostrarFormulario ? resetFormulario() : setMostrarFormulario(true))}
            disabled={guardando}
          >
            {mostrarFormulario ? 'Cerrar formulario' : '+ Nuevo acceso'}
          </button>
        </div>

        {mostrarFormulario && (
          <div className="usuario-formulario">
            <div className="usuario-role-switch">
              <button
                type="button"
                className={formulario.rol === 'punto_venta' ? 'active' : ''}
                onClick={() => actualizarCampo('rol', 'punto_venta')}
                disabled={guardando || Boolean(editandoId && usuarioEditando?.rol === 'admin')}
              >
                Punto de venta
              </button>
              <button
                type="button"
                className={formulario.rol === 'admin' ? 'active' : ''}
                onClick={() => actualizarCampo('rol', 'admin')}
                disabled={guardando || Boolean(editandoId && usuarioEditando?.rol === 'punto_venta')}
              >
                Administrador
              </button>
            </div>

            {formulario.rol === 'punto_venta' ? (
              <div className="usuario-grid usuario-grid-terminal">
                <label className="usuario-field">
                  <span>Nombre de usuario</span>
                  <input
                    type="text"
                    placeholder="Ej: sny01"
                    value={formulario.username}
                    onChange={(e) => actualizarCampo('username', e.target.value)}
                  />
                </label>
                <label className="usuario-field">
                  <span>Contrasena</span>
                  <input
                    type="password"
                    placeholder={editandoId ? 'Nueva contrasena (opcional)' : 'Contrasena'}
                    value={formulario.password}
                    onChange={(e) => actualizarCampo('password', e.target.value)}
                  />
                </label>
                <label className="usuario-field usuario-field-wide">
                  <span>Direccion</span>
                  <input
                    type="text"
                    placeholder="Direccion del punto de venta"
                    value={formulario.ubicacion}
                    onChange={(e) => actualizarCampo('ubicacion', e.target.value)}
                  />
                </label>
                <label className="usuario-field">
                  <span>Numero de cel</span>
                  <input
                    type="text"
                    placeholder="Ej: 809-555-0101"
                    value={formulario.telefono}
                    onChange={(e) => actualizarCampo('telefono', e.target.value)}
                  />
                </label>
                <label className="usuario-field">
                  <span>Tipo de punto de venta</span>
                  <input
                    type="text"
                    placeholder="Ej: banca, kiosko, movil"
                    value={formulario.tipo}
                    onChange={(e) => actualizarCampo('tipo', e.target.value)}
                  />
                </label>
                <label className="usuario-checkbox usuario-checkbox-inline">
                  <input
                    type="checkbox"
                    checked={formulario.activo}
                    onChange={(e) => actualizarCampo('activo', e.target.checked)}
                  />
                  <span>Activo</span>
                </label>
              </div>
            ) : (
              <div className="usuario-grid">
                <label className="usuario-field">
                  <span>Nombre</span>
                  <input
                    type="text"
                    placeholder="Nombre"
                    value={formulario.nombre}
                    onChange={(e) => actualizarCampo('nombre', e.target.value)}
                  />
                </label>
                <label className="usuario-field">
                  <span>Usuario</span>
                  <input
                    type="text"
                    placeholder="admin"
                    value={formulario.username}
                    onChange={(e) => actualizarCampo('username', e.target.value)}
                  />
                </label>
                <label className="usuario-field">
                  <span>Contrasena</span>
                  <input
                    type="password"
                    placeholder={editandoId ? 'Nueva contrasena (opcional)' : 'Contrasena'}
                    value={formulario.password}
                    onChange={(e) => actualizarCampo('password', e.target.value)}
                  />
                </label>
                <label className="usuario-field">
                  <span>Email</span>
                  <input
                    type="email"
                    placeholder="Email (opcional)"
                    value={formulario.email}
                    onChange={(e) => actualizarCampo('email', e.target.value)}
                  />
                </label>
                <label className="usuario-checkbox usuario-checkbox-inline">
                  <input
                    type="checkbox"
                    checked={formulario.activo}
                    onChange={(e) => actualizarCampo('activo', e.target.checked)}
                  />
                  <span>Activo</span>
                </label>
              </div>
            )}

            <div className="usuario-form-actions">
              <button onClick={guardar} disabled={guardando}>
                {guardando
                  ? 'Guardando...'
                  : editandoId
                    ? 'Actualizar acceso'
                    : 'Crear acceso'}
              </button>
              <button className="secondary" onClick={resetFormulario} disabled={guardando}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {cargando ? (
          <div className="usuario-empty">Cargando usuarios...</div>
        ) : usuariosOrdenados.length === 0 ? (
          <div className="usuario-empty">Todavia no hay usuarios registrados.</div>
        ) : (
          <div className="tabla-usuarios-wrapper">
            <table className="tabla-usuarios">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Tipo</th>
                  <th>Direccion</th>
                  <th>Celular</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuariosOrdenados.map((usuario) => {
                  const puntoVenta = puntosPorId[usuario.puntoVentaId] || {};
                  const esAdmin = usuario.rol === 'admin';

                  return (
                    <tr key={usuario.id}>
                      <td>{usuario.username || usuario.nombre || 'Sin usuario'}</td>
                      <td>{esAdmin ? 'Administrador' : puntoVenta.tipo || 'Punto de venta'}</td>
                      <td>{esAdmin ? 'Central' : puntoVenta.ubicacion || 'Sin direccion'}</td>
                      <td>{esAdmin ? '-' : puntoVenta.telefono || 'Sin numero'}</td>
                      <td>
                        <span className={`estado-badge ${usuario.activo ? 'activo' : 'inactivo'}`}>
                          {usuario.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="tabla-acciones">
                        <button onClick={() => editar(usuario)}>Editar</button>
                        <button className="danger" onClick={() => eliminar(usuario)}>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default GestionUsuarios;
