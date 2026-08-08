"use client";

import { useState } from "react";
import { storageMode } from "@/lib/api";
import { loadLocalDemoSeed } from "@/lib/demoSeed";
import { setActiveGroupId } from "@/lib/device";

export function DemoSeedButton() {
  const [msg, setMsg] = useState("");

  if (storageMode() === "supabase") {
    return (
      <p className="seed-note">
        Supabase mode: run <code>npm run seed</code> after applying{" "}
        <code>supabase/schema.sql</code>.
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        className="btn ghost"
        onClick={async () => {
          const { group, count } = await loadLocalDemoSeed();
          setActiveGroupId(group.id);
          setMsg(`Loaded ${count} demo stops. Circle code ${group.code}.`);
        }}
      >
        Load demo paths
      </button>
      {msg && <p className="seed-note">{msg}</p>}
    </div>
  );
}
