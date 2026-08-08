import { Suspense } from "react";
import { CityMapView } from "@/components/CityMapView";

export default function CityPage() {
  return (
    <Suspense fallback={<div className="fill-page">Loading city…</div>}>
      <CityMapView />
    </Suspense>
  );
}
