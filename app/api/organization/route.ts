import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Disable caching for this route
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Public route - no authentication required
export async function GET() {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: 'organizationName' }
    })

    const response = NextResponse.json({
      organizationName: setting?.value || 'Gönnerverwaltung'
    })

    // Add cache-control headers
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')

    return response
  } catch (error) {
    const response = NextResponse.json({
      organizationName: 'Gönnerverwaltung'
    })

    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')

    return response
  }
}
