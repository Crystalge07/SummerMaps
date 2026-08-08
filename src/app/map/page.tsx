import { Suspense } from "react";
import { UnifiedMapView } from "@/components/UnifiedMapView";

export default function MapPage() {
  return (
    <Suspense fallback={<div className="tab-page">Loading map…</div>}>
      <UnifiedMapView />
    </Suspense>
  );
}
