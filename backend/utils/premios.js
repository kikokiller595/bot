const { obtenerClaveFechaOperativa } = require('./operacion');

const premiosPorDefecto = {
  pick2: {
    straightPrimera: 55,
    straightSegunda: 15,
    straightTercera: 10
  },
  singulation: {
    straight: 9
  },
  pick3: {
    straight: 700,
    triple: 500,
    boxPar: 232,
    boxTodosDiferentes: 116
  },
  pick4: {
    straight: 5000,
    cuadrupleStraight: 3000,
    boxCuadruple: 3000,
    boxTresIguales: 1200,
    boxDosPares: 800,
    boxUnPar: 400,
    boxTodosDiferentes: 200
  },
  pale: {
    straight: 700
  }
};

const numeroSeguro = (valor, fallback) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : fallback;
};

const normalizarPremios = (entrada = null) => ({
  pick2: {
    straightPrimera: numeroSeguro(
      entrada?.pick2?.straightPrimera,
      premiosPorDefecto.pick2.straightPrimera
    ),
    straightSegunda: numeroSeguro(
      entrada?.pick2?.straightSegunda,
      premiosPorDefecto.pick2.straightSegunda
    ),
    straightTercera: numeroSeguro(
      entrada?.pick2?.straightTercera,
      premiosPorDefecto.pick2.straightTercera
    )
  },
  singulation: {
    straight: numeroSeguro(
      entrada?.singulation?.straight,
      premiosPorDefecto.singulation.straight
    )
  },
  pick3: {
    straight: numeroSeguro(
      entrada?.pick3?.straight,
      premiosPorDefecto.pick3.straight
    ),
    triple: numeroSeguro(
      entrada?.pick3?.triple,
      premiosPorDefecto.pick3.triple
    ),
    boxPar: numeroSeguro(
      entrada?.pick3?.boxPar,
      premiosPorDefecto.pick3.boxPar
    ),
    boxTodosDiferentes: numeroSeguro(
      entrada?.pick3?.boxTodosDiferentes,
      premiosPorDefecto.pick3.boxTodosDiferentes
    )
  },
  pick4: {
    straight: numeroSeguro(
      entrada?.pick4?.straight,
      premiosPorDefecto.pick4.straight
    ),
    cuadrupleStraight: numeroSeguro(
      entrada?.pick4?.cuadrupleStraight,
      premiosPorDefecto.pick4.cuadrupleStraight
    ),
    boxCuadruple: numeroSeguro(
      entrada?.pick4?.boxCuadruple,
      premiosPorDefecto.pick4.boxCuadruple
    ),
    boxTresIguales: numeroSeguro(
      entrada?.pick4?.boxTresIguales,
      premiosPorDefecto.pick4.boxTresIguales
    ),
    boxDosPares: numeroSeguro(
      entrada?.pick4?.boxDosPares,
      premiosPorDefecto.pick4.boxDosPares
    ),
    boxUnPar: numeroSeguro(
      entrada?.pick4?.boxUnPar,
      premiosPorDefecto.pick4.boxUnPar
    ),
    boxTodosDiferentes: numeroSeguro(
      entrada?.pick4?.boxTodosDiferentes,
      premiosPorDefecto.pick4.boxTodosDiferentes
    )
  },
  pale: {
    straight: numeroSeguro(
      entrada?.pale?.straight,
      premiosPorDefecto.pale.straight
    )
  }
});

const detectarTipoBoxPick3 = (numero = '') => {
  if (numero.length !== 3) return null;
  const frecuencia = {};
  numero.split('').forEach((digito) => {
    frecuencia[digito] = (frecuencia[digito] || 0) + 1;
  });

  const valores = Object.values(frecuencia).sort((a, b) => b - a);
  if (valores[0] === 3) return 'triple';
  if (valores[0] === 2) return 'par';
  if (valores[0] === 1) return 'todos-diferentes';
  return null;
};

