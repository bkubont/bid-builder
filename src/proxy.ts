import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Optimistic check only: sends visitors without a session cookie to the
 * sign-in page. The real check happens on the server for every page and
 * action (src/server/session.ts).
 */
// API routes check the session themselves and answer 401 instead of redirecting.
const PUBLIC_PREFIXES = ["/login", "/setup", "/invite/", "/api/"];

export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) {
    return NextResponse.next();
  }
  if (!getSessionCookie(request)) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Skip static files, images, icons, the manifest and the service worker.
  matcher: ["/((?!_next/static|_next/image|icons/|brand/|favicon|manifest.webmanifest|sw.js).*)"],
};
