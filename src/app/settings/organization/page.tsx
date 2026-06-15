import { notFound } from "next/navigation";
import { OrganizationSettingsClient } from "@/components/OrganizationSettingsClient";
import { isAccountManagerRole } from "@/lib/account-access";
import { requirePageCompanyUser } from "@/lib/current-user";
import { getOrganizationSnapshot } from "@/lib/organization";

export default async function OrganizationSettingsPage() {
  const user = await requirePageCompanyUser();
  if (!isAccountManagerRole(user.role)) {
    notFound();
  }

  const snapshot = await getOrganizationSnapshot(user);

  return <OrganizationSettingsClient snapshot={snapshot} />;
}
