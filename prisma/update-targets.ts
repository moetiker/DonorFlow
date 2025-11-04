import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function updateAllTargets() {
  console.log('🎯 Updating all member targets to CHF 100...\n')

  try {
    const result = await prisma.memberTarget.updateMany({
      data: {
        targetAmount: 100.00
      }
    })

    console.log(`✅ Successfully updated ${result.count} member targets to CHF 100.00`)
  } catch (error) {
    console.error('❌ Error updating targets:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

updateAllTargets()
