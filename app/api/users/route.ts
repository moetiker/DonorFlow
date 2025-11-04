import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiRoute } from '@/lib/api-helpers'
import bcrypt from 'bcryptjs'
import { createUserSchema, validateRequestI18n, getLocaleFromRequest, getMessages } from '@/lib/validation'

export const GET = withApiRoute(async () => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      name: true,
      createdAt: true,
      updatedAt: true
      // passwordHash excluded for security
    },
    orderBy: { username: 'asc' }
  })

  return NextResponse.json(users)
})

export const POST = withApiRoute(async (request: NextRequest) => {
  const body = await request.json()

  // Extract locale from Accept-Language header
  const locale = getLocaleFromRequest(request)

  // Validate request body with i18n
  const validation = await validateRequestI18n(createUserSchema, body, locale)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const { username, password, name } = validation.data

  // Check if username already exists
  const existingUser = await prisma.user.findUnique({
    where: { username }
  })

  if (existingUser) {
    const messages = await getMessages(locale)
    return NextResponse.json(
      { error: messages.users?.usernameAlreadyTaken || 'Username is already taken' },
      { status: 400 }
    )
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10)

  // Create user
  const user = await prisma.user.create({
    data: {
      username,
      passwordHash,
      name: name || null
    },
    select: {
      id: true,
      username: true,
      name: true,
      createdAt: true,
      updatedAt: true
    }
  })

  return NextResponse.json(user)
})
