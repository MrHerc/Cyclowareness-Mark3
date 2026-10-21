import { redirect } from "next/navigation";
import { hasFeature, requirePermission } from "@/server/auth/viewer";

/** The feeds live at /admin/intel/threat and /admin/intel/policy; the section root and the old ?kind= links forward there. */
export default async function IntelIndex({ searchParams }: PageProps<"/admin/intel">) {
  const v = await requirePermission("intel.read");
  const sp = await searchParams;
  const kind = sp.kind === "policy" || (sp.kind !== "threat" && !hasFeature(v, "threat_intel")) ? "policy" : "threat";
  const status = typeof sp.status === "string" ? `?status=${encodeURIComponent(sp.status)}` : "";
  redirect(`/admin/intel/${kind}${status}`);
}
