/** Print-ready documents (report PDFs, compliance pack): no app chrome, A4-friendly. */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-white text-ink print:min-h-0">{children}</div>;
}
