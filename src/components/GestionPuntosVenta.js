import React, { useEffect, useState } from 'react';
import './GestionPuntosVenta.css';
import puntosVentaService from '../services/puntosVentaService';

const formularioInicial = {
  codigo: '',
  nombre: '',
  ubicacion: '',
  telefono: '',
  responsable: '',
  activo: true
};

function GestionPuntosVenta() {
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
        const data = await puntosVentaService.getPuntosVenta();
        setPuntosVenta(data);
      } catch (error) {
        alert(error.message || 'No se pudieron cargar los puntos de venta');
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
    if (!formulario.codigo.trim() || !formulario.nombre.trim()) {
      alert('Debes completar codigo y nombre');
      return;
    }

    setGuardando(true);

    try {
      if (editandoId) {
        const actualizado = await puntosVentaService.updatePuntoVenta(editandoId, formulario);
        setPuntosVenta(prev => prev.map(item => (item.id === editandoId ? actualizado : item)));
      } else {
        const creado = await puntosVentaService.createPuntoVenta(formulario);
        setPuntosVenta(prev => [...prev, creado].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      }

      resetFormulario();
    } catch (error) {
      alert(error.message || 'No se pudo guardar el punto de venta');
    } finally {
      setGuardando(false);
    }
  };

  const editar = (puntoVenta) => {
    setFormulario({
      codigo: puntoVenta.codigo || '',
      nombre: puntoVenta.nombre || '',
      ubicacion: puntoVenta.ubicacion || '',
      telefono: puntoVenta.telefono || '',
      responsable: puntoVenta.responsable || '',
      activo: typeof puntoVenta.activo === 'boolean' ? puntoVenta.activo : true
    });
    setEditandoId(puntoVenta.id);
    setMostrarFormulario(true);
  };

  const desactivar = async (id) => {
    if (!window.confirm('Deseas desactivar este punto de venta?')) {
      return;
    }

    try {
      await puntosVentaService.deletePuntoVenta(id);
      setPuntosVenta(prev =>
        prev.map(item => (item.id === id ? { ...item, activo: false } : item))
      );
    } catch (error) {
      alert(error.message || 'No se pudo desactivar el punto de venta');
    }
  };

  return (
    <div className="gestion-puntos-container">
      <div className="gestion-puntos-card">
        <div className="gestion-header">
          <h2 className="card-title">Puntos de Venta</h2>
          <button
            className="btn-agregar-punto"
            onClick={() => (mostrarFormulario ? resetFormulario() : setMostrarFormulario(true))}
            disabled={guardando}
          >
            {mostrarFormulario ? 'Cerrar formulario' : '+ Nuevo punto de venta'}
          </button>
        </div>

        {mostrarFormulario && (
          <div className="punto-formulario">
            <div className="punto-grid">
              <input type="text" placeholder="Codigo" value={formulario.codigo} onChange={(e) => actualizarCampo('codigo', e.target.value)} />
              <input type="text" placeholder="Nombre" value={formulario.nombre} onChange={(e) => actualizarCampo('nombre', e.target.value)} />
              <input type="text" placeholder="Ubicacion" value={formulario.ubicacion} onChange={(e) => actualizarCampo('ubicacion', e.target.value)} />
              <input type="text" placeholder="Telefono" value={formulario.telefono} onChange={(e) => actualizarCampo('telefono', e.target.value)} />
              <input type="text" placeholder="Responsable" value={formulario.responsable} onChange={(e) => actualizarCampo('responsable', e.target.value)} />
              <label className="punto-checkbox">
                <input type="checkbox" checked={formulario.activo} onChange={(e) => actualizarCampo('activo', e.target.checked)} />
                <span>Activo</span>
              </label>
            </div>

            <div className="punto-form-actions">
              <button onClick={guardar} disabled={guardando}>
                {guardando ? 'Guardando...' : editandoId ? 'Actualizar punto' : 'Crear punto'}
              </button>
              <button className="secondary" onClick={resetFormulario} disabled={guardando}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {cargando ? (
          <div className="punto-empty">Cargando puntos de venta...</div>
        ) : puntosVenta.length === 0 ? (
          <div className="punto-empty">Todavia no hay puntos de venta creados.</div>
        ) : (
          <div className="tabla-puntos-wrapper">
            <table className="tabla-puntos">
              <thead>
                <tr>
                  <th>Codigo</th>
                  <th>Nombre</th>
                  <th>Ubicacion</th>
                  <th>Responsable</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {puntosVenta.map(puntoVenta => (
                  <tr key={puntoVenta.id}>
                    <td>{puntoVenta.codigo}</td>
                    <td>{puntoVenta.nombre}</td>
                    <td>{puntoVenta.ubicacion || 'Sin ubicacion'}</td>
                    <td>{puntoVenta.responsable || 'Sin responsable'}</td>
                    <td>
                      <span className={`estado-badge ${puntoVenta.activo ? 'activo' : 'inactivo'}`}>
                        {puntoVenta.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="tabla-acciones">
                      <button onClick={() => editar(puntoVenta)}>Editar</button>
                      {puntoVenta.activo && (
                        <button className="danger" onClick={() => desactivar(puntoVenta.id)}>
                          Desactivar
                        </button>
                      )}
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

export default GestionPuntosVenta;
