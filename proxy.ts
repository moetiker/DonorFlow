import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function proxy(req) {
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
    // api/organization is deliberately public: the login page renders the club
    // name before anyone is signed in. Without it here the request is redirected
    // to the sign-in page, the fetch fails, and the name silently falls back to
    // the generic default for every visitor who is not already logged in.
    '/((?!api/auth|api/public|api/organization|s/|login|_next/static|_next/image|favicon.ico|icon.svg|icon.png|apple-icon.png).*)'
  ]
}
