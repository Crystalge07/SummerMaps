import { redirect } from "next/navigation";

export default function FriendsMapPage() {
  redirect("/map?layer=friends");
}
