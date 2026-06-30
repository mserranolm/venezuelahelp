import { GetCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE_NAME } from "@/shared/ddb";
import { TGUSER_PK } from "@/shared/keys";

export interface TgUserUpsert {
  chatId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode?: string;
  now: string; // ISO
}

export interface TgUserRecord {
  chatId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  msgCount: number;
  // Moderación: strikes consecutivos (off-topic / no permitido) y bloqueo.
  strikes?: number;
  blocked?: boolean;
  blockedAt?: string;
  blockReason?: string;
}

export class TgUserRepo {
  // Upsert idempotente por chatId: actualiza identidad y lastSeenAt, fija
  // firstSeenAt solo la primera vez, e incrementa msgCount. Las claves PK/SK no
  // se devuelven en el record (se filtran al listar).
  async upsert(u: TgUserUpsert): Promise<void> {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: TGUSER_PK, SK: String(u.chatId) },
        UpdateExpression:
          "SET chatId = :id, lastSeenAt = :now, firstSeenAt = if_not_exists(firstSeenAt, :now)" +
          ", username = :un, firstName = :fn, lastName = :ln, languageCode = :lc" +
          " ADD msgCount :one",
        ExpressionAttributeValues: {
          ":id": u.chatId,
          ":now": u.now,
          ":un": u.username ?? null,
          ":fn": u.firstName ?? null,
          ":ln": u.lastName ?? null,
          ":lc": u.languageCode ?? null,
          ":one": 1,
        },
      }),
    );
  }

  // Lee un usuario por chatId (para conocer su estado de bloqueo/strikes en el
  // hot path del bot). Devuelve null si no existe todavía.
  async get(chatId: number): Promise<TgUserRecord | null> {
    const res = await ddb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: TGUSER_PK, SK: String(chatId) },
      }),
    );
    if (!res.Item) return null;
    const { PK, SK, ...rest } = res.Item;
    void PK;
    void SK;
    return rest as unknown as TgUserRecord;
  }

  // Incrementa los strikes consecutivos y devuelve el nuevo total.
  async recordStrike(chatId: number): Promise<number> {
    const res = await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: TGUSER_PK, SK: String(chatId) },
        UpdateExpression: "ADD strikes :one",
        ExpressionAttributeValues: { ":one": 1 },
        ReturnValues: "UPDATED_NEW",
      }),
    );
    return (res.Attributes?.strikes as number) ?? 0;
  }

  // Resetea los strikes a 0 (tras un mensaje válido on-topic).
  async resetStrikes(chatId: number): Promise<void> {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: TGUSER_PK, SK: String(chatId) },
        UpdateExpression: "SET strikes = :z",
        ExpressionAttributeValues: { ":z": 0 },
      }),
    );
  }

  // Marca/desmarca el bloqueo. Al bloquear fija blockedAt+blockReason; al
  // desbloquear (desde el admin) limpia el bloqueo y resetea strikes.
  async setBlocked(
    chatId: number,
    blocked: boolean,
    now: string,
    reason?: string,
  ): Promise<void> {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: TGUSER_PK, SK: String(chatId) },
        UpdateExpression: blocked
          ? "SET blocked = :b, blockedAt = :now, blockReason = :r"
          : "SET blocked = :b, strikes = :z REMOVE blockedAt, blockReason",
        ExpressionAttributeValues: blocked
          ? { ":b": true, ":now": now, ":r": reason ?? "" }
          : { ":b": false, ":z": 0 },
      }),
    );
  }

  async list(): Promise<TgUserRecord[]> {
    const users: TgUserRecord[] = [];
    let ExclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const res = await ddb.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: "PK = :pk",
          ExpressionAttributeValues: { ":pk": TGUSER_PK },
          ExclusiveStartKey,
        }),
      );
      for (const it of res.Items ?? []) {
        const { PK, SK, ...rest } = it;
        void PK;
        void SK;
        users.push(rest as unknown as TgUserRecord);
      }
      ExclusiveStartKey = res.LastEvaluatedKey as
        Record<string, unknown> | undefined;
    } while (ExclusiveStartKey);
    return users.sort((a, b) =>
      (b.lastSeenAt ?? "").localeCompare(a.lastSeenAt ?? ""),
    );
  }
}
