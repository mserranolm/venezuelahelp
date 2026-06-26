import { describe, it, expect, vi } from "vitest";
import { handler } from "@/telegram/handler";
import { SKIP_LOCATION_TEXT } from "@/telegram/menu";
import type { Snapshot } from "@/telegram/types";

const snap: Snapshot = {
  generatedAt: "t",
  categories: {
    acopios: [
      {
        category: "acopios",
        sourceId: "s",
        externalId: "1",
        titulo: "Acopio Chacao",
        texto: "agua",
      },
    ],
  },
};

function deps(over = {}) {
  return {
    getToken: vi.fn(async () => "TOK"),
    getWebhookSecret: vi.fn(async () => ""),
    getBotUsername: vi.fn(async () => "vh_bot"),
    configRepo: {
      get: vi.fn(async () => ({
        scrapeRateMin: 30,
        bedrockModelId: "m",
        systemPrompt: "sys",
        botTriggerMode: "mention" as const,
      })),
    },
    qaLogRepo: { append: vi.fn(async () => {}) },
    rateLimit: { hit: vi.fn(async () => ({ allowed: true, count: 1 })) },
    tgUserRepo: { upsert: vi.fn(async () => {}) },
    loadSnapshot: vi.fn(async () => snap),
    askBedrock: vi.fn(async () => ({
      text: "Hay acopio en Chacao.",
      tokensIn: 10,
      tokensOut: 5,
    })),
    sendMessage: vi.fn(async () => {}),
    answerCallbackQuery: vi.fn(async () => {}),
    menuState: {
      get: vi.fn(async () => ({})),
      setPending: vi.fn(async () => {}),
      setLocation: vi.fn(async () => {}),
      clearPending: vi.fn(async () => {}),
    },
    ...over,
  };
}

function event(text: string, extra = {}) {
  return {
    body: JSON.stringify({
      message: {
        message_id: 1,
        text,
        chat: { id: 9, type: "group" },
        from: { id: 2, username: "ana" },
        ...extra,
      },
    }),
  };
}

function callbackEvent(data: string, chatId = 9) {
  return {
    body: JSON.stringify({
      callback_query: {
        id: "cb1",
        from: { id: 2, username: "ana" },
        message: { message_id: 1, chat: { id: chatId, type: "private" } },
        data,
      },
    }),
  };
}

function locationEvent(lat: number, lng: number, chatId = 9) {
  return {
    body: JSON.stringify({
      message: {
        message_id: 1,
        chat: { id: chatId, type: "private" },
        from: { id: 2, username: "ana" },
        location: { latitude: lat, longitude: lng },
      },
    }),
  };
}

