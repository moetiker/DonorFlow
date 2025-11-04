import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'

/**
 * Higher-order function that wraps API route handlers with authentication
 * Returns 401 if no session exists, otherwise calls the handler
 */
export function withAuth<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    return handler(request, ...args)
  }
}

/**
 * Wraps API route handlers with both authentication and error handling
 * Provides consistent error responses and logging
 */
export function withApiRoute<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return withAuth(async (request: NextRequest, ...args: T) => {
    try {
      return await handler(request, ...args)
    } catch (error) {
      console.error(`API Error: ${request.method} ${request.url}`, error)

      return NextResponse.json(
        {
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      )
    }
  })
}
