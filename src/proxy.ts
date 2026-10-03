import { NextResponse, type NextRequest } from 'next/server';

/** Optimistic redirect for signed-out visitors. Pages still verify the session on the server. */
export function proxy(req: NextRequest) {
  if (!req.cookies.get('ah_session')) {
    const url = req.nextUrl.clone();
    url.pathname = '/sign-in';
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/agents/new', '/console/:path*', '/settings/:path*', '/notifications/:path*', '/agents/:handle/settings'],
};
