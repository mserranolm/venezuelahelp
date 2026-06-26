import type { ReplyMarkup } from "@/telegram/types";

type FetchFn = typeof fetch;

const API = "https://api.telegram.org";

interface SendOpts {
  replyMarkup?: ReplyMarkup;
  fetch?: FetchFn;
}

export async function sendMessage(
  token: string,
  chatId: number,
  text: string,
  opts?: SendOpts,
): Promise<void> {
  const f = opts?.fetch ?? fetch;
  const body: Record<string, unknown> = { chat_id: chatId, text };
  if (opts?.replyMarkup) body.reply_markup = opts.replyMarkup;
  const res = await f(`${API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`sendMessage failed: ${res.status}`);
}

export async function answerCallbackQuery(
  token: string,
  callbackQueryId: string,
  opts?: { fetch?: FetchFn },
): Promise<void> {
  const f = opts?.fetch ?? fetch;
  const res = await f(`${API}/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId }),
  });
  if (!res.ok) throw new Error(`answerCallbackQuery failed: ${res.status}`);
}

export async function getMe(
  token: string,
  deps?: { fetch?: FetchFn },
): Promise<{ username: string }> {
  const f = deps?.fetch ?? fetch;
  const res = await f(`${API}/bot${token}/getMe`);
  const data = (await res.json()) as { result?: { username?: string } };
  return { username: data.result?.username ?? "" };
}
