import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/viewer";

/** PWA start URL: signed-in people open their Home, everyone else the sign-in page. */
export async function GET(request: Request) {
  const v = await getSession();
  return NextResponse.redirect(new URL(v ? "/" : "/sign-in", request.url), { status: 303 });
}
