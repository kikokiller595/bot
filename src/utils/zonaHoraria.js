// Zona horaria operativa del sistema. Debe coincidir con APP_TIMEZONE del backend.
// Todo el manejo de "el dia" y de horas se hace en esta zona, sin importar la
// zona del navegador del usuario ni la del servidor.
export const ZONA_OPERATIVA =
  process.env.REACT_APP_TIMEZONE || 'America/New_York';

const dtfClave = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_OPERATIVA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const dtfFechaHora = new Intl.DateTimeFormat('es-ES', {
  timeZone: ZONA_OPERATIVA,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
});

const aFecha = (valor) => {
  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? null : valor;
  }
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

// Instante (Date | ISO | ms) -> clave 'YYYY-MM-DD' en la zona operativa.
export const claveFechaOperativa = (valor) => {
  const fecha = aFecha(valor);
  if (!fecha) return null;
  return dtfClave.format(fecha); // en-CA produce 'YYYY-MM-DD'
};

// Clave 'YYYY-MM-DD' del dia de hoy en la zona operativa.
export const claveHoyOperativa = () => claveFechaOperativa(new Date());

// Instante -> texto 'dd/mm/aaaa, HH:MM:SS' en la zona operativa.
export const formatearFechaHoraOperativa = (valor) => {
  const fecha = aFecha(valor);
  if (!fecha) return '';
  return dtfFechaHora.format(fecha);
};

// True si el string parece un instante con hora (ISO con T o zona), no una
// simple fecha de calendario 'YYYY-MM-DD'.
const esInstanteConHora = (str) => /T\d{2}:\d{2}/.test(str) || /\d{2}:\d{2}:\d{2}/.test(str);

// Convierte cualquier valor de fecha a clave 'YYYY-MM-DD' respetando la zona
// operativa. Fechas de calendario (sin hora) se dejan tal cual.
export const normalizarClaveFecha = (valor) => {
  if (!valor) return null;

  if (valor instanceof Date) {
    return claveFechaOperativa(valor);
  }

  const str = String(valor).trim();

  // 'dd/mm/aaaa[, HH:MM:SS]' -> tomar solo la parte de fecha (ya es hora de pared).
  const es = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (es) {
    return `${es[3]}-${es[2].padStart(2, '0')}-${es[1].padStart(2, '0')}`;
  }

  // 'YYYY-MM-DD...' con hora/zona -> es un instante, convertir a la zona operativa.
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    if (esInstanteConHora(str)) {
      const clave = claveFechaOperativa(str);
      if (clave) return clave;
    }
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  return claveFechaOperativa(str);
};
