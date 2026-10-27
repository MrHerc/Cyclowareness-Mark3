import { GlobeLock, Inbox, KeyRound, Link2, MailWarning, ShieldCheck, SquareTerminal } from "lucide-react";
import type { LabId } from "@/lib/domain/labs";

/** Each lab's icon and colours, shared by the /lab cards, the learning-path labs and the module page's "Practise it". */
export const LAB_ICON = { "inbox-triage": Inbox, "link-detective": Link2, "password-forge": KeyRound, "mfa-fatigue": ShieldCheck, "phishing-anatomy": MailWarning, "process-hunt": SquareTerminal, "fake-signin": GlobeLock } as const satisfies Record<LabId, unknown>;

/** "<card gradient start> <icon tile background>". */
export const LAB_TINT = {
  "inbox-triage": "from-[#efe9ff] bg-[#6d28d9]",
  "link-detective": "from-[#e3f6fb] bg-[#0891b2]",
  "password-forge": "from-[#f3f6dc] bg-[#65a30d]",
  "mfa-fatigue": "from-[#ffece3] bg-[#ea580c]",
  "phishing-anatomy": "from-[#e6edff] bg-[#1d4ed8]",
  "process-hunt": "from-[#e9ecf2] bg-[#0f172a]",
  "fake-signin": "from-[#e2f6f3] bg-[#0f766e]",
} as const satisfies Record<LabId, string>;
