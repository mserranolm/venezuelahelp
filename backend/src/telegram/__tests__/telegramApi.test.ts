import { describe, it, expect, vi } from "vitest";
import { sendMessage, getMe } from "@/telegram/telegramApi";

describe("telegramApi", () => {
  it("sendMessage POSTs chat_id and text to the bot endpoint", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    await sendMessage("TOK", 42, "hola", { fetch: fetchMock as any });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/botTOK/sendMessage");
    expect(JSON.parse((init as any).body)).toMatchObject({
      chat_id: 42,
      text: "hola",
    });
  });

  it("getMe returns the bot username", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ ok: true, result: { username: "vh_bot" } }),
          { status: 200 },
        ),
    );
    const r = await getMe("TOK", { fetch: fetchMock as any });
    expect(r.username).toBe("vh_bot");
  });
});
