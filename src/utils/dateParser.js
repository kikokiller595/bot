import {
  normalizarClaveFecha,
  claveHoyOperativa
} from './zonaHoraria';

/**
 * Convierte cualquier valor de fecha a clave YYYY-MM-DD en la zona operativa.
 * Soporta: Date, string ISO (instante), string dd/mm/yyyy (con hora opcional).
 * Los instantes con hora se convierten a la zona operativa (America/New_York),
 * no a la hora del navegador.
 */
export const obtenerClaveFecha = (valor) => normalizarClaveFecha(valor);

/**
 * Clave YYYY-MM-DD del dia de hoy en la zona operativa.
 */
export const obtenerFechaActualLocal = () => claveHoyOperativa();
