import { useEffect, useState } from "react";
import type { Snapshot } from "@/types";

const URL = import.meta.env.VITE_SNAPSHOT_URL ?? "/snapshot.json";

export function useSnapshot() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: Snapshot) => {
        if (alive) {
          setData(d);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (alive) {
          setError(e instanceof Error ? e.message : "error");
          setLoading(false);
        }
      });

    return () => {
      alive = false;
    };
  }, []);

  return { data, loading, error };
}
