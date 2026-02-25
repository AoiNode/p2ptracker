import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Set to true to enable authentication requirement
const REQUIRE_AUTH = false; // Change to true when auth is set up

// Public routes that don't require authentication
const publicPaths = ['/login', '/register', '/manifest.json', '/sw.js', '/favicon.ico', '/icon.svg'];
const publicPrefixes = ['/icons/', '/_next/', '/api/auth/'];

export function middleware(request: NextRequest) {
  // Skip auth check if not required
  if (!REQUIRE_AUTH) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Allow public assets and auth routes
  if (
    publicPaths.includes(pathname) ||
    publicPrefixes.some(prefix => pathname.startsWith(prefix))
  ) {
    return NextResponse.next();
  }

  // Check for auth cookie (Supabase sets sb-access-token)
  const hasAuth = request.cookies.has('sb-access-token') || 
                  request.cookies.has('supabase-auth-token');

  // Redirect to login if not authenticated
  if (!hasAuth && pathname !== '/login') {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect to home if authenticated and trying to access login
  if (hasAuth && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    '/((?!api|_next/static|_next/image|favicon.ico|icon.svg|icons|manifest.json|sw.js|workbox-.*|worker-.*).+)',
  ],
};
