import { normalizarPremios } from './premiosDefault';

const normalizarPosicion = (posicion) => {
  if (!posicion) return 'primera';
  const valor = posicion.toString().trim().toLowerCase();
  if (valor === '1' || valor.startsWith('pri')) return 'primera';
  if (valor === '2' || valor.startsWith('seg')) return 'segunda';
  if (valor === '3' || valor.startsWith('ter')) return 'tercera';
  return 'primera';
};

// Función para detectar el tipo de número Box (Pick 3)
export const detectarTipoBoxPick3 = (numero) => {
  if (!numero || numero.length !== 3) return null;
  
  const digitos = numero.split('');
  const frecuencia = {};
  
  // Contar frecuencia de cada dígito
  digitos.forEach(d => {
    frecuencia[d] = (frecuencia[d] || 0) + 1;
  });
  
  const valores = Object.values(frecuencia).sort((a, b) => b - a);
  
  // Todos iguales (111)
  if (valores[0] === 3) {
    return 'triple';
  }
  
  // Un par (112, 232)
  if (valores[0] === 2) {
    return 'par';
  }
  
  // Todos diferentes (123)
  if (valores[0] === 1) {
    return 'todos-diferentes';
  }
  
  return null;
};

// Función para detectar el tipo de número Box (Pick 4)
export const detectarTipoBox = (numero) => {
  if (!numero || numero.length !== 4) return null;
  
  const digitos = numero.split('');
  const frecuencia = {};
  
  // Contar frecuencia de cada dígito
  digitos.forEach(d => {
    frecuencia[d] = (frecuencia[d] || 0) + 1;
  });
  
  const valores = Object.values(frecuencia).sort((a, b) => b - a);
  
  // Todos iguales (4444) - Cuadruple
  if (valores[0] === 4) {
    return 'cuadruple';
  }
  
  // Tres iguales (4448)
  if (valores[0] === 3) {
    return 'tres-iguales';
  }
  
  // Dos pares (4455)
  if (valores[0] === 2 && valores[1] === 2) {
    return 'dos-pares';
  }
  
  // Un par (4458)
  if (valores[0] === 2 && valores[1] === 1) {
    return 'un-par';
  }
  
  // Todos diferentes (4758)
  if (valores[0] === 1) {
    return 'todos-diferentes';
  }
  
  return null;
};

// Función para calcular el premio según el tipo
export const calcularPremio = (
  tipoApuesta,
  numero,
  monto,
  configuracionPremios = null,
  opciones = {}
) => {
  const premios = normalizarPremios(configuracionPremios);
  const montoNum = parseFloat(monto) || 0;
  if (montoNum <= 0) return 0;
  
  const numeroStr = String(numero).trim();
  const longitud = numeroStr.length;
  const posicionNormalizada = normalizarPosicion(opciones?.posicion);

  // Singulation (1 dígito)
  if (longitud === 1) {
    if (tipoApuesta !== 'singulation') {
      return 0;
    }
    return montoNum * premios.singulation.straight;
  }

  // Bolita (Basado en Pick 3)
  if (tipoApuesta === 'bolita1' || tipoApuesta === 'bolita2') {
    if (longitud !== 2) {
      return 0;
    }
    return montoNum * 80;
  }
  
  // Pick 2 (2 dígitos)
  if (longitud === 2) {
    if (tipoApuesta !== 'straight') {
      return 0;
    }

    switch (posicionNormalizada) {
      case 'segunda':
        return montoNum * premios.pick2.straightSegunda;
      case 'tercera':
        return montoNum * premios.pick2.straightTercera;
      case 'primera':
      default:
        return montoNum * premios.pick2.straightPrimera;
    }
  }

  // Pick 3 (3 dígitos)
  if (longitud === 3) {
    // Verificar si es triple (todos iguales)
    const tipoBox = detectarTipoBoxPick3(numeroStr);
    const esTriple = tipoBox === 'triple';
    
    // Los triples solo se pueden jugar straight
    if (esTriple) {
      return montoNum * premios.pick3.triple; // Pick 3 Triples
    }
    
    // Straight (derecho) - solo para no triples
    if (tipoApuesta === 'straight' || tipoApuesta === 'pick4tail3') {
      return montoNum * premios.pick3.straight;
    }
    
    // Box - solo para no triples
    if (tipoApuesta === 'box' || tipoApuesta === 'pick4tail3box') {
      switch (tipoBox) {
        case 'par':
          // Un par (112, 232)
          return montoNum * premios.pick3.boxPar;
        case 'todos-diferentes':
          // Todos diferentes (123)
          return montoNum * premios.pick3.boxTodosDiferentes;
        default:
          return 0;
      }
    }
  }
  
  // Pick 4 (4 dígitos)
  if (longitud === 4) {
    // Straight (derecho)
    if (tipoApuesta === 'straight') {
      // Verificar si es cuadruple (0000-9999)
      if (numeroStr[0] === numeroStr[1] && numeroStr[1] === numeroStr[2] && numeroStr[2] === numeroStr[3]) {
        return montoNum * premios.pick4.cuadrupleStraight;
      }
      // Pick 4 Straight normal
      return montoNum * premios.pick4.straight;
    }
    
    // Box
    if (tipoApuesta === 'box') {
      const tipoBox = detectarTipoBox(numeroStr);
      
      switch (tipoBox) {
        case 'cuadruple':
          return montoNum * premios.pick4.boxCuadruple;
        case 'tres-iguales':
          return montoNum * premios.pick4.boxTresIguales;
        case 'dos-pares':
          return montoNum * premios.pick4.boxDosPares;
        case 'un-par':
          return montoNum * premios.pick4.boxUnPar;
        case 'todos-diferentes':
          return montoNum * premios.pick4.boxTodosDiferentes;
        default:
          return 0;
      }
    }
  }
  
  return 0;
};

