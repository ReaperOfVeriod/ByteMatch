import type { NextRequest } from "next/server";
import { cookieOptions, destroySession, SESSION_COOKIE } from "@/auth/session";
import { config } from "@/lib/config";

/** POST only, so a link or image elsewhere cannot sign anyone out. */
export async function POST(request: NextRequest) {
  await destroySession(request.cookies.get(SESSION_COOKIE)?.value);
  const o = cookieOptions(0);
  const headers = new Headers({ location: `${config().PUBLIC_URL}/` });
  headers.append("set-cookie", `${SESSION_COOKIE}=; Path=${o.path}; Max-Age=0; HttpOnly; SameSite=Lax${o.secure ? "; Secure" : ""}`);
  return new Response(null, { status: 303, headers });
}
