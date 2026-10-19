"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton({ label }: { label: string }) {
  return (
    <Button variant="secondary" icon={<Printer />} onClick={() => window.print()}>
      {label}
    </Button>
  );
}
