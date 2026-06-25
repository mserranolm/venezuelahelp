import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchJson } from "@/connectors/http";

afterEach(() => vi.restoreAllMocks());

describe("fetchJson", () => {
  it("returns parsed JSON on 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(JSON.stringify({ ok: 1 }), { status: 200 }),
      ),
    );
    await expect(fetchJson<{ ok: number }>("https://x/y")).resolves.toEqual({
      ok: 1,
    });
  });

  it("throws on non-2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 500 })),
    );
    await expect(fetchJson("https://x/y")).rejects.toThrow(/500/);
  });
});
