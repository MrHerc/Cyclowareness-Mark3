import {
  Banknote,
  BedDouble,
  Briefcase,
  BriefcaseBusiness,
  Building,
  Building2,
  Camera,
  Cloud,
  Download,
  FileSignature,
  FileText,
  Flame,
  Flashlight,
  Gamepad2,
  Gift,
  Globe,
  HardDrive,
  Headset,
  Heart,
  Image,
  KeyRound,
  Landmark,
  Mail,
  MapPin,
  Merge,
  MessageCircle,
  Newspaper,
  Package,
  Plane,
  Printer,
  RefreshCw,
  Scale,
  Send,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Signal,
  Smartphone,
  Star,
  Store,
  Truck,
  Tv,
  Users,
  Vault,
  Video,
  Wallet,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { Brand } from "@/lib/content/types";
import { cn } from "@/lib/cn";

/** Lucide glyphs used by the fictional brand registry (content/library/brands.json). */
const GLYPHS: Record<string, LucideIcon> = {
  Banknote, BedDouble, Briefcase, BriefcaseBusiness, Building, Building2, Camera, Cloud, Download, FileSignature, FileText, Flame, Flashlight, Gamepad2, Gift, Globe, HardDrive, Headset, Heart, Image, KeyRound, Landmark, Mail, MapPin, Merge, MessageCircle, Newspaper, Package, Plane, Printer, RefreshCw, Scale, Send, Shield, ShieldCheck, ShoppingBag, Signal, Smartphone, Star, Store, Truck, Tv, Users, Vault, Video, Wallet, Wifi, Zap,
};

export function BrandAvatar({ brand, name, size = "md", className }: { brand?: Brand | null; name?: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const dims = { sm: "size-8 text-[0.65rem] [&_svg]:size-4", md: "size-10 text-tab [&_svg]:size-5", lg: "size-14 text-body [&_svg]:size-7" }[size];
  if (!brand) {
    const initials = (name ?? "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
    return <span className={cn("grid shrink-0 place-items-center rounded-full bg-safe-100 font-bold text-safe-700", dims, className)}>{initials || "?"}</span>;
  }
  const Glyph = GLYPHS[brand.glyph];
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full font-bold text-white", dims, className)} style={{ background: brand.color }}>
      {brand.monogram ? brand.monogram : Glyph ? <Glyph /> : brand.name.slice(0, 1)}
    </span>
  );
}
