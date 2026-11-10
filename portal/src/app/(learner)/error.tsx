"use client";

import { SegmentError } from "@/components/segment-error";

export default function LearnerError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <SegmentError {...props} home="/app" />;
}
