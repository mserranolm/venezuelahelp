import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const ssm = new SSMClient({});
const NAME = "/venezuelahelp/telegram-token";
let cached: string | null = null;

interface Deps {
  ssm: Pick<SSMClient, "send">;
}

export async function getTelegramToken(deps?: Partial<Deps>): Promise<string> {
  if (cached) return cached;
  const client = (deps?.ssm as Deps["ssm"]) ?? ssm;
  const res = await client.send(
    new GetParameterCommand({ Name: NAME, WithDecryption: true }),
  );
  cached = res.Parameter?.Value ?? "";
  return cached;
}

export function __resetTokenCache() {
  cached = null;
}
