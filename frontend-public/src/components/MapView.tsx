import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import type { Item } from "@/types";
import type { Category } from "@/types";
import styles from "./MapView.module.css";

// Concrete hex values that mirror the --cat-* OKLCH tokens defined in DESIGN.md.
// CSS custom properties cannot be resolved inside Leaflet's SVG canvas, so we
// keep a parallel map of sRGB hex equivalents here. Update both places if the
// design tokens change.
//
//   --cat-reportes:     oklch(0.5  0.07 250) ≈ #4f6a9e  (blue-gray)
//   --cat-desaparecidos oklch(0.58 0.11  65) ≈ #9e7a2a  (amber)
//   --cat-acopios:      oklch(0.52 0.09 150) ≈ #3d8a5a  (green)
//   --cat-edificios:    oklch(0.5  0.11  30) ≈ #8a4230  (terracotta)
//   --cat-solicitudes:  oklch(0.5  0.10 290) ≈ #6a4a9e  (violet)
const CATEGORY_COLOR: Record<Category, string> = {
  reportes: "#4f6a9e",
  desaparecidos: "#9e7a2a",
  acopios: "#3d8a5a",
  edificios: "#8a4230",
  solicitudes: "#6a4a9e",
};

interface Props {
  items: Item[];
  scrollWheelZoom?: boolean;
}

export default function MapView({ items, scrollWheelZoom = false }: Props) {
  const located = items.filter((it) => it.ubicacion != null);

  return (
    <MapContainer
      center={[10.5, -66.9]}
      zoom={7}
      scrollWheelZoom={scrollWheelZoom}
      className={styles.map}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a>"
      />
      {located.map((item) => (
        <CircleMarker
          key={item.sourceId}
          center={[item.ubicacion!.lat, item.ubicacion!.lng]}
          pathOptions={{ color: CATEGORY_COLOR[item.category] }}
          radius={8}
        >
          <Popup>
            <strong>{item.titulo}</strong>
            <br />
            {item.ubicacion!.nombre}
            <br />
            <small>{item.sourceId}</small>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
