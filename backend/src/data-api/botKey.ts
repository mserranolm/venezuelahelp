import {
  SSMClient,
  GetParameterCommand,
  PutParameterCommand,
} from "@aws-sdk/client-ssm";
import { ApiKeyRepo } from "@/shared/repos/apiKeyRepo";

export const BOT_API_KEY_PARAM = "/venezuelahelp/bot/data-api-key";

interface Deps {
  ssm: Pick<SSMClient, "send">;
  apiKeyRepo: Pick<ApiKeyRepo, "create">;
  now: string;
}

// Idempotente: si el parámetro existe, no regenera (la raw solo se conoce una
// vez). Si falta, crea una API key (vh_live_*) y guarda la raw en SSM Secure.
export async function ensureBotApiKey(
  deps: Partial<Deps> = {},
): Promise<{ created: boolean }> {
  const ssm = (deps.ssm as Deps["ssm"]) ?? new SSMClient({});
  const apiKeyRepo =
    (deps.apiKeyRepo as Deps["apiKeyRepo"]) ?? new ApiKeyRepo();
  const now = deps.now ?? new Date().toISOString();

  try {
    const res = await ssm.send(
      new GetParameterCommand({
        Name: BOT_API_KEY_PARAM,
        WithDecryption: true,
      }),
    );
    if (res.Parameter?.Value) return { created: false };
  } catch (err) {
    if ((err as { name?: string }).name !== "ParameterNotFound") throw err;
  }

  const { rawKey } = await apiKeyRepo.create({
    consumerName: "telegram-bot",
    email: "internal",
    requestId: "internal-bot",
    createdAt: now,
  });
  await ssm.send(
    new PutParameterCommand({
      Name: BOT_API_KEY_PARAM,
      Value: rawKey,
      Type: "SecureString",
      Overwrite: false,
    }),
  );
  return { created: true };
}
