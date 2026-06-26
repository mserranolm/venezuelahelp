import { describe, it, expect, vi } from "vitest";
import {
  sendMessage,
  getMe,
  answerCallbackQuery,
} from "@/telegram/telegramApi";

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

  it("sendMessage incluye reply_markup cuando se pasa", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const markup = {
      inline_keyboard: [[{ text: "Ir", callback_data: "home" }]],
    };
    await sendMessage("TOK", 7, "hola", {
      replyMarkup: markup,
      fetch: fetchMock as any,
    });
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse((init as any).body)).toMatchObject({
      chat_id: 7,
      text: "hola",
      reply_markup: markup,
    });
  });

  it("sendMessage NO incluye reply_markup cuando no se pasa", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    await sendMessage("TOK", 7, "hola", { fetch: fetchMock as any });
    expect(
      JSON.parse((fetchMock.mock.calls[0][1] as any).body),
    ).not.toHaveProperty("reply_markup");
  });

  it("answerCallbackQuery hace POST con callback_query_id", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    await answerCallbackQuery("TOK", "cb1", { fetch: fetchMock as any });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/botTOK/answerCallbackQuery");
    expect(JSON.parse((init as any).body)).toMatchObject({
      callback_query_id: "cb1",
    });
  });
});
