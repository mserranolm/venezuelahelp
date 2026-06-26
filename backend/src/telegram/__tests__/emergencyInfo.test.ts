import { describe, it, expect } from "vitest";
import { EMERGENCY_CONTACTS, renderEmergency } from "@/telegram/emergencyInfo";

describe("renderEmergency", () => {
  it("incluye el 911 y un botón de Volver hacia 'ayuda'", () => {
    const r = renderEmergency();
    expect(r.text).toContain("911");
    const flat = r.replyMarkup.inline_keyboard.flat();
    expect(flat.some((b) => b.callback_data === "ayuda")).toBe(true);
  });

  it("todos los teléfonos son cadenas no vacías", () => {
    for (const c of EMERGENCY_CONTACTS) {
      expect(c.phone.trim().length).toBeGreaterThan(0);
    }
  });

  it("avisa que el monitoreo está en actualización si no hay enlaces", () => {
    const r = renderEmergency();
    // Con MONITORING_LINKS vacío (placeholder), debe avisar.
    if (
      r.replyMarkup.inline_keyboard.flat().filter((b) => b.url).length === 0
    ) {
      expect(r.text.toLowerCase()).toContain("actualización");
    }
  });
});
