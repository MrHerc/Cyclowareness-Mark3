import {
  AlarmClock,
  AppWindow,
  Award,
  BriefcaseBusiness,
  Cloud,
  Download,
  Drama,
  Eye,
  FileLock,
  Fish,
  Flag,
  FolderLock,
  Handshake,
  IdCard,
  Inbox,
  KeyRound,
  Lock,
  Monitor,
  Plane,
  QrCode,
  RefreshCw,
  ScanFace,
  ShieldCheck,
  ShieldEllipsis,
  Smartphone,
  Usb,
  UsersRound,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

/** The 29 lesson illustrations: two-tone (brand + accent) scenes on a circular stage. */
const ILLUSTRATIONS: Record<string, { main: LucideIcon; badge?: LucideIcon }> = {
  shield: { main: ShieldCheck },
  eye: { main: Eye },
  lock: { main: Lock },
  alarm: { main: AlarmClock },
  "phone-lock": { main: Smartphone, badge: Lock },
  handshake: { main: Handshake },
  browser: { main: AppWindow, badge: Lock },
  "badge-id": { main: IdCard },
  key: { main: KeyRound },
  "mfa-phone": { main: Smartphone, badge: ShieldCheck },
  inbox: { main: Inbox },
  folder: { main: FolderLock },
  social: { main: UsersRound },
  mask: { main: Drama },
  download: { main: Download },
  deepfake: { main: ScanFace },
  hook: { main: Fish },
  cloud: { main: Cloud, badge: Lock },
  usb: { main: Usb },
  desk: { main: Monitor },
  update: { main: RefreshCw },
  wifi: { main: Wifi },
  ceo: { main: BriefcaseBusiness },
  ransomware: { main: FileLock },
  travel: { main: Plane },
  certificate: { main: Award },
  vpn: { main: ShieldEllipsis },
  flag: { main: Flag },
  qr: { main: QrCode },
};

export function Illustration({ id, className }: { id: string; className?: string }) {
  const art = ILLUSTRATIONS[id] ?? ILLUSTRATIONS.shield;
  const Main = art.main;
  const Badge = art.badge;
  return (
    <div aria-hidden className={cn("relative grid aspect-square w-full max-w-80 place-items-center", className)}>
      <div className="absolute inset-0 rounded-full bg-brand-50" />
      <div className="absolute inset-[11%] rounded-full bg-brand-100" />
      <div className="absolute inset-[24%] rounded-full bg-surface shadow-raised" />
      <span className="absolute top-[9%] left-[16%] size-[7%] rounded-full bg-reward-400" />
      <span className="absolute right-[10%] bottom-[22%] size-[5%] rounded-full bg-brand-400" />
      <span className="absolute top-[30%] right-[6%] size-[3%] rounded-full bg-reward-500" />
      <Main className="relative size-[34%] animate-float text-brand-600" strokeWidth={1.5} />
      {Badge ? (
        <span className="absolute right-[22%] bottom-[22%] grid size-[24%] place-items-center rounded-full bg-reward-500 text-(--accent-on) shadow-raised ring-4 ring-surface">
          <Badge className="size-1/2" strokeWidth={2} />
        </span>
      ) : null}
    </div>
  );
}

export function Stat({ value, label, lang }: { value: string; label: string; lang?: string }) {
  return (
    <div lang={lang} className="grid aspect-square w-full max-w-80 place-items-center rounded-full bg-brand-50 p-8 text-center">
      <div>
        <p className="font-display text-[clamp(2.5rem,7vw,4.5rem)] leading-none font-bold tracking-tight text-brand-600">{value}</p>
        <p className="mt-3 text-body font-semibold text-ink-muted">{label}</p>
      </div>
    </div>
  );
}
