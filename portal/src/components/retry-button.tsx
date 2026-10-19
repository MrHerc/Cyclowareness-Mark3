"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RetryButton({ label, onRetry }: { label: string; onRetry?: () => void }) {
  return (
    <Button icon={<RotateCcw />} onClick={() => (onRetry ? onRetry() : window.location.reload())}>
      {label}
    </Button>
  );
}