const detectarTipoBoxPick4 = (numero = '') => {
  if (numero.length !== 4) return null;
  const frecuencia = {};
  numero.split('').forEach((digito) => {
    frecuencia[digito] = (frecuencia[digito] || 0) + 1;
  });

  const valores = Object.values(frecuencia).sort((a, b) => b - a);
  if (valores[0] === 4) return 'cuadruple';
  if (valores[0] === 3) return 'tres-iguales';
  if (valores[0] === 2 && valores[1] === 2) return 'dos-pares';
  if (valores[0] === 2) return 'un-par';
  if (valores[0] === 1) return 'todos-diferentes';
  return null;
};

const normalizarPosicion = (posicion) => {
  const valor = String(posicion || 'primera').trim().toLowerCase();
  if (valor === '2' || valor.startsWith('seg')) return 'segunda';
  if (valor === '3' || valor.startsWith('ter')) return 'tercera';
  return 'primera';
};

const calcularPremio = (
  tipoApuesta,
  numero,
  monto,
  configuracionPremios,
  opciones = {}
) => {
  const premios = normalizarPremios(configuracionPremios);
  const montoNum = parseFloat(monto) || 0;
  if (montoNum <= 0) {
    return 0;
  }

  // Pale: parlay de dos números de 2 dígitos — premio directo por monto
  if (String(tipoApuesta || '').toLowerCase() === 'pale') {
    return montoNum * (premios.pale?.straight ?? 700);
  }

  const numeroStr = String(numero || '').trim();
  const longitud = numeroStr.length;
  const posicion = normalizarPosicion(opciones.posicion);

  if (longitud === 1) {
    return tipoApuesta === 'singulation'
      ? montoNum * premios.singulation.straight
      : 0;
  }

  if (tipoApuesta === 'bolita1' || tipoApuesta === 'bolita2') {
    return longitud === 2 ? montoNum * 80 : 0;
  }

  if (longitud === 2) {
    if (tipoApuesta !== 'straight') return 0;
    if (posicion === 'segunda') return montoNum * premios.pick2.straightSegunda;
    if (posicion === 'tercera') return montoNum * premios.pick2.straightTercera;
    return montoNum * premios.pick2.straightPrimera;
  }

  if (longitud === 3) {
    const tipoBox = detectarTipoBoxPick3(numeroStr);
    if (tipoBox === 'triple') {
      return montoNum * premios.pick3.triple;
    }
    if (
      tipoApuesta === 'straight' ||
      tipoApuesta === 'pick4tail3' ||
      tipoApuesta === 'pick4head3'
    ) {
      return montoNum * premios.pick3.straight;
    }
    if (
      tipoApuesta === 'box' ||
      tipoApuesta === 'pick4tail3box' ||
      tipoApuesta === 'pick4head3box'
    ) {
      if (tipoBox === 'par') return montoNum * premios.pick3.boxPar;
      if (tipoBox === 'todos-diferentes') {
        return montoNum * premios.pick3.boxTodosDiferentes;
      }
    }
    return 0;
  }

  if (longitud === 4) {
    if (tipoApuesta === 'straight') {
      const esCuadruple = numeroStr
        .split('')
        .every((digito) => digito === numeroStr[0]);
      return montoNum * (
        esCuadruple
          ? premios.pick4.cuadrupleStraight
          : premios.pick4.straight
      );
    }

    if (tipoApuesta === 'box') {
      const tipoBox = detectarTipoBoxPick4(numeroStr);
      if (tipoBox === 'cuadruple') return montoNum * premios.pick4.boxCuadruple;
      if (tipoBox === 'tres-iguales') return montoNum * premios.pick4.boxTresIguales;
      if (tipoBox === 'dos-pares') return montoNum * premios.pick4.boxDosPares;
      if (tipoBox === 'un-par') return montoNum * premios.pick4.boxUnPar;
      if (tipoBox === 'todos-diferentes') {
        return montoNum * premios.pick4.boxTodosDiferentes;
      }
    }
  }

  return 0;
};

