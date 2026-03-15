import React, { useEffect, useState } from 'react';
import './GestionUsuarios.css';
import authService from '../services/authService';
import puntosVentaService from '../services/puntosVentaService';

const formularioInicial = {
  nombre: '',
  username: '',
  password: '',
  rol: 'punto_venta',
  puntoVentaId: '',
  email: '',
  activo: true
};

function GestionUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [puntosVenta, setPuntosVenta] = useState([]);
  const [formulario, setFormulario] = useState(formularioInicial);
  const [editandoId, setEditandoId] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const cargar = async () => {
      try {
        setCargando(true);
        const [usuariosData, puntosData] = await Promise.all([
          authService.getUsuarios(),
          puntosVentaService.getPuntosVenta()
        ]);
        setUsuarios(usuariosData);
        setPuntosVenta(puntosData.filter(item => item.activo));
      } catch (error) {
        alert(error.message || 'No se pudieron cargar los usuarios');
      } finally {
        setCargando(false);
      }
    };

    cargar();
  }, []);

  const actualizarCampo = (campo, valor) => {
    setFormulario(prev => ({
      ...prev,
      [campo]: valor
    }));
  };

  const resetFormulario = () => {
    setFormulario(formularioInicial);
    setEditandoId(null);
    setMostrarFormulario(false);
  };

  const guardar = async () => {
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

    if (formulario.rol === 'punto_venta' && !formulario.puntoVentaId) {
      alert('Debes seleccionar un punto de venta');
      return;
    }

    const payload = {
      nombre: formulario.nombre.trim(),
      username: formulario.username.trim().toLowerCase(),
      rol: formulario.rol,
      puntoVentaId: formulario.rol === 'punto_venta' ? formulario.puntoVentaId : null,
      email: formulario.email.trim() || undefined,
      activo: formulario.activo
    };

    if (formulario.password.trim()) {
      payload.password = formulario.password.trim();
    }

    setGuardando(true);

    try {
      if (editandoId) {
        const actualizado = await authService.updateUsuario(editandoId, payload);
        setUsuarios(prev => prev.map(item => (item.id === editandoId ? actualizado : item)));
      } else {
        const creado = await authService.register(payload);
        setUsuarios(prev => [...prev, creado]);
      }
      resetFormulario();
    } catch (error) {
      alert(error.message || 'No se pudo guardar el usuario');
    } finally {
      setGuardando(false);
    }
  };

  const editar = (usuario) => {
    setFormulario({
      nombre: usuario.nombre || '',
      username: usuario.username || '',
      password: '',
      rol: usuario.rol || 'punto_venta',
      puntoVentaId: usuario.puntoVentaId || '',
      email: usuario.email || '',
      activo: typeof usuario.activo === 'boolean' ? usuario.activo : true
    });
    setEditandoId(usuario.id);
    setMostrarFormulario(true);
  };

  const eliminar = async (id) => {
    if (!window.confirm('Deseas eliminar este usuario?')) {
      return;
    }

    try {
      await authService.deleteUsuario(id);
      setUsuarios(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      alert(error.message || 'No se pudo eliminar el usuario');
    }
  };

  return (
    <div className="gestion-usuarios-container">
      <div className="gestion-usuarios-card">
        <div className="gestion-header">
          <h2 className="card-title">Usuarios</h2>
          <button
            className="btn-agregar-usuario"
            onClick={() => (mostrarFormulario ? resetFormulario() : setMostrarFormulario(true))}
            disabled={guardando}
          >
            {mostrarFormulario ? 'Cerrar formulario' : '+ Nuevo usuario'}
          </button>
        </div>

        {mostrarFormulario && (
          <div className="usuario-formulario">
            <div className="usuario-grid">
              <input type="text" placeholder="Nombre" value={formulario.nombre} onChange={(e) => actualizarCampo('nombre', e.target.value)} />
              <input type="text" placeholder="Username" value={formulario.username} onChange={(e) => actualizarCampo('username', e.target.value)} />
              <input type="password" placeholder={editandoId ? 'Nueva contrasena (opcional)' : 'Contrasena'} value={formulario.password} onChange={(e) => actualizarCampo('password', e.target.value)} />
              <input type="email" placeholder="Email (opcional)" value={formulario.email} onChange={(e) => actualizarCampo('email', e.target.value)} />
              <select value={formulario.rol} onChange={(e) => actualizarCampo('rol', e.target.value)}>
                <option value="punto_venta">Punto de venta</option>
                <option value="admin">Administrador</option>
              </select>
              <select value={formulario.puntoVentaId} onChange={(e) => actualizarCampo('puntoVentaId', e.target.value)} disabled={formulario.rol !== 'punto_venta'}>
                <option value="">Selecciona un punto de venta</option>
                {puntosVenta.map(punto => (
                  <option key={punto.id} value={punto.id}>
                    {punto.codigo} - {punto.nombre}
                  </option>
                ))}
              </select>
              <label className="usuario-checkbox">
                <input type="checkbox" checked={formulario.activo} onChange={(e) => actualizarCampo('activo', e.target.checked)} />
                <span>Activo</span>
              </label>
            </div>

            <div className="usuario-form-actions">
              <button onClick={guardar} disabled={guardando}>
                {guardando ? 'Guardando...' : editandoId ? 'Actualizar usuario' : 'Crear usuario'}
              </button>
              <button className="secondary" onClick={resetFormulario} disabled={guardando}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {cargando ? (
          <div className="usuario-empty">Cargando usuarios...</div>
        ) : usuarios.length === 0 ? (
          <div className="usuario-empty">Todavia no hay usuarios registrados.</div>
        ) : (
          <div className="tabla-usuarios-wrapper">
            <table className="tabla-usuarios">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Punto de venta</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map(usuario => (
                  <tr key={usuario.id}>
                    <td>{usuario.nombre}</td>
                    <td>{usuario.username || 'Sin username'}</td>
                    <td>{usuario.rol === 'admin' ? 'Administrador' : 'Punto de venta'}</td>
                    <td>{usuario.puntoVentaNombre || '-'}</td>
                    <td>
                      <span className={`estado-badge ${usuario.activo ? 'activo' : 'inactivo'}`}>
                        {usuario.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="tabla-acciones">
                      <button onClick={() => editar(usuario)}>Editar</button>
                      <button className="danger" onClick={() => eliminar(usuario.id)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default GestionUsuarios;
