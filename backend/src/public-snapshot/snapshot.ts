import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { ItemRepo } from "@/shared/repos/itemRepo";
import { SourceRepo } from "@/shared/repos/sourceRepo";
import { CATEGORIES, type Category, type StoredItem } from "@/shared/types";

const s3 = new S3Client({});
const KEY = "snapshot.json";

type PublicItem = Omit<StoredItem, "raw">;

function toPublic({ raw, ...rest }: StoredItem): PublicItem {
  return rest;
}

interface Deps {
  itemRepo: Pick<ItemRepo, "listByCategory">;
  sourceRepo: Pick<SourceRepo, "list">;
  s3: Pick<S3Client, "send">;
}

export async function buildSnapshot(
  now: string,
  deps?: Partial<Deps>,
): Promise<{ key: string; count: number }> {
  const itemRepo = (deps?.itemRepo as Deps["itemRepo"]) ?? new ItemRepo();
  const sourceRepo =
    (deps?.sourceRepo as Deps["sourceRepo"]) ?? new SourceRepo();
  const client = (deps?.s3 as Deps["s3"]) ?? s3;

  const categories: Record<Category, PublicItem[]> = {} as Record<
    Category,
    PublicItem[]
  >;
  let count = 0;
  for (const cat of CATEGORIES) {
    const items = await itemRepo.listByCategory(cat);
    categories[cat] = items.map(toPublic);
    count += items.length;
  }

  // Public source directory (id → name + url) so the frontend can label and
  // link every source to its original site without hardcoding.
  const allSources = await sourceRepo.list();
  const sources: Record<string, { nombre: string; url: string }> = {};
  for (const s of allSources) {
    sources[s.id] = { nombre: s.nombre, url: s.url };
  }

  const body = JSON.stringify({ generatedAt: now, sources, categories });
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.SNAPSHOT_BUCKET,
      Key: KEY,
      Body: body,
      ContentType: "application/json",
      CacheControl: "public, max-age=300",
    }),
  );
  return { key: KEY, count };
}
