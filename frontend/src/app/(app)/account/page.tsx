import { redirect } from "next/navigation";

// The single-balance Account page became the Accounts page.
export default function AccountPage() {
  redirect("/accounts");
}