const extenderNumerosGanadores = (numeros = []) => {
  const lista = [];

  numeros.forEach((numeroGanador) => {
    if (!numeroGanador) return;
    const numeroStr = String(numeroGanador.numero || '').trim();
    if (!numeroStr) return;
    const base =
      typeof numeroGanador.toObject === 'function'
        ? numeroGanador.toObject()
        : { ...numeroGanador };

    lista.push({
      ...base,
      numero: numeroStr,
      esDerivado: false,
      fuenteDerivada: ''
    });

    if (numeroStr.length === 3) {
      lista.push({
        ...base,
        numero: numeroStr.slice(-2),
        posicion: 'primera',
        esDerivado: true,
        fuenteDerivada: 'pick3'
      });
    } else if (numeroStr.length === 4) {
      lista.push(
        {
          ...base,
          numero: numeroStr.slice(0, 3),
          posicion: 'primeros 3',
          esDerivado: true,
          fuenteDerivada: 'pick4-head3'
        },
        {
          ...base,
          numero: numeroStr.slice(0, 2),
          posicion: 'segunda',
          esDerivado: true,
          fuenteDerivada: 'pick4-inicio'
        },
        {
          ...base,
          numero: numeroStr.slice(-2),
          posicion: 'tercera',
          esDerivado: true,
          fuenteDerivada: 'pick4-fin'
        },
        {
          ...base,
          numero: numeroStr.slice(-3),
          posicion: 'ultimos 3',
          esDerivado: true,
          fuenteDerivada: 'pick4-tail3'
        }
      );
    }
  });

  return lista;
};

const numeroCoincide = (
  numeroTicket,
  numeroGanador,
  tipoApuesta,
  opciones = {}
) => {
  if (!numeroTicket || !numeroGanador) return false;

  const tipo = String(tipoApuesta || '').toLowerCase();
  const ticketStr = String(numeroTicket).trim();
  const ganadorStr = String(numeroGanador).trim();

  if (opciones.esDerivado) {
    if (opciones.fuenteDerivada === 'pick4-tail3') {
      if (ticketStr.length !== 3 || ganadorStr.length !== 3) return false;
      if (tipo === 'pick4tail3') return ticketStr === ganadorStr;
      if (tipo === 'pick4tail3box') {
        return ticketStr.split('').sort().join('') ===
          ganadorStr.split('').sort().join('');
      }
      return false;
    }

    if (opciones.fuenteDerivada === 'pick4-head3') {
      if (ticketStr.length !== 3 || ganadorStr.length !== 3) return false;
      if (tipo === 'pick4head3') return ticketStr === ganadorStr;
      if (tipo === 'pick4head3box') {
        return ticketStr.split('').sort().join('') ===
          ganadorStr.split('').sort().join('');
      }
      return false;
    }

    return (
      ticketStr.length === 2 &&
      tipo === 'straight' &&
      ticketStr === ganadorStr
    );
  }

  if (tipo === 'singulation') {
    return ticketStr.length === 1 && ticketStr === ganadorStr.slice(-1);
  }

  if (tipo === 'bolita1' || tipo === 'bolita2') {
    if (ticketStr.length !== 2 || ganadorStr.length !== 3) return false;
    return tipo === 'bolita1'
      ? ticketStr === ganadorStr.slice(0, 2)
      : ticketStr === ganadorStr.slice(-2);
  }

  if (ticketStr.length !== ganadorStr.length) return false;
  if (tipo === 'straight') return ticketStr === ganadorStr;
  if (tipo === 'box') {
    return ticketStr.split('').sort().join('') ===
      ganadorStr.split('').sort().join('');
  }

  return false;
};

