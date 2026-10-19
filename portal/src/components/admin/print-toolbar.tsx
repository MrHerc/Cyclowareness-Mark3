"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Opens the print dialog once the document is rendered (Save as PDF in every browser). */
export function PrintToolbar({ label }: { label: string }) {
  useEffect(() => {
    const id = window.setTimeout(() => window.print(), 600);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <div className="sticky top-0 z-10 flex justify-end border-b border-line bg-surface/90 px-6 py-3 backdrop-blur print:hidden">
      <Button icon={<Printer />} onClick={() => window.print()}>
        {label}
      </Button>
    </div>
  );
}

/** In-page print button (leadership panel prints itself; the shell hides on paper). */
export function PrintButton({ label, icon }: { label: string; icon?: React.ReactNode }) {
  return (
    <Button variant="secondary" icon={icon ?? <Printer />} onClick={() => window.print()} className="print:hidden">
      {label}
    </Button>
  );
}
