import { randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { cookieOptions, STATE_COOKIE } from "@/auth/session";
import { config, signInConfigured } from "@/lib/config";

/** Starts "Sign in with GitHub" (the GitHub App's OAuth client). */
export async function GET(request: NextRequest) {
  if (!signInConfigured()) return new Response("Sign-in is not configured on this instance.", { status: 503 });
  const state = randomBytes(16).toString("base64url");
  const next = request.nextUrl.searchParams.get("next") ?? "/manage";
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", config().GITHUB_CLIENT_ID!);
  url.searchParams.set("redirect_uri", `${config().PUBLIC_URL}/auth/callback`);
  url.searchParams.set("state", state);
  const res = Response.redirect(url, 302);
  const headers = new Headers(res.headers);
  const o = cookieOptions(600);
  // The state and where to go afterwards ride in one short-lived cookie.
  const value = `${state}.${Buffer.from(next.startsWith("/") && !next.startsWith("//") ? next : "/manage").toString("base64url")}`;
  headers.append(
    "set-cookie",
    `${STATE_COOKIE}=${value}; Path=${o.path}; Max-Age=${o.maxAge}; HttpOnly; SameSite=Lax${o.secure ? "; Secure" : ""}`,
  );
  return new Response(null, { status: 302, headers });
}
