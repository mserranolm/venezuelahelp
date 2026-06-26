import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE_NAME } from "@/shared/ddb";
import { SOURCE_PK } from "@/shared/keys";
import type { Source } from "@/shared/types";

const SK = "META";

function toSource(item: Record<string, unknown>): Source {
  const { PK, SK: _sk, ...rest } = item;
  return rest as unknown as Source;
}

export class SourceRepo {
  async put(s: Source): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: { PK: SOURCE_PK(s.id), SK, ...s },
      }),
    );
  }

  async get(id: string): Promise<Source | null> {
    const res = await ddb.send(
      new GetCommand({ TableName: TABLE_NAME, Key: { PK: SOURCE_PK(id), SK } }),
    );
    return res.Item ? toSource(res.Item) : null;
  }

  async list(): Promise<Source[]> {
    const items: Record<string, unknown>[] = [];
    let ExclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const res = await ddb.send(
        new ScanCommand({
          TableName: TABLE_NAME,
          FilterExpression: "SK = :sk",
          ExpressionAttributeValues: { ":sk": SK },
          ExclusiveStartKey,
        }),
      );
      items.push(...(res.Items ?? []));
      ExclusiveStartKey = res.LastEvaluatedKey as
        | Record<string, unknown>
        | undefined;
    } while (ExclusiveStartKey);
    return items.map(toSource);
  }

  async listEnabled(): Promise<Source[]> {
    return (await this.list()).filter((s) => s.enabled);
  }

  async delete(id: string): Promise<void> {
    await ddb.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { PK: SOURCE_PK(id), SK },
      }),
    );
  }
}
