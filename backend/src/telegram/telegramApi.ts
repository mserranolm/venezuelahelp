type FetchFn = typeof fetch;
interface Deps {
  fetch: FetchFn;
}

const API = "https://api.telegram.org";

export async function sendMessage(
  token: string,
  chatId: number,
  text: string,
  deps?: Partial<Deps>,
): Promise<void> {
  const f = deps?.fetch ?? fetch;
  const res = await f(`${API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!res.ok) throw new Error(`sendMessage failed: ${res.status}`);
}

export async function getMe(
  token: string,
  deps?: Partial<Deps>,
): Promise<{ username: string }> {
  const f = deps?.fetch ?? fetch;
  const res = await f(`${API}/bot${token}/getMe`);
  const data = (await res.json()) as { result?: { username?: string } };
  return { username: data.result?.username ?? "" };
}
