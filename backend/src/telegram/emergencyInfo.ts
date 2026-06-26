import type { InlineKeyboardMarkup } from "@/telegram/types";

export interface EmergencyContact {
  label: string;
  phone: string;
}

// Números oficiales nacionales de Venezuela (verificados 2026-06-26).
// El 911 (SIGAE-911) cubre policía, bomberos y ambulancia en todo el país; las
// líneas por operadora son alternativas equivalentes. Se muestran en formato de
// marcado local porque la audiencia llama desde teléfonos venezolanos.
// Pueden existir variantes por estado; estos son los de alcance nacional.
export const EMERGENCY_CONTACTS: EmergencyContact[] = [
  { label: "Emergencias — policía, bomberos y ambulancia", phone: "911" },
  {
    label: "Emergencias por operadora",
    phone: "171 (CANTV) · *1 (Movilnet) · 112 (Digitel)",
  },
  { label: "Protección Civil (PCNGRD)", phone: "0800-558-8427" },
  { label: "Cruz Roja Venezolana — Caracas", phone: "0212-571-4380" },
  { label: "Cruz Roja Venezolana — WhatsApp", phone: "0424-219-0429" },
];

export interface MonitoringLink {
  label: string;
  url: string;
}

// Cuentas oficiales de monitoreo en tiempo real (verificadas 2026-06-26).
// FUNVISIS es el servicio sismológico oficial: la fuente clave para un terremoto.
export const MONITORING_LINKS: MonitoringLink[] = [
  { label: "FUNVISIS — sismos en vivo", url: "https://x.com/SomosFunvisis" },
  { label: "Cruz Roja Venezolana", url: "https://x.com/cruzrojave" },
];

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
