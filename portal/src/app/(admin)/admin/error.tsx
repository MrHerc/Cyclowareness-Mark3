"use client";

import { SegmentError } from "@/components/segment-error";

// Below admin/layout.tsx, so the console's navigation stays; a failing layout falls back to app/error.tsx.
export default function AdminError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <SegmentError {...props} home="/admin" />;
}
