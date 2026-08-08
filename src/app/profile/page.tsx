import { AuthGate } from "@/components/AuthGate";
import { DashboardView } from "@/components/DashboardView";

export default function ProfilePage() {
  return (
    <>
      <AuthGate />
      <DashboardView />
    </>
  );
}
