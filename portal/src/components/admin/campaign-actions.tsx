"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Download, Pencil, Rocket, XCircle } from "lucide-react";
import { launchCampaignAction, setCampaignStatusAction } from "@/server/actions/campaigns";
import { Button, ButtonAnchor, ButtonLink } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";

export function CampaignActions({ id, status, audience, channel }: { id: string; status: string; audience: number; channel: string }) {
  const t = useTranslations("admin.campaigns");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
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
        <Button variant="secondary" icon={<CheckCircle2 />} disabled={pending} onClick={() => start(async () => void (await setCampaignStatusAction(id, "completed")))}>
          {t("complete")}
        </Button>
      ) : null}
      {status === "draft" || status === "scheduled" || status === "running" ? (
        <Button variant="danger-soft" icon={<XCircle />} disabled={pending} onClick={() => start(async () => void ((await setCampaignStatusAction(id, "cancelled")).ok && toast(t("cancelled"))))}>
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
            onClick={() =>
              start(async () => {
                const res = await launchCampaignAction(id);
                setOpen(false);
                if (res.ok) toast(`${t("launched")} (${res.count})`);
                else toast(t("launchBlocked", { reason: t(`blocked.${res.reason ?? "empty"}`) }), "error");
              })
            }
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
