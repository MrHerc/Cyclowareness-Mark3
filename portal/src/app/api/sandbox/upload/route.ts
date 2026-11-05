import { getViewer } from "@/server/auth/viewer";
import { sameOrigin } from "@/server/request";
import { readBytesCapped } from "@/server/request-body";
import { logFailure } from "@/server/db/errors";
import { MAX_FILE_BYTES } from "@/server/sandbox/analyze";
import { analyzeUpload } from "@/server/sandbox/upload";

/** Multipart framing and the field names around a file of MAX_FILE_BYTES. */
const BODY_LIMIT = MAX_FILE_BYTES + 4096;

/**
 * Sandbox file upload (multipart, same fields as the form). A route handler rather than a Server
 * Action, so the actions keep Next's default 1 MB body limit and only this path takes 10 MB.
 * The answer is the same SandboxState the action returns.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response("Forbidden", { status: 403 });
  const v = await getViewer();
  if (!v) return new Response("Unauthorized", { status: 401 });
  if (!v.tenant.features.has("sandbox")) return new Response("Not available", { status: 404 });
  // Multipart needs the whole body, so a declared length is required and the stream is cut off past the limit.
  const declared = Number(request.headers.get("content-length"));
  if (!(declared > 0) || declared > BODY_LIMIT) return new Response("Payload too large", { status: 413 });
  const bytes = await readBytesCapped(request, BODY_LIMIT).catch(() => null);
  if (bytes === null) return new Response("Payload too large", { status: 413 });
  let form: FormData;
  try {
    form = await new Request(request.url, { method: "POST", headers: { "content-type": request.headers.get("content-type") ?? "" }, body: bytes }).formData();
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  try {
    return Response.json(await analyzeUpload(v, form));
  } catch (error) {
    // The panel shows the generic error on the form, as the action does when the database is unavailable.
    logFailure("[sandbox] analysis failed", error);
    return Response.json({ error: "generic" });
  }
}
