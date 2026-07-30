import { claveHoyOperativa } from './zonaHoraria';

export const formatearFechaLocalInput = (fecha) => {
  // Sin argumento: "hoy" en la zona operativa (America/New_York), no la del navegador.
  if (fecha === undefined) {
    return claveHoyOperativa();
  }

  const valor = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(valor.getTime())) {
    return '';
  }

  const anio = valor.getFullYear();
  const mes = String(valor.getMonth() + 1).padStart(2, '0');
  const dia = String(valor.getDate()).padStart(2, '0');

  return `${anio}-${mes}-${dia}`;
};
