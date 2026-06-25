import { describe, it, expect, beforeEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import {
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { SourceRepo } from "@/shared/repos/sourceRepo";
import type { Source } from "@/shared/types";

const ddbMock = mockClient(DynamoDBDocumentClient);
beforeEach(() => ddbMock.reset());

const src: Source = {
  id: "sismo",
  nombre: "SismoVenezuela",
  url: "https://www.sismovenezuela.com/",
  connector: "jsonApi",
  enabled: true,
};

describe("SourceRepo", () => {
  it("stores a source under SOURCE#id / META", async () => {
    ddbMock.on(PutCommand).resolves({});
    await new SourceRepo().put(src);
    const item = ddbMock.commandCalls(PutCommand)[0].args[0].input.Item;
    expect(item).toMatchObject({
      PK: "SOURCE#sismo",
      SK: "META",
      id: "sismo",
      enabled: true,
    });
  });

  it("listEnabled filters out disabled sources", async () => {
    ddbMock.on(ScanCommand).resolves({
      Items: [
        {
          PK: "SOURCE#a",
          SK: "META",
          id: "a",
          enabled: true,
          nombre: "A",
          url: "u",
          connector: "jsonApi",
        },
        {
          PK: "SOURCE#b",
          SK: "META",
          id: "b",
          enabled: false,
          nombre: "B",
          url: "u",
          connector: "jsonApi",
        },
      ],
    });
    const enabled = await new SourceRepo().listEnabled();
    expect(enabled.map((s) => s.id)).toEqual(["a"]);
  });

  it("follows pagination across multiple pages in list", async () => {
    ddbMock
      .on(ScanCommand)
      .resolvesOnce({
        Items: [
          {
            PK: "SOURCE#a",
            SK: "META",
            id: "a",
            enabled: true,
            nombre: "A",
            url: "u",
            connector: "jsonApi",
          },
        ],
        LastEvaluatedKey: { PK: "SOURCE#a", SK: "META" },
      })
      .resolvesOnce({
        Items: [
          {
            PK: "SOURCE#b",
            SK: "META",
            id: "b",
            enabled: true,
            nombre: "B",
            url: "u",
            connector: "jsonApi",
          },
        ],
      });
    const all = await new SourceRepo().list();
    expect(all.map((s) => s.id)).toEqual(["a", "b"]);
  });
});