// Función para verificar si un número coincide con el ganador (para Box)
// opciones: { esDerivado: boolean, longitudTicket: number }
export const numeroCoincide = (numeroTicket, numeroGanador, tipoApuesta, opciones = {}) => {
  if (!numeroTicket || !numeroGanador) return false;
  
  const tipo = (tipoApuesta || '').toLowerCase();
  const ticketStr = String(numeroTicket).trim();
  const ganadorStr = String(numeroGanador).trim();

  // Validación: si el número ganador es derivado, aplica reglas distintas según su origen.
  if (opciones.esDerivado) {
    if (opciones.fuenteDerivada === 'pick4-tail3') {
      if (ticketStr.length !== 3 || ganadorStr.length !== 3) return false;
      if (tipo === 'pick4tail3') {
        return ticketStr === ganadorStr;
      }
      if (tipo === 'pick4tail3box') {
        const ticketSorted = ticketStr.split('').sort().join('');
        const ganadorSorted = ganadorStr.split('').sort().join('');
        return ticketSorted === ganadorSorted;
      }
      return false;
    }

    // Los demás derivados son Pick 2 y solo aplican a straight.
    if (ticketStr.length !== 2) return false;
    if (tipo !== 'straight') return false;
    return ticketStr === ganadorStr;
  }

  if (tipo === 'singulation') {
    if (ticketStr.length !== 1) return false;
    if (ganadorStr.length === 1) {
      return ticketStr === ganadorStr;
    }
    // Si el número ganador tiene más dígitos, tomar el último como referencia
    const ultimo = ganadorStr.slice(-1);
    return ticketStr === ultimo;
  }

  if (tipo === 'bolita1' || tipo === 'bolita2') {
    if (ticketStr.length !== 2) return false;
    if (ganadorStr.length !== 3) return false;

    const normalizado = ganadorStr.padStart(3, '0');
    const primeros = normalizado.slice(0, 2);
    const ultimos = normalizado.slice(-2);
    return tipo === 'bolita1' ? ticketStr === primeros : ticketStr === ultimos;
  }
  
  // Para números NO derivados, las longitudes deben coincidir exactamente
  if (ticketStr.length !== ganadorStr.length) return false;
  
  const longitud = ticketStr.length;
  
  // Validación adicional: Si se proporciona la longitud esperada del ticket, verificarla
  if (opciones.longitudTicket && opciones.longitudTicket !== longitud) {
    return false;
  }
  
  // Normalizar según la longitud (2, 3 o 4 dígitos)
  const ticket = ticketStr.padStart(longitud, '0').slice(0, longitud);
  const ganador = ganadorStr.padStart(longitud, '0').slice(0, longitud);
  
  // Straight: debe coincidir exactamente
  if (tipo === 'straight') {
    return ticket === ganador;
  }
  
  // Box: debe tener los mismos dígitos (en cualquier orden)
  if (tipo === 'box') {
    const ticketSorted = ticket.split('').sort().join('');
    const ganadorSorted = ganador.split('').sort().join('');
    return ticketSorted === ganadorSorted;
  }
  
  return false;
};
