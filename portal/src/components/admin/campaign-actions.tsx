"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Download, Pencil, Rocket, XCircle } from "lucide-react";
import { launchCampaignAction, setCampaignStatusAction } from "@/server/actions/campaigns";
import { Button, ButtonAnchor, ButtonLink } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useAction } from "@/components/ui/use-action";

export function CampaignActions({ id, status, audience, channel }: { id: string; status: string; audience: number; channel: string }) {
  const t = useTranslations("admin.campaigns");
  const [open, setOpen] = useState(false);
  const complete = useAction(setCampaignStatusAction);
  const cancel = useAction(setCampaignStatusAction, { successToast: t("cancelled") });
  // The dialog closes on every outcome, as before, so the result toast (and its retry) is not under the modal.
  const launch = useAction(
    async (campaignId: string) => {
      try {
        return await launchCampaignAction(campaignId);
      } finally {
        setOpen(false);
      }
    },
    { successToast: (res) => t("launchedCount", { count: res.count ?? 0 }), errorMap: (res) => t("launchBlocked", { reason: t(`blocked.${res.reason ?? "empty"}`) }) },
  );
  const pending = complete.pending || cancel.pending || launch.pending;
  return (
    <div className="flex flex-wrap gap-2">
      {status === "draft" || status === "scheduled" ? (
        <Button icon={<Rocket />} onClick={() => setOpen(true)}>
          {t("launch")}
        </Button>
      ) : null}
      {status === "draft" || status === "scheduled" ? (
        <ButtonLink variant="secondary" icon={<Pencil />} href={`/admin/campaigns/edit/${id}`}>
          {t("edit")}
        </ButtonLink>
      ) : null}
      {channel === "usb" && (status === "running" || status === "completed") ? (
        <ButtonAnchor variant="secondary" icon={<Download />} href={`/api/admin/campaigns/${id}/usb-kit`} title={t("usbKitBody")}>
          {t("usbKit")}
        </ButtonAnchor>
      ) : null}
      {status === "running" ? (
        <Button variant="secondary" icon={<CheckCircle2 />} disabled={pending} onClick={() => complete.run(id, "completed")}>
          {t("complete")}
        </Button>
      ) : null}
      {status === "draft" || status === "scheduled" || status === "running" ? (
        <Button variant="danger-soft" icon={<XCircle />} disabled={pending} onClick={() => cancel.run(id, "cancelled")}>
          {t("cancel")}
        </Button>
      ) : null}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("launchTitle")}
        size="sm"
        footer={
          <Button
            icon={<Rocket />}
            disabled={pending}
            onClick={() => launch.run(id)}
          >
            {t("launch")}
          </Button>
        }
      >
        <p className="text-body-sm text-ink-muted">{t("launchBody", { count: audience })}</p>
      </Dialog>
    </div>
  );
}
