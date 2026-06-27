import "leaflet/dist/leaflet.css";
import "./mapPins.css";
import { useMemo } from "react";
import L from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import { NavigationArrow } from "@phosphor-icons/react";
import { CATEGORY_META, CATEGORY_HEX } from "@/data/categories";
import type { Category } from "@/types";
import styles from "./DetailMap.module.css";

interface Props {
  lat: number;
  lng: number;
  category: Category;
  title: string;
}

// Mini-mapa para el detalle: una sola ubicación, sin clustering ni leyenda.
// Se carga perezosamente (Leaflet es pesado) solo al abrir un detalle con
// coordenadas. El pin reusa el color/ícono de categoría del mapa principal.
export default function DetailMap({ lat, lng, category, title }: Props) {
  const icon = useMemo(() => {
    const Icon = CATEGORY_META[category].icon;
    const svg = renderToStaticMarkup(
      <Icon size={15} color="#fff" weight="fill" />,
    );
    const html = `<div class="vh-pin" style="background:${CATEGORY_HEX[category]}"><span class="vh-pin__i">${svg}</span></div>`;
    return L.divIcon({
      html,
      className: "vh-pin-wrap",
      iconSize: [30, 30],
      iconAnchor: [15, 30],
    });
  }, [category]);

  // Abre la ubicación en Google Maps (útil para indicaciones en móvil).
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  return (
    <div className={styles.wrap}>
      <MapContainer
        center={[lat, lng]}
        zoom={14}
        scrollWheelZoom={false}
        className={styles.map}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a>"
        />
        <Marker position={[lat, lng]} icon={icon} title={title} />
      </MapContainer>

      <a
        className={styles.directions}
        href={directionsUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        <NavigationArrow size={15} weight="fill" aria-hidden="true" />
        Cómo llegar
      </a>
    </div>
  );
}
