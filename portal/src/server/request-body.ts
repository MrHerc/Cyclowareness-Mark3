import "server-only";

/**
 * Reads a route handler's request body as UTF-8 text, at most `limit` bytes. Route handlers are
 * not covered by `serverActions.bodySizeLimit`, and `request.json()` buffers everything first.
 * Returns null when the body is larger: a declared Content-Length is refused up front, and a
 * chunked or understated body is cut off as soon as the running count passes the limit.
 */
export async function readBodyCapped(request: Request, limit: number): Promise<string | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(bytes);
}
