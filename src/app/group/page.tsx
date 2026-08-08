import { DemoSeedButton } from "@/components/DemoSeedButton";
import { GroupPanel } from "@/components/GroupPanel";

export default function GroupPage() {
  return (
    <main className="page">
      <div style={{ width: "min(520px, 100%)", margin: "0 auto" }}>
        <GroupPanel />
        <div style={{ marginTop: "1rem" }}>
          <DemoSeedButton />
        </div>
      </div>
    </main>
  );
}
