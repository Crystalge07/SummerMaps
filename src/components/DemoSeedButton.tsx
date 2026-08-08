"use client";

import { useState } from "react";
import { loadLocalDemoSeed } from "@/lib/demoSeed";
import { storageMode } from "@/lib/api";

export function DemoSeedButton({ onLoaded }: { onLoaded?: () => void }) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  if (storageMode() === "supabase") return null;

  return (
    <div className="demo-seed">
      <button
        type="button"
        className="btn ghost"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const { friendCodes, count } = await loadLocalDemoSeed();
            setMsg(
              `Loaded ${count} finds. Demo friends: ${friendCodes.join(", ")}.`,
            );
            onLoaded?.();
          } catch (err) {
            setMsg(err instanceof Error ? err.message : "Seed failed.");
          } finally {
            setBusy(false);
          }
        }}
      >
        Load demo paths
      </button>
      {msg && <p className="meta">{msg}</p>}
    </div>
  );
}
