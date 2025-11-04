import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiRoute } from '@/lib/api-helpers'
import { authOptions } from '@/lib/auth'
import { getServerSession } from 'next-auth'
import bcrypt from 'bcryptjs'
import { updateUserSchema, validateRequestI18n, getLocaleFromRequest, getMessages } from '@/lib/validation'

export const PUT = withApiRoute(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: userId } = await params
  const body = await request.json()

  // Extract locale from Accept-Language header
  const locale = getLocaleFromRequest(request)

  // Validate request body with i18n
  const validation = await validateRequestI18n(updateUserSchema, body, locale)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const { username, password, name } = validation.data

  // Check if username is taken by another user
  if (username) {
    const existingUser = await prisma.user.findFirst({
      where: {
        username,
        id: { not: userId }
      }
    })

    if (existingUser) {
      const messages = await getMessages(locale)
      return NextResponse.json(
        { error: messages.users?.usernameAlreadyTaken || 'Username is already taken' },
        { status: 400 }
      )
    }
  }

  // Prepare update data
  const updateData: any = {}
  if (username) updateData.username = username
  if (name !== undefined) updateData.name = name || null

  // Only update password if provided
  if (password) {
    updateData.passwordHash = await bcrypt.hash(password, 10)
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: updateData,
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

export const DELETE = withApiRoute(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: userId } = await params

  // Extract locale from Accept-Language header
  const locale = getLocaleFromRequest(request)
  const messages = await getMessages(locale)

  // Prevent deleting the last user
  const userCount = await prisma.user.count()
  if (userCount <= 1) {
    return NextResponse.json(
      { error: messages.users?.cannotDeleteLastUser || 'Cannot delete the last user' },
      { status: 400 }
    )
  }

  // Don't allow user to delete themselves
  // Session is guaranteed to exist because of withApiRoute wrapper
  const session = await getServerSession(authOptions)
  if (session?.user?.name) {
    const currentUser = await prisma.user.findUnique({
      where: { username: session.user.name }
    })

    if (currentUser && currentUser.id === userId) {
      return NextResponse.json(
        { error: messages.users?.cannotDeleteSelf || 'You cannot delete yourself' },
        { status: 400 }
      )
    }
  }

  await prisma.user.delete({
    where: { id: userId }
  })

  return NextResponse.json({ success: true })
})
