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

// El enlace "ver fuente" pertenece a la fuente, no al ítem: cada `sourceId`
// tiene exactamente una URL. Exponemos un mapa por fuente (en vez de repetir la
// URL en cada ítem) para que el frontend resuelva `sources[item.sourceId]` sin
// inflar el snapshot.
type PublicSource = { nombre: string; url: string };

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

  const sources: Record<string, PublicSource> = {};
  for (const s of await sourceRepo.list()) {
    sources[s.id] = { nombre: s.nombre, url: s.url };
  }

  const body = JSON.stringify({ generatedAt: now, categories, sources });
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
