"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FriendsPanel } from "@/components/FriendsPanel";

function FriendsInner() {
  const params = useSearchParams();
  const [initialCode, setInitialCode] = useState("");

  useEffect(() => {
    const code = params.get("add") || params.get("code");
    if (code) setInitialCode(code.toUpperCase());
  }, [params]);

  return (
    <main className="fill-page profile-shell">
      <p className="profile-page-header brand-script">your little things</p>
      <FriendsPanel initialCode={initialCode} />
    </main>
  );
}

export default function FriendsPage() {
  return (
    <Suspense
      fallback={
        <main className="fill-page profile-shell">
          <p className="profile-page-header brand-script">your little things</p>
          <p className="meta" style={{ textAlign: "center" }}>
            Loading friends…
          </p>
        </main>
      }
    >
      <FriendsInner />
    </Suspense>
  );
}