describe("telegram handler", () => {
  it("ignores messages that should not trigger (returns 200, no reply)", async () => {
    const d = deps();
    const res = await handler(event("hola a todos"), d as any);
    expect(res.statusCode).toBe(200);
    expect(d.sendMessage).not.toHaveBeenCalled();
  });

  it("fails closed when no secret is configured and TELEGRAM_REQUIRE_SECRET=true", async () => {
    process.env.TELEGRAM_REQUIRE_SECRET = "true";
    try {
      const d = deps({ getWebhookSecret: vi.fn(async () => "") });
      const res = await handler(event("@vh_bot dónde hay agua"), d as any);
      expect(res.statusCode).toBe(200);
      expect(d.sendMessage).not.toHaveBeenCalled();
      expect(d.askBedrock).not.toHaveBeenCalled();
    } finally {
      delete process.env.TELEGRAM_REQUIRE_SECRET;
    }
  });

  it("answers a mention: retrieves, calls bedrock, sends, logs", async () => {
    const d = deps();
    const res = await handler(event("@vh_bot dónde hay agua"), d as any);
    expect(res.statusCode).toBe(200);
    expect(d.askBedrock).toHaveBeenCalled();
    expect(d.sendMessage).toHaveBeenCalledWith(
      "TOK",
      9,
      "Hay acopio en Chacao.",
    );
    expect(d.qaLogRepo.append).toHaveBeenCalled();
  });

  it("on zero retrieval, replies canned and skips bedrock", async () => {
    const d = deps();
    await handler(event("@vh_bot xyzzy plutonio"), d as any);
    expect(d.askBedrock).not.toHaveBeenCalled();
    expect(d.qaLogRepo.append).toHaveBeenCalled();
    expect(d.sendMessage).toHaveBeenCalledWith(
      "TOK",
      9,
      expect.stringContaining("No tengo"),
    );
  });

  it("on /start, sends a welcome message and skips retrieval/bedrock", async () => {
    const d = deps();
    const res = await handler(
      event("/start", { chat: { id: 9, type: "private" } }),
      d as any,
    );
    expect(res.statusCode).toBe(200);
    expect(d.loadSnapshot).not.toHaveBeenCalled();
    expect(d.askBedrock).not.toHaveBeenCalled();
    expect(d.sendMessage).toHaveBeenCalledTimes(1);
    const [, , text] = (d.sendMessage as any).mock.calls[0];
    expect(text).toContain("VenezuelaHelp");
    expect(text.toLowerCase()).toContain("lenguaje natural");
  });

  it("on /start with a deep-link payload, still welcomes", async () => {
    const d = deps();
    await handler(
      event("/start ref123", { chat: { id: 9, type: "private" } }),
      d as any,
    );
    expect(d.askBedrock).not.toHaveBeenCalled();
    expect(d.sendMessage).toHaveBeenCalledTimes(1);
  });

  it("rate-limits a chat: replies with a notice and skips retrieval/bedrock/log", async () => {
    const d = deps({
      rateLimit: { hit: vi.fn(async () => ({ allowed: false, count: 11 })) },
    });
    const res = await handler(event("@vh_bot dónde hay agua"), d as any);
    expect(res.statusCode).toBe(200);
    expect(d.loadSnapshot).not.toHaveBeenCalled();
    expect(d.askBedrock).not.toHaveBeenCalled();
    expect(d.qaLogRepo.append).not.toHaveBeenCalled();
    expect(d.sendMessage).toHaveBeenCalledWith(
      "TOK",
      9,
      expect.stringContaining("muy rápido"),
    );
  });

  it("does not consume the rate limit on /start welcome", async () => {
    const hit = vi.fn(async () => ({ allowed: true, count: 1 }));
    const d = deps({ rateLimit: { hit } });
    await handler(
      event("/start", { chat: { id: 9, type: "private" } }),
      d as any,
    );
    expect(hit).not.toHaveBeenCalled();
  });

  it("rejects webhook when secret mismatch (returns 200, no reply)", async () => {
    const d = deps({
      getWebhookSecret: vi.fn(async () => "topsecret"),
    });
    const res = await handler(
      { body: event("@vh_bot dónde hay agua").body, headers: {} },
      d as any,
    );
    expect(res.statusCode).toBe(200);
    expect(d.sendMessage).not.toHaveBeenCalled();
    expect(d.askBedrock).not.toHaveBeenCalled();
  });

  it("on bedrock error, sends a fallback and still returns 200", async () => {
    const d = deps({
      askBedrock: vi.fn(async () => {
        throw new Error("ThrottlingException");
      }),
    });
    const res = await handler(event("@vh_bot dónde hay agua"), d as any);
    expect(res.statusCode).toBe(200);
    expect(d.sendMessage).toHaveBeenCalled(); // fallback message
  });

  it("captures the Telegram user (upsert) with identity from the message", async () => {
    const d = deps();
    await handler(
      event("@vh_bot dónde hay agua", {
        from: {
          id: 2,
          username: "ana",
          first_name: "Ana",
          language_code: "es",
        },
      }),
      d as any,
    );
    expect(d.tgUserRepo.upsert).toHaveBeenCalledOnce();
    const arg = (d.tgUserRepo.upsert as any).mock.calls[0][0];
    expect(arg).toMatchObject({
      chatId: 9,
      username: "ana",
      firstName: "Ana",
      languageCode: "es",
    });
  });

  it("a failing user upsert does not break the bot reply", async () => {
    const d = deps({
      tgUserRepo: {
        upsert: vi.fn(async () => {
          throw new Error("ddb down");
        }),
      },
    });
    const res = await handler(event("@vh_bot dónde hay agua"), d as any);
    expect(res.statusCode).toBe(200);
    expect(d.sendMessage).toHaveBeenCalledWith(
      "TOK",
      9,
      "Hay acopio en Chacao.",
    );
  });

  it("callback 'home' responde con teclado inline y SIEMPRE answerCallbackQuery", async () => {
    const d = deps();
    await handler(callbackEvent("home"), d as any);
    expect(d.sendMessage).toHaveBeenCalledTimes(1);
    const opts = (d.sendMessage as any).mock.calls[0][3];
    expect(opts.replyMarkup.inline_keyboard).toBeTruthy();
    expect(d.answerCallbackQuery).toHaveBeenCalledWith("TOK", "cb1");
    expect(d.askBedrock).not.toHaveBeenCalled();
  });

  it("callback de categoría sin ubicación fresca pide ubicación y guarda pending", async () => {
    const d = deps();
    await handler(callbackEvent("refugios"), d as any);
    expect(d.menuState.setPending).toHaveBeenCalledWith(9, "refugios");
    const opts = (d.sendMessage as any).mock.calls[0][3];
    expect(opts.replyMarkup.keyboard).toBeTruthy(); // reply keyboard con request_location
  });

  it("callback de categoría con ubicación fresca renderiza directo", async () => {
    const d = deps({
      menuState: {
        get: vi.fn(async () => ({
          lastLat: 10,
          lastLng: -66,
          lastLocationAt: new Date().toISOString(),
        })),
        setPending: vi.fn(async () => {}),
        setLocation: vi.fn(async () => {}),
        clearPending: vi.fn(async () => {}),
      },
    });
    await handler(callbackEvent("refugios"), d as any);
    expect(d.menuState.setPending).not.toHaveBeenCalled();
    const opts = (d.sendMessage as any).mock.calls[0][3];
    expect(opts.replyMarkup.inline_keyboard).toBeTruthy();
  });

  it("mensaje de ubicación renderiza la categoría pendiente y persiste la ubicación", async () => {
    const d = deps({
      menuState: {
        get: vi.fn(async () => ({ pendingCategory: "refugios" })),
        setPending: vi.fn(async () => {}),
        setLocation: vi.fn(async () => {}),
        clearPending: vi.fn(async () => {}),
      },
    });
    await handler(locationEvent(10.5, -66.9), d as any);
    expect(d.menuState.setLocation).toHaveBeenCalledWith(
      9,
      10.5,
      -66.9,
      expect.any(String),
    );
    expect(d.sendMessage).toHaveBeenCalled();
    expect(d.askBedrock).not.toHaveBeenCalled();
  });

  it("una pregunta libre SIGUE yendo a RAG+Bedrock (regresión)", async () => {
    const d = deps();
    await handler(
      event("dónde hay agua", { chat: { id: 9, type: "private" } }),
      d as any,
    );
    expect(d.askBedrock).toHaveBeenCalled();
  });

  it("SKIP_LOCATION_TEXT limpia pending y muestra categoría con teclado inline (sin Bedrock)", async () => {
    const d = deps({
      menuState: {
        get: vi.fn(async () => ({ pendingCategory: "refugios" })),
        setPending: vi.fn(async () => {}),
        setLocation: vi.fn(async () => {}),
        clearPending: vi.fn(async () => {}),
      },
    });
    await handler(
      event(SKIP_LOCATION_TEXT, { chat: { id: 9, type: "private" } }),
      d as any,
    );
    expect(d.menuState.clearPending).toHaveBeenCalledWith(9);
    expect(d.sendMessage).toHaveBeenCalled();
    const opts = (d.sendMessage as any).mock.calls[0][3];
    expect(opts.replyMarkup.inline_keyboard).toBeTruthy();
    expect(d.askBedrock).not.toHaveBeenCalled();
  });
});
