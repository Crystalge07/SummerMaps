import { AuthGate } from "@/components/AuthGate";
import { ProfileView } from "@/components/ProfileView";

export default function ProfilePage() {
  return (
    <main className="fill-page profile-shell">
      <p className="profile-page-header brand-script">your little things</p>
      {/* AuthGate only for sign-in / username claim; signed-in UI is ProfileView */}
      <AuthGate />
      <ProfileView />
    </main>
  );
}
