import { describe, it, expect, vi, beforeEach } from "vitest";
import { getDataApiKey, __resetTokenCache } from "@/telegram/secret";

beforeEach(() => {
  __resetTokenCache();
});

describe("getDataApiKey", () => {
  it("devuelve la clave leída de SSM y la cachea", async () => {
    const ssm = {
      send: vi.fn().mockResolvedValue({ Parameter: { Value: "vh_live_x" } }),
    };
    const result = await getDataApiKey({ ssm: ssm as never });
    expect(result).toBe("vh_live_x");
    expect(ssm.send).toHaveBeenCalledTimes(1);

    // Segunda llamada: debe devolver el caché sin llamar SSM de nuevo
    const result2 = await getDataApiKey({ ssm: ssm as never });
    expect(result2).toBe("vh_live_x");
    expect(ssm.send).toHaveBeenCalledTimes(1);
  });
});
