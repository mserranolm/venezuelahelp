// Rejilla determinística para agrupar coordenadas cercanas sin dependencia de
// geohash. size=0.01 grados ≈ 1.1 km en latitud — suficiente para juntar dos
// reportes del mismo edificio/zona sin fusionar zonas distintas.
export function geoCell(lat: number, lng: number, size = 0.01): string {
  const cell = (n: number) => Math.round(n / size);
  return `${cell(lat)}:${cell(lng)}`;
}
