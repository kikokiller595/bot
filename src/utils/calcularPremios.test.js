import { calcularPremio, numeroCoincide } from './calcularPremios';

test('calcula premios straight y box', () => {
  expect(calcularPremio('straight', '123', 2)).toBe(1400);
  expect(calcularPremio('box', '123', 2)).toBe(232);
});

test('compara numeros box sin importar el orden', () => {
  expect(numeroCoincide('321', '123', 'box')).toBe(true);
  expect(numeroCoincide('322', '123', 'box')).toBe(false);
});
