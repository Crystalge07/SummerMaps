"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { GroupMapView } from "@/components/GroupMapView";

function GroupMapInner() {
  const params = useSearchParams();
  return <GroupMapView groupId={params.get("id") ?? undefined} />;
}

export default function GroupMapPage() {
  return (
    <Suspense fallback={<main className="page">Loading circle map…</main>}>
      <GroupMapInner />
    </Suspense>
  );
}
