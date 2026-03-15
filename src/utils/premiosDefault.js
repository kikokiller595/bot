export const premiosPorDefecto = {
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
  }
};

const clonar = (obj) => JSON.parse(JSON.stringify(obj));

const parsearNumero = (valor, fallback) => {
  const numero = parseFloat(valor);
  return Number.isFinite(numero) ? numero : fallback;
};

export const normalizarPremios = (entrada = null) => {
  const base = clonar(premiosPorDefecto);
  if (!entrada) {
    return base;
  }

  return {
    pick2: {
      straightPrimera: parsearNumero(
        entrada?.pick2?.straightPrimera,
        base.pick2.straightPrimera
      ),
      straightSegunda: parsearNumero(
        entrada?.pick2?.straightSegunda,
        base.pick2.straightSegunda
      ),
      straightTercera: parsearNumero(
        entrada?.pick2?.straightTercera,
        base.pick2.straightTercera
      )
    },
    singulation: {
      straight: parsearNumero(
        entrada?.singulation?.straight,
        base.singulation.straight
      )
    },
    pick3: {
      straight: parsearNumero(entrada?.pick3?.straight, base.pick3.straight),
      triple: parsearNumero(entrada?.pick3?.triple, base.pick3.triple),
      boxPar: parsearNumero(entrada?.pick3?.boxPar, base.pick3.boxPar),
      boxTodosDiferentes: parsearNumero(
        entrada?.pick3?.boxTodosDiferentes,
        base.pick3.boxTodosDiferentes
      )
    },
    pick4: {
      straight: parsearNumero(entrada?.pick4?.straight, base.pick4.straight),
      cuadrupleStraight: parsearNumero(
        entrada?.pick4?.cuadrupleStraight,
        base.pick4.cuadrupleStraight
      ),
      boxCuadruple: parsearNumero(
        entrada?.pick4?.boxCuadruple,
        base.pick4.boxCuadruple
      ),
      boxTresIguales: parsearNumero(
        entrada?.pick4?.boxTresIguales,
        base.pick4.boxTresIguales
      ),
      boxDosPares: parsearNumero(
        entrada?.pick4?.boxDosPares,
        base.pick4.boxDosPares
      ),
      boxUnPar: parsearNumero(
        entrada?.pick4?.boxUnPar,
        base.pick4.boxUnPar
      ),
      boxTodosDiferentes: parsearNumero(
        entrada?.pick4?.boxTodosDiferentes,
        base.pick4.boxTodosDiferentes
      )
    }
  };
};

export const premiosParaFormulario = (entrada = null) => {
  const normalizados = normalizarPremios(entrada);
  return {
    pick2: {
      straightPrimera: normalizados.pick2.straightPrimera.toString(),
      straightSegunda: normalizados.pick2.straightSegunda.toString(),
      straightTercera: normalizados.pick2.straightTercera.toString()
    },
    singulation: {
      straight: normalizados.singulation.straight.toString()
    },
    pick3: {
      straight: normalizados.pick3.straight.toString(),
      triple: normalizados.pick3.triple.toString(),
      boxPar: normalizados.pick3.boxPar.toString(),
      boxTodosDiferentes: normalizados.pick3.boxTodosDiferentes.toString()
    },
    pick4: {
      straight: normalizados.pick4.straight.toString(),
      cuadrupleStraight: normalizados.pick4.cuadrupleStraight.toString(),
      boxCuadruple: normalizados.pick4.boxCuadruple.toString(),
      boxTresIguales: normalizados.pick4.boxTresIguales.toString(),
      boxDosPares: normalizados.pick4.boxDosPares.toString(),
      boxUnPar: normalizados.pick4.boxUnPar.toString(),
      boxTodosDiferentes: normalizados.pick4.boxTodosDiferentes.toString()
    }
  };
};

