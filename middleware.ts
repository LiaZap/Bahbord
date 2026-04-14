import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const memberId = req.cookies.get('bahjira-member-id')?.value;

  const { pathname } = req.nextUrl;

  // Allow public paths through without auth check
  const isPublicPath =
    pathname === '/login' ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/options') ||
    pathname.startsWith('/api/quick-reactions') ||
    pathname.startsWith('/api/webhooks') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.ico');

  if (isPublicPath) {
    // If logged in and on login page, redirect to board
    if (memberId && pathname === '/login') {
      return NextResponse.redirect(new URL('/board', req.url));
    }
    return NextResponse.next();
  }

  // Redirect to login if no auth cookie
  if (!memberId) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
