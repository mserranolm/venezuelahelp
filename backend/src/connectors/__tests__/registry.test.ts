import { describe, it, expect } from "vitest";
import { getConnector } from "@/connectors/registry";

describe("getConnector", () => {
  it("resolves known sources", () => {
    expect(getConnector("sismovenezuela")?.id).toBe("sismovenezuela");
    expect(getConnector("terremotovenezuela")?.id).toBe("terremotovenezuela");
  });
  it("returns undefined for unknown", () => {
    expect(getConnector("nope")).toBeUndefined();
  });
});
