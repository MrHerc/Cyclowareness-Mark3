/** Re-mounts on every navigation, so each learner page opens with the blur-to-clear reveal. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-reveal">{children}</div>;
}