const esLongitudCompatible = (numeroTicket, candidato, tipoApuesta) => {
  if (candidato.esDerivado) {
    if (
      candidato.fuenteDerivada === 'pick4-tail3' ||
      candidato.fuenteDerivada === 'pick4-head3'
    ) {
      return numeroTicket.length === 3;
    }
    return numeroTicket.length === 2 && tipoApuesta === 'straight';
  }

  const numeroGanador = String(candidato.numero || '');
  if (tipoApuesta === 'bolita1' || tipoApuesta === 'bolita2') {
    return numeroTicket.length === 2 && numeroGanador.length === 3;
  }
  if (tipoApuesta === 'singulation') {
    return numeroTicket.length === 1 && numeroGanador.length >= 1;
  }
  return numeroTicket.length === numeroGanador.length;
};

const evaluarSorteoGanador = (
  sorteo,
  loteria,
  { zonaHoraria } = {}
) => {
  const numeroTicket = String(sorteo?.numero || '').replace(/[^0-9]/g, '');
  const tipoApuesta = String(sorteo?.tipoApuesta || 'straight')
    .trim()
    .toLowerCase();
  const fechaTicket = obtenerClaveFechaOperativa(sorteo?.fecha, zonaHoraria);
  const candidatos = extenderNumerosGanadores(loteria?.numerosGanadores || []);
  const coincidencias = [];

  if (!numeroTicket || !fechaTicket) {
    return {
      ganador: false,
      premioTotal: 0,
      coincidencias
    };
  }

  // ── Pale: evaluación especial (necesita todos los ganadores del día) ──
  if (tipoApuesta === 'pale') {
    const num1 = numeroTicket.slice(0, 2);
    const num2 = numeroTicket.slice(2, 4);
    if (num1.length === 2 && num2.length === 2) {
      const ganadoresDelDia = (loteria?.numerosGanadores || []).filter(ng => {
        const fg = obtenerClaveFechaOperativa(ng.fecha, zonaHoraria);
        return fg && fg === fechaTicket;
      });
      const pick2sDelDia = new Set();
      extenderNumerosGanadores(ganadoresDelDia).forEach(c => {
        const n = String(c.numero || '').trim();
        if (/^\d{2}$/.test(n)) pick2sDelDia.add(n);
      });
      if (pick2sDelDia.has(num1) && pick2sDelDia.has(num2)) {
        const premios = normalizarPremios(loteria?.premios);
        const monto = parseFloat(sorteo.monto) || 0;
        const premio = monto * (premios.pale?.straight ?? 700);
        if (premio > 0) {
          coincidencias.push({
            numeroGanador: `${num1}-${num2}`,
            posicion: 'pale',
            premio
          });
        }
      }
    }
    const premioTotal = coincidencias.reduce((t, c) => t + c.premio, 0);
    return { ganador: premioTotal > 0, premioTotal, coincidencias };
  }

  candidatos.forEach((candidato) => {
    const fechaGanador = obtenerClaveFechaOperativa(candidato.fecha, zonaHoraria);
    if (!fechaGanador || fechaGanador !== fechaTicket) {
      return;
    }

    if (!esLongitudCompatible(numeroTicket, candidato, tipoApuesta)) {
      return;
    }

    if (
      !numeroCoincide(numeroTicket, candidato.numero, tipoApuesta, {
        esDerivado: candidato.esDerivado,
        fuenteDerivada: candidato.fuenteDerivada
      })
    ) {
      return;
    }

    const premio = calcularPremio(
      tipoApuesta,
      numeroTicket,
      sorteo.monto,
      loteria.premios,
      { posicion: candidato.posicion }
    );

    if (premio > 0) {
      coincidencias.push({
        numeroGanador: String(candidato.numero),
        posicion: candidato.posicion || '',
        premio
      });
    }
  });

  const premioTotal = coincidencias.reduce(
    (total, coincidencia) => total + coincidencia.premio,
    0
  );

  return {
    ganador: premioTotal > 0,
    premioTotal,
    coincidencias
  };
};

module.exports = {
  calcularPremio,
  evaluarSorteoGanador,
  extenderNumerosGanadores,
  normalizarPremios,
  numeroCoincide,
  premiosPorDefecto
};
