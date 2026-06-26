import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE_NAME } from "@/shared/ddb";
import { RATE_PK } from "@/shared/keys";
import { logger } from "@/shared/logger";

export interface RateLimitOptions {
  nowMs?: number;
  /** Max requests allowed per window per chat. */
  limit?: number;
  /** Window length in seconds. */
  windowSec?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  count: number;
}

const DEFAULT_LIMIT = 10;
const DEFAULT_WINDOW_SEC = 60;

/**
 * Per-chat fixed-window rate limiter backed by the single DynamoDB table.
 *
 * Each call atomically increments a counter keyed by chat + window start and
 * stamps a `ttl` so the item self-expires (no manual cleanup, no cost creep).
 * The aim is to cap a single abuser before it reaches Bedrock; the Lambda's
 * reserved concurrency caps aggregate cost across all chats.
 *
 * Fails open: if DynamoDB is unavailable we allow the request, since blocking
 * real users during an outage is worse than the small abuse risk.
 */
export class RateLimitRepo {
  async hit(
    chatId: string,
    opts: RateLimitOptions = {},
  ): Promise<RateLimitResult> {
    const nowMs = opts.nowMs ?? Date.now();
    const limit = opts.limit ?? DEFAULT_LIMIT;
    const windowSec = opts.windowSec ?? DEFAULT_WINDOW_SEC;
    const windowStart = Math.floor(nowMs / 1000 / windowSec) * windowSec;
    const ttl = windowStart + windowSec * 2;

    try {
      const res = await ddb.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { PK: RATE_PK(chatId), SK: String(windowStart) },
          UpdateExpression: "ADD #count :one SET #ttl = :ttl",
          ExpressionAttributeNames: { "#count": "count", "#ttl": "ttl" },
          ExpressionAttributeValues: { ":one": 1, ":ttl": ttl },
          ReturnValues: "UPDATED_NEW",
        }),
      );
      const count = Number((res.Attributes as { count?: number })?.count ?? 1);
      return { allowed: count <= limit, count };
    } catch (err) {
      logger.warn("rate limit check failed, allowing", {
        error: err instanceof Error ? err.message : String(err),
      });
      return { allowed: true, count: 0 };
    }
  }
}
