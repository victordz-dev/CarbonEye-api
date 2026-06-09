import type { Coordenada } from './geo.types';

/**
 * Converte um array de coordenadas em uma representação WKT de polígono para o PostGIS.
 */
export function coordenadasParaWktPolygon(coords: Coordenada[]): string {
  if (coords.length < 3) {
    throw new Error('Um polígono necessita de pelo menos 3 pontos.');
  }
  const pontos = coords.map((c) => `${c.longitude} ${c.latitude}`);
  // Garante que o polígono esteja fechado para o PostGIS
  if (pontos[0] !== pontos[pontos.length - 1]) {
    pontos.push(pontos[0]);
  }
  return `POLYGON((${pontos.join(', ')}))`;
}

/**
 * Calcula o centroide (média aritmética) de um array de coordenadas.
 */
export function obterCentroide(coords: Coordenada[]): Coordenada {
  const avgLat =
    coords.reduce((sum, c) => sum + c.latitude, 0) / coords.length;
  const avgLon =
    coords.reduce((sum, c) => sum + c.longitude, 0) / coords.length;
  return { latitude: avgLat, longitude: avgLon };
}

/**
 * Verifica se as coordenadas estão dentro da bounding box aproximada do Brasil.
 */
export function isDentroDoBrasil(coords: Coordenada[]): boolean {
  for (const c of coords) {
    if (
      c.latitude > 5.3 ||
      c.latitude < -33.8 ||
      c.longitude > -34.7 ||
      c.longitude < -74.0
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Fecha um polígono (garante que o primeiro e último ponto sejam iguais).
 * Retorna coordenadas no formato GeoJSON [longitude, latitude].
 */
export function fecharPoligono(
  coords: Coordenada[],
): [number, number][] {
  const formatted = coords.map(
    (c) => [c.longitude, c.latitude] as [number, number],
  );
  const primeiro = formatted[0];
  const ultimo = formatted[formatted.length - 1];
  if (primeiro[0] !== ultimo[0] || primeiro[1] !== ultimo[1]) {
    formatted.push(primeiro);
  }
  return formatted;
}
