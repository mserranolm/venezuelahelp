import type { SourceConnector } from "@/connectors/types";
import { sismovenezuela } from "@/connectors/sismovenezuela";
import { terremotovenezuela } from "@/connectors/terremotovenezuela";

const REGISTRY: Record<string, SourceConnector> = {
  [sismovenezuela.id]: sismovenezuela,
  [terremotovenezuela.id]: terremotovenezuela,
};

export function getConnector(sourceId: string): SourceConnector | undefined {
  return REGISTRY[sourceId];
}
