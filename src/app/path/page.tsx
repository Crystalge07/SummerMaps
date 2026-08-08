import { redirect } from "next/navigation";

export default function PathPage() {
  redirect("/map?layer=mine");
}
