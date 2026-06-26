import type { InlineKeyboardMarkup } from "@/telegram/types";

export interface EmergencyContact {
  label: string;
  phone: string;
}

// TODO(dueño): confirmar números oficiales vigentes en Venezuela
// (Bomberos, Cruz Roja Venezolana, Protección Civil / PCNGRD) y añadirlos aquí
// en formato internacional (+58...) para que Telegram los haga "tap para llamar".
export const EMERGENCY_CONTACTS: EmergencyContact[] = [
  { label: "Emergencias (nacional)", phone: "911" },
];

export interface MonitoringLink {
  label: string;
  url: string;
}

// TODO(dueño): cuentas/páginas de X de monitoreo oficial de rescates en
// tiempo real (p.ej. Protección Civil, Cruz Roja). Deben ser URLs https.
export const MONITORING_LINKS: MonitoringLink[] = [];

export function renderEmergency(): {
  text: string;
  replyMarkup: InlineKeyboardMarkup;
} {
  const lines = [
    "🚑 Emergencias médicas y rescate",
    "",
    "Números oficiales (toca el número para llamar):",
    ...EMERGENCY_CONTACTS.map((c) => `• ${c.label}: ${c.phone}`),
  ];
  if (MONITORING_LINKS.length === 0) {
    lines.push(
      "",
      "ℹ️ La lista de monitoreo en tiempo real está en actualización.",
    );
  }
  const inline_keyboard = [
    ...MONITORING_LINKS.map((l) => [{ text: `📡 ${l.label}`, url: l.url }]),
    [{ text: "⬅️ Volver", callback_data: "ayuda" }],
  ];
  return { text: lines.join("\n"), replyMarkup: { inline_keyboard } };
}
