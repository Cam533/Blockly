import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function clearPlots() {
  try {
    console.log('Deleting all plots...')
    const result = await prisma.plot.deleteMany({})
    console.log(`✅ Deleted ${result.count} plots`)
  } catch (error) {
    console.error('Error clearing plots:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

clearPlots()
  .catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })

