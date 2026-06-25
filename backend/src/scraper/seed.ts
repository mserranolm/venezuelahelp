import { SourceRepo } from "@/shared/repos/sourceRepo";
import type { Source } from "@/shared/types";

const SEED: Source[] = [
  {
    id: "sismovenezuela",
    nombre: "SismoVenezuela",
    url: "https://www.sismovenezuela.com/",
    connector: "jsonApi",
    enabled: true,
  },
  {
    id: "terremotovenezuela",
    nombre: "Terremoto Venezuela",
    url: "https://terremotovenezuela.app/",
    connector: "jsonApi",
    enabled: true,
  },
];

export async function ensureSeedSources(
  repo: SourceRepo = new SourceRepo(),
): Promise<void> {
  for (const s of SEED) {
    const existing = await repo.get(s.id);
    if (!existing) await repo.put(s);
  }
}
