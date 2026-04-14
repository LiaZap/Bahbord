import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return response;
}

export function middleware(req: NextRequest) {
  const memberId = req.cookies.get('bahjira-member-id')?.value;
  const { pathname } = req.nextUrl;

  // Allow public paths through without auth check
  const isPublicPath =
    pathname === '/login' ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.ico');

  if (isPublicPath) {
    if (memberId && pathname === '/login') {
      return addSecurityHeaders(NextResponse.redirect(new URL('/board', req.url)));
    }
    return addSecurityHeaders(NextResponse.next());
  }

  if (!memberId) {
    return addSecurityHeaders(NextResponse.redirect(new URL('/login', req.url)));
  }

  return addSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
