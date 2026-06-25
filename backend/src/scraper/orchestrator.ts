import { SourceRepo } from "@/shared/repos/sourceRepo";
import { ItemRepo } from "@/shared/repos/itemRepo";
import { getConnector as defaultGetConnector } from "@/connectors/registry";
import { ensureSeedSources } from "@/scraper/seed";
import type { Source } from "@/shared/types";

export interface SourceResult {
  sourceId: string;
  fetched: number;
  created: number;
  updated: number;
  unchanged: number;
  error?: string;
}

interface Deps {
  sourceRepo: Pick<SourceRepo, "listEnabled" | "put">;
  itemRepo: Pick<ItemRepo, "upsert">;
  seed: (repo: SourceRepo) => Promise<void>;
  getConnector: typeof defaultGetConnector;
}

export async function runScrape(
  now: string,
  deps?: Partial<Deps>,
): Promise<SourceResult[]> {
  const sourceRepo =
    (deps?.sourceRepo as Deps["sourceRepo"]) ?? new SourceRepo();
  const itemRepo = (deps?.itemRepo as Deps["itemRepo"]) ?? new ItemRepo();
  const seed = deps?.seed ?? ensureSeedSources;
  const getConnector = deps?.getConnector ?? defaultGetConnector;

  await seed(sourceRepo as SourceRepo);
  const sources = await sourceRepo.listEnabled();
  const results: SourceResult[] = [];

  for (const source of sources) {
    const result: SourceResult = {
      sourceId: source.id,
      fetched: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
    };
    const next: Source = { ...source, lastRun: now };
    try {
      const connector = getConnector(source.id);
      if (!connector) throw new Error(`no connector for ${source.id}`);
      const items = await connector.fetchItems();
      result.fetched = items.length;
      for (const item of items) {
        const r = await itemRepo.upsert(item, now);
        result[r] += 1;
      }
      next.lastStatus = "ok";
      next.errorMsg = undefined;
    } catch (err) {
      result.error = err instanceof Error ? err.message : String(err);
      next.lastStatus = "error";
      next.errorMsg = result.error;
    }
    await sourceRepo.put(next);
    results.push(result);
  }
  return results;
}
