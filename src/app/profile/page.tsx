import { AuthGate } from "@/components/AuthGate";
import { DashboardView } from "@/components/DashboardView";

export default function ProfilePage() {
  return (
    <>
      <p className="profile-page-header brand-script">your little things</p>
      <AuthGate />
      <DashboardView />
    </>
  );
}
