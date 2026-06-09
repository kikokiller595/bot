/**
 * Convierte cualquier valor de fecha a clave YYYY-MM-DD.
 * Soporta: Date, string ISO, string dd/mm/yyyy (con hora opcional separada por coma).
 */
export const obtenerClaveFecha = (valor) => {
  if (!valor) return null;

  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null;
    const anio = valor.getFullYear();
    const mes = String(valor.getMonth() + 1).padStart(2, '0');
    const dia = String(valor.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  const str = String(valor);

  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const partes = str.split(',');
  const fechaParte = partes[0]?.trim() || '';
  const matchES = fechaParte.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (matchES) {
    const [, dia, mes, anio] = matchES;
    return `${anio.padStart(4, '0')}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }

  const fecha = new Date(str);
  if (!Number.isNaN(fecha.getTime())) {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  return null;
};

export const obtenerFechaActualLocal = () => {
  const ahora = new Date();
  const anio = ahora.getFullYear();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
};
