import {
  AppWindow,
  BadgeCheck,
  Bot,
  Briefcase,
  Bug,
  Camera,
  CircleDollarSign,
  Cloud,
  CreditCard,
  Database,
  DoorClosed,
  FileWarning,
  Fingerprint,
  Globe,
  HardDriveDownload,
  Heart,
  KeyRound,
  Laptop,
  Lock,
  Mail,
  MailWarning,
  MonitorCheck,
  PenLine,
  Phone,
  Plane,
  Printer,
  Puzzle,
  QrCode,
  ScanFace,
  Search,
  ShieldAlert,
  ShoppingCart,
  Siren,
  Smartphone,
  TrendingUp,
  UserX,
  Users,
  Usb,
  VenetianMask,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { Category } from "@/lib/domain/catalog";
import { cn } from "@/lib/cn";

const BY_CATEGORY: Record<Category, LucideIcon> = {
  email: Mail,
  accounts: KeyRound,
  social: VenetianMask,
  devices: Smartphone,
  ai: Bot,
  physical: DoorClosed,
  data: Database,
  work: Briefcase,
  incident: Siren,
};

const BY_SLUG: Record<string, LucideIcon> = {
  "phishing-email": MailWarning,
  "passwords-mfa": KeyRound,
  "mobile-wifi": Smartphone,
  quishing: QrCode,
  "deepfake-scams": ScanFace,
  "malware-ransomware": Bug,
  "safe-browsing": Globe,
  "usb-media": Usb,
  "personal-data": Fingerprint,
  "data-sharing": Users,
  "physical-security": DoorClosed,
  "remote-work": Laptop,
  "software-updates": HardDriveDownload,
  "incident-reporting": Siren,
  "travel-security": Plane,
  "cloud-accounts": Cloud,
  "executive-threats": BadgeCheck,
  "it-admin-risks": ShieldAlert,
  "official-information": Lock,
  "e-signature-misuse": PenLine,
  "ai-tools-safety": Bot,
  "vendor-email-compromise": CircleDollarSign,
  "dangerous-attachments": FileWarning,
  "insider-threat": UserX,
  "meeting-security": Video,
  "work-phone-mdm": Smartphone,
  "documents-printing": Printer,
  "fake-login-windows": AppWindow,
  "tech-support-scams": Phone,
  "fake-captcha-commands": Puzzle,
  "browser-extensions": Puzzle,
  "search-ads-lookalikes": Search,
  "fake-payment-links": CreditCard,
  "online-shopping-scams": ShoppingCart,
  "investment-scams": TrendingUp,
  "romance-scams": Heart,
  "smart-cameras-iot": Camera,
  "backups-recovery": MonitorCheck,
};

export function moduleIcon(slug: string, category: Category): LucideIcon {
  return BY_SLUG[slug] ?? BY_CATEGORY[category] ?? Mail;
}

// The components below repeat the lookup inline: the React compiler treats any call result used as
// a JSX tag as a component created during render.
export function ModuleIcon({ slug, category, className, size = "md" }: { slug: string; category: Category; className?: string; size?: "sm" | "md" | "lg" }) {
  const Icon = BY_SLUG[slug] ?? BY_CATEGORY[category] ?? Mail;
  const dims = { sm: "size-9 rounded-sm [&_svg]:size-4.5", md: "size-12 rounded-md [&_svg]:size-6", lg: "size-16 rounded-lg [&_svg]:size-8" }[size];
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center bg-brand-50 text-brand-600", dims, className)}>
      <Icon strokeWidth={1.9} />
    </span>
  );
}

/** Large two-tone illustration: "onBrand" on the Continue hero, "light" on the module page panel. */
export function ModuleArt({ slug, category, className, tone = "onBrand" }: { slug: string; category: Category; className?: string; tone?: "onBrand" | "light" }) {
  const Icon = BY_SLUG[slug] ?? BY_CATEGORY[category] ?? Mail;
  const light = tone === "light";
  return (
    <div aria-hidden className={cn("relative grid aspect-square place-items-center", className)}>
      <div className={cn("absolute inset-0 rounded-full", light ? "bg-brand-100" : "bg-white/14")} />
      {light ? null : <div className="absolute inset-[14%] rounded-full bg-white/16" />}
      <div className="absolute top-[12%] right-[14%] size-[16%] rounded-full bg-reward-500 shadow-raised" />
      <Icon className={cn("relative size-[42%]", light ? "text-brand-600" : "text-white drop-shadow-sm")} strokeWidth={1.6} />
    </div>
  );
}
