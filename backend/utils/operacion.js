const DEFAULT_TIMEZONE = 'America/New_York';

const obtenerZonaHorariaOperativa = () =>
  process.env.APP_TIMEZONE ||
  process.env.LOTTERY_TIMEZONE ||
  DEFAULT_TIMEZONE;

const obtenerPartesEnZona = (
  fecha,
  zonaHoraria = obtenerZonaHorariaOperativa()
) => {
  const valor = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(valor.getTime())) {
    return null;
  }

  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: zonaHoraria,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(valor);

  const obtener = (tipo) => partes.find((parte) => parte.type === tipo)?.value;
  const anio = obtener('year');
  const mes = obtener('month');
  const dia = obtener('day');
  const hora = obtener('hour');
  const minuto = obtener('minute');

  if (!anio || !mes || !dia || !hora || !minuto) {
    return null;
  }

  return {
    anio,
    mes,
    dia,
    hora: Number(hora),
    minuto: Number(minuto)
  };
};

const obtenerClaveFechaOperativa = (
  fecha,
  zonaHoraria = obtenerZonaHorariaOperativa()
) => {
  if (typeof fecha === 'string') {
    const limpio = fecha.trim();
    const iso = limpio.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      return `${iso[1]}-${iso[2]}-${iso[3]}`;
    }

    const fechaEs = limpio.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (fechaEs) {
      return `${fechaEs[3]}-${fechaEs[2].padStart(2, '0')}-${fechaEs[1].padStart(2, '0')}`;
    }
  }

  const partes = obtenerPartesEnZona(fecha, zonaHoraria);
  if (!partes) {
    return null;
  }

  return `${partes.anio}-${partes.mes}-${partes.dia}`;
};

const parseHoraCierreMinutos = (valor) => {
  const limpio = String(valor || '').trim();
  if (!limpio) {
    return null;
  }

  const formato12 = limpio.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (formato12) {
    let hora = Number(formato12[1]);
    const minuto = Number(formato12[2]);
    const periodo = formato12[3].toUpperCase();

    if (hora < 1 || hora > 12 || minuto < 0 || minuto > 59) {
      return null;
    }

    if (hora === 12) {
      hora = 0;
    }
    if (periodo === 'PM') {
      hora += 12;
    }

    return hora * 60 + minuto;
  }

  const formato24 = limpio.match(/^(\d{1,2}):(\d{2})$/);
  if (!formato24) {
    return null;
  }

  const hora = Number(formato24[1]);
  const minuto = Number(formato24[2]);
  if (hora < 0 || hora > 23 || minuto < 0 || minuto > 59) {
    return null;
  }

  return hora * 60 + minuto;
};

const estaLoteriaCerrada = (
  loteria,
  ahora = new Date(),
  zonaHoraria = obtenerZonaHorariaOperativa()
) => {
  const minutosCierre = parseHoraCierreMinutos(loteria?.horaCierre);
  if (minutosCierre === null) {
    return false;
  }

  const partes = obtenerPartesEnZona(ahora, zonaHoraria);
  if (!partes) {
    return false;
  }

  return partes.hora * 60 + partes.minuto >= minutosCierre;
};

// Diferencia (en ms) entre la hora de pared de la zona y UTC para ese instante.
// Positivo al este de Greenwich, negativo al oeste (ET = negativo).
const obtenerOffsetZonaMs = (
  instante,
  zonaHoraria = obtenerZonaHorariaOperativa()
) => {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: zonaHoraria,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const partes = {};
  for (const parte of dtf.formatToParts(instante)) {
    partes[parte.type] = parte.value;
  }

  const comoUtc = Date.UTC(
    Number(partes.year),
    Number(partes.month) - 1,
    Number(partes.day),
    Number(partes.hour),
    Number(partes.minute),
    Number(partes.second)
  );

  return comoUtc - instante.getTime();
};

// Convierte una hora de pared en la zona operativa al instante real (UTC).
// Ej.: (2026, 7, 30, 0, 0, 0) en ET -> Date correspondiente a las 04:00Z.
const zonaAInstante = (
  anio,
  mes,
  dia,
  hora = 0,
  minuto = 0,
  segundo = 0,
  zonaHoraria = obtenerZonaHorariaOperativa()
) => {
  const utcAprox = Date.UTC(anio, mes - 1, dia, hora, minuto, segundo);
  const offset = obtenerOffsetZonaMs(new Date(utcAprox), zonaHoraria);
  return new Date(utcAprox - offset);
};

// Límites [inicio, fin] del día operativo (en la zona) para una fecha dada,
// expresados como instantes UTC. Sirve para filtrar rangos en Mongo.
const obtenerLimitesDiaOperativo = (
  fecha,
  zonaHoraria = obtenerZonaHorariaOperativa()
) => {
  const clave = obtenerClaveFechaOperativa(fecha, zonaHoraria);
  if (!clave) {
    return null;
  }

  const [anio, mes, dia] = clave.split('-').map(Number);
  const inicio = zonaAInstante(anio, mes, dia, 0, 0, 0, zonaHoraria);
  const finBase = zonaAInstante(anio, mes, dia, 23, 59, 59, zonaHoraria);
  const fin = new Date(finBase.getTime() + 999);

  return { inicio, fin };
};

// Formatea un instante como texto en la zona operativa: "dd/mm/aaaa, HH:MM:SS".
// Reemplaza a toLocaleString(), que usaba la zona del servidor (UTC en Railway).
const formatearFechaHoraOperativa = (
  fecha = new Date(),
  zonaHoraria = obtenerZonaHorariaOperativa()
) => {
  const valor = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(valor.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('es-ES', {
    timeZone: zonaHoraria,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(valor);
};

module.exports = {
  DEFAULT_TIMEZONE,
  estaLoteriaCerrada,
  obtenerClaveFechaOperativa,
  obtenerZonaHorariaOperativa,
  obtenerLimitesDiaOperativo,
  formatearFechaHoraOperativa,
  zonaAInstante,
  parseHoraCierreMinutos
};
