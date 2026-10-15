import type { NextRequest } from "next/server";
import { cookieOptions, createSession, SESSION_COOKIE, STATE_COOKIE } from "@/auth/session";
import { userClient } from "@/github/client";
import { config, signInConfigured } from "@/lib/config";
import { safeEqual } from "@/lib/crypto";
import { isBlocked } from "@/lib/moderation";

function cookie(name: string, value: string, maxAge: number) {
  const o = cookieOptions(maxAge);
  return `${name}=${value}; Path=${o.path}; Max-Age=${o.maxAge}; HttpOnly; SameSite=Lax${o.secure ? "; Secure" : ""}`;
}

export async function GET(request: NextRequest) {
  if (!signInConfigured()) return new Response("Sign-in is not configured on this instance.", { status: 503 });
  const q = request.nextUrl.searchParams;
  const [state, nextEncoded] = (request.cookies.get(STATE_COOKIE)?.value ?? "").split(".");
  if (!state || !q.get("state") || !safeEqual(state, q.get("state")!))
    return new Response("Sign-in expired. Please try again.", { status: 400 });
  const code = q.get("code");
  if (!code) return new Response("GitHub did not return a code.", { status: 400 });

  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({
      client_id: config().GITHUB_CLIENT_ID,
      client_secret: config().GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${config().PUBLIC_URL}/auth/callback`,
    }),
  });
  const token = (await res.json()) as { access_token?: string; error_description?: string };
  if (!token.access_token) return new Response(`GitHub sign-in failed: ${token.error_description ?? "no token"}`, { status: 400 });

  const { data: profile } = await userClient(token.access_token).request("GET /user");
  if (await isBlocked({ githubId: Number(profile.id), login: profile.login })) {
    return new Response(null, { status: 302, headers: { location: `${config().PUBLIC_URL}/login?blocked=1` } });
  }
  const session = await createSession({ ...profile, id: Number(profile.id) }, token.access_token);
  const next = nextEncoded ? Buffer.from(nextEncoded, "base64url").toString() : "/manage";
  const headers = new Headers({ location: `${config().PUBLIC_URL}${next.startsWith("/") && !next.startsWith("//") ? next : "/manage"}` });
  headers.append("set-cookie", cookie(SESSION_COOKIE, session.token, session.maxAge));
  headers.append("set-cookie", cookie(STATE_COOKIE, "", 0));
  return new Response(null, { status: 302, headers });
}
