import { describe, it, expect, beforeEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { RateLimitRepo } from "@/shared/repos/rateLimitRepo";

const ddbMock = mockClient(DynamoDBDocumentClient);

beforeEach(() => ddbMock.reset());

// Fixed clock so the window key is deterministic.
const NOW = 1_700_000_000_000; // ms

describe("RateLimitRepo", () => {
  it("allows when the per-window count is within the limit", async () => {
    ddbMock.on(UpdateCommand).resolves({ Attributes: { count: 3 } });
    const res = await new RateLimitRepo().hit("9", {
      nowMs: NOW,
      limit: 10,
      windowSec: 60,
    });
    expect(res.allowed).toBe(true);
    expect(res.count).toBe(3);
  });

  it("blocks once the count exceeds the limit", async () => {
    ddbMock.on(UpdateCommand).resolves({ Attributes: { count: 11 } });
    const res = await new RateLimitRepo().hit("9", {
      nowMs: NOW,
      limit: 10,
      windowSec: 60,
    });
    expect(res.allowed).toBe(false);
    expect(res.count).toBe(11);
  });

  it("atomically increments a per-chat fixed-window counter with a TTL", async () => {
    ddbMock.on(UpdateCommand).resolves({ Attributes: { count: 1 } });
    await new RateLimitRepo().hit("9", {
      nowMs: NOW,
      limit: 10,
      windowSec: 60,
    });

    const call = ddbMock.commandCalls(UpdateCommand)[0];
    const input = call.args[0].input as any;
    const windowStart = Math.floor(NOW / 1000 / 60) * 60;
    expect(input.Key).toEqual({ PK: "RATE#9", SK: String(windowStart) });
    // ADD increments the counter; a ttl attribute lets DynamoDB auto-expire it.
    expect(input.UpdateExpression).toContain("ADD");
    expect(input.ExpressionAttributeValues[":one"]).toBe(1);
    expect(input.ExpressionAttributeValues[":ttl"]).toBeGreaterThan(
      windowStart,
    );
  });

  it("fails open (allows) if DynamoDB errors, to never block real users", async () => {
    ddbMock.on(UpdateCommand).rejects(new Error("ddb down"));
    const res = await new RateLimitRepo().hit("9", { nowMs: NOW });
    expect(res.allowed).toBe(true);
  });
});
