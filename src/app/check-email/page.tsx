import { redirect } from "next/navigation";

export default function CheckEmailPage() {
  redirect("/verify-email");
}
