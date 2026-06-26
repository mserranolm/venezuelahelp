import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE_NAME } from "@/shared/ddb";
import { TGUSER_PK } from "@/shared/keys";

export interface MenuState {
  pendingCategory?: string;
  lastLat?: number;
  lastLng?: number;
  lastLocationAt?: string;
}

function key(chatId: number) {
  return { PK: TGUSER_PK, SK: String(chatId) };
}

export class MenuStateRepo {
  async get(chatId: number): Promise<MenuState> {
    const res = await ddb.send(
      new GetCommand({ TableName: TABLE_NAME, Key: key(chatId) }),
    );
    const it = (res.Item ?? {}) as Record<string, unknown>;
    const out: MenuState = {};
    if (typeof it.pendingCategory === "string")
      out.pendingCategory = it.pendingCategory;
    if (typeof it.lastLat === "number") out.lastLat = it.lastLat;
    if (typeof it.lastLng === "number") out.lastLng = it.lastLng;
    if (typeof it.lastLocationAt === "string")
      out.lastLocationAt = it.lastLocationAt;
    return out;
  }

  async setPending(chatId: number, category: string): Promise<void> {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: key(chatId),
        UpdateExpression: "SET pendingCategory = :c",
        ExpressionAttributeValues: { ":c": category },
      }),
    );
  }

  async setLocation(
    chatId: number,
    lat: number,
    lng: number,
    now: string,
  ): Promise<void> {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: key(chatId),
        UpdateExpression:
          "SET lastLat = :la, lastLng = :ln, lastLocationAt = :ts REMOVE pendingCategory",
        ExpressionAttributeValues: { ":la": lat, ":ln": lng, ":ts": now },
      }),
    );
  }

  async clearPending(chatId: number): Promise<void> {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: key(chatId),
        UpdateExpression: "REMOVE pendingCategory",
      }),
    );
  }
}
