"use client";

import { useState } from "react";
import type { VmLabId } from "./model/labs";
import { HuntLab } from "./labs/hunt-lab";
import { PhishingLab } from "./labs/phishing-lab";
import { SigninLab } from "./labs/signin-lab";

/** One virtual-machine lab; "Run the lab again" remounts it with a fresh machine. */
export function VmLab({ lab, today }: { lab: VmLabId; today: string }) {
  const [attempt, setAttempt] = useState(0);
  const again = () => setAttempt((a) => a + 1);
  if (lab === "phishing-anatomy") return <PhishingLab key={attempt} today={today} onAgain={again} />;
  if (lab === "process-hunt") return <HuntLab key={attempt} today={today} onAgain={again} />;
  return <SigninLab key={attempt} today={today} onAgain={again} />;
}
