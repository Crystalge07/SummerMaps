import { AuthGate } from "@/components/AuthGate";
import { ProfileView } from "@/components/ProfileView";

export default function ProfilePage() {
  return (
    <main className="fill-page">
      <p className="profile-page-header brand-script">your little things</p>
      <AuthGate />
      <ProfileView />
    </main>
  );
}
