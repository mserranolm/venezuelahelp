import { describe, it, expect, beforeEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { MenuStateRepo } from "@/telegram/menuState";

const ddbMock = mockClient(DynamoDBDocumentClient);
beforeEach(() => ddbMock.reset());

describe("MenuStateRepo", () => {
  it("get devuelve el estado del ítem del usuario", async () => {
    ddbMock.on(GetCommand).resolves({
      Item: {
        PK: "TGUSER",
        SK: "5",
        pendingCategory: "refugios",
        lastLat: 10,
        lastLng: -66,
        lastLocationAt: "2026-06-26T00:00:00Z",
      },
    });
    const s = await new MenuStateRepo().get(5);
    expect(s).toEqual({
      pendingCategory: "refugios",
      lastLat: 10,
      lastLng: -66,
      lastLocationAt: "2026-06-26T00:00:00Z",
    });
    const input = ddbMock.commandCalls(GetCommand)[0].args[0].input as any;
    expect(input.Key).toEqual({ PK: "TGUSER", SK: "5" });
  });

  it("get devuelve objeto vacío si el ítem no existe", async () => {
    ddbMock.on(GetCommand).resolves({});
    expect(await new MenuStateRepo().get(9)).toEqual({});
  });

  it("setPending escribe pendingCategory", async () => {
    ddbMock.on(UpdateCommand).resolves({});
    await new MenuStateRepo().setPending(5, "viveres");
    const input = ddbMock.commandCalls(UpdateCommand)[0].args[0].input as any;
    expect(input.Key).toEqual({ PK: "TGUSER", SK: "5" });
    expect(input.UpdateExpression).toContain("pendingCategory");
    expect(input.ExpressionAttributeValues[":c"]).toBe("viveres");
  });

  it("setLocation guarda coords y limpia pendingCategory", async () => {
    ddbMock.on(UpdateCommand).resolves({});
    await new MenuStateRepo().setLocation(
      5,
      10.5,
      -66.9,
      "2026-06-26T01:00:00Z",
    );
    const input = ddbMock.commandCalls(UpdateCommand)[0].args[0].input as any;
    expect(input.UpdateExpression).toContain("REMOVE pendingCategory");
    expect(input.ExpressionAttributeValues[":la"]).toBe(10.5);
    expect(input.ExpressionAttributeValues[":ln"]).toBe(-66.9);
  });

  it("clearPending hace REMOVE", async () => {
    ddbMock.on(UpdateCommand).resolves({});
    await new MenuStateRepo().clearPending(5);
    const input = ddbMock.commandCalls(UpdateCommand)[0].args[0].input as any;
    expect(input.UpdateExpression).toContain("REMOVE pendingCategory");
  });
});
