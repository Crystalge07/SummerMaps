import { redirect } from "next/navigation";

/** /path is the post-check-in destination — land on the unified map, my layer. */
export default function PathPage() {
  redirect("/map?layer=mine&fresh=1");
}
