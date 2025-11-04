import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const response = NextResponse.next()

    // Disable caching in development
    if (process.env.NODE_ENV === 'development') {
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
      response.headers.set('Pragma', 'no-cache')
      response.headers.set('Expires', '0')
    }

    return response
  }
)

export const config = {
  matcher: [
    '/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)'
  ]
}
