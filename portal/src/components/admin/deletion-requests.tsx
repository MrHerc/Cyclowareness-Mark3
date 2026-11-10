"use client";

import { useTranslations } from "next-intl";
import { useClientFormat } from "@/lib/client-format";
import { UserX } from "lucide-react";
import { decideDeletionAction } from "@/server/actions/people";
import { Button } from "@/components/ui/button";
import { useAction } from "@/components/ui/use-action";

export function DeletionRequests({ people }: { people: { id: string; name: string; email: string; at: string }[] }) {
  const t = useTranslations("admin.people");
  const format = useClientFormat();
  const { run, pending } = useAction(decideDeletionAction);
  return (
    <section className="rounded-xl border border-warn-100 bg-warn-50 p-4">
      <p className="flex items-center gap-2 text-body-sm font-bold text-warn-700">
        <UserX className="size-5" />
        {t("deletionRequests")}
      </p>
      <ul className="mt-3 grid gap-2">
        {people.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-surface px-3.5 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block text-body-sm font-semibold">{p.name}</span>
              <span className="text-tab text-ink-subtle">
                <bdi>{p.email}</bdi> · {format.dateTime(new Date(p.at), { dateStyle: "medium" })}
              </span>
            </span>
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(p.id, false)}>
              {t("decline")}
            </Button>
            <Button size="sm" variant="danger" disabled={pending} onClick={() => run(p.id, true)}>
              {t("approve")}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
