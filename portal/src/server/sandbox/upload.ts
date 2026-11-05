import "server-only";
import { db, t } from "../db";
import type { Viewer } from "../auth/viewer";
import { insertNumbered } from "../services/threats";
import { analyzeFile, analyzeUrl, MAX_FILE_BYTES, type Analysis } from "./analyze";
import { audit } from "../services/audit";
import { emitEvent } from "../services/events";
import { rateLimit } from "../rate-limit";

export type SandboxState = { analysis?: Analysis & { id: string; number: number }; error?: string; escalated?: boolean } | undefined;

async function storeAnalysis(tenantId: string, userId: string, a: Analysis) {
  const { number, row } = await insertNumbered(db(), t.sandboxAnalyses, tenantId, 500, async (number) => {
    const [inserted] = await db()
      .insert(t.sandboxAnalyses)
      .values({ tenantId, number, kind: a.kind, objectName: a.objectName, sha256: a.sha256, sizeBytes: a.sizeBytes, verdict: a.verdict, score: a.score, findings: a.findings, iocs: a.iocs, mitre: a.mitre, submittedBy: userId })
      .returning({ id: t.sandboxAnalyses.id });
    return inserted;
  });
  await audit(db(), { tenantId, actorId: userId, action: "sandbox.analyzed", targetType: "sandbox", targetId: row.id, meta: { number: `SB-${number}`, verdict: a.verdict } });
  if (a.verdict === "malicious") await emitEvent(db(), tenantId, "sandbox.malicious", { number: `SB-${number}`, kind: a.kind, sha256: a.sha256, iocs: a.iocs });
  return { id: row.id, number };
}

/**
 * One sandbox submission (a link or a file), shared by the Server Action and the upload route so the
 * feature gate, the per-person limit and the size cap are the same whichever way it arrives.
 */
export async function analyzeUpload(v: Viewer, form: FormData): Promise<SandboxState> {
  if (!v.tenant.features.has("sandbox")) return { error: "forbidden" };
  if (!(await rateLimit(`sandbox:${v.user.id}`, 30, 10 * 60_000)).ok) return { error: "rateLimited" };
  const kind = form.get("kind");
  let analysis: Analysis;
  if (kind === "url") {
    const url = String(form.get("url") ?? "").trim();
    if (!url) return { error: "noUrl" };
    analysis = analyzeUrl(url.slice(0, 2000));
  } else {
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: "noFile" };
    if (file.size > MAX_FILE_BYTES) return { error: "tooBig" };
    // Bytes are analysed in memory and discarded; only the hash and findings are stored.
    analysis = analyzeFile(file.name, Buffer.from(await file.arrayBuffer()));
  }
  const stored = await storeAnalysis(v.tenant.id, v.user.id, analysis);
  return { analysis: { ...analysis, ...stored } };
}
