import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Calculate the distance between two points on Earth using the Haversine formula
 * Returns distance in kilometers
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371 // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

interface PlotWithDistance {
  id: number
  distance: number
}

async function populateNeighbors() {
  try {
    console.log('Fetching all plots with coordinates...')
    
    // Get all plots that have valid coordinates
    const plots = await prisma.plot.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        latitude: true,
        longitude: true,
      },
    })

    if (plots.length === 0) {
      console.log('No plots with coordinates found! Please upload plots first.')
      process.exit(1)
    }

    console.log(`Found ${plots.length} plots with coordinates`)
    console.log('Calculating nearest neighbors for each plot...')
    console.log('This may take a while for large datasets...\n')

    const topK = 10 // Number of nearest neighbors to find
    let processed = 0
    let created = 0
    let updated = 0

    // Process plots in batches to avoid memory issues
    const batchSize = 100
    for (let i = 0; i < plots.length; i += batchSize) {
      const batch = plots.slice(i, i + batchSize)
      
      await Promise.all(
        batch.map(async (plot) => {
          try {
            if (plot.latitude === null || plot.longitude === null) {
              return
            }

            // Calculate distances to all other plots
            const distances: PlotWithDistance[] = []
            
            for (const otherPlot of plots) {
              // Skip self
              if (otherPlot.id === plot.id) continue
              
              if (otherPlot.latitude === null || otherPlot.longitude === null) {
                continue
              }

              const distance = calculateDistance(
                plot.latitude,
                plot.longitude,
                otherPlot.latitude,
                otherPlot.longitude
              )

              distances.push({
                id: otherPlot.id,
                distance,
              })
            }

            // Sort by distance and get top K
            distances.sort((a, b) => a.distance - b.distance)
            const nearestNeighbors = distances.slice(0, topK).map((d) => d.id)

            // Check if neighbors record already exists
            const existing = await prisma.neighbors.findUnique({
              where: { id: plot.id },
            })

            if (existing) {
              // Update existing record
              await prisma.neighbors.update({
                where: { id: plot.id },
                data: {
                  neighborIds: nearestNeighbors,
                },
              })
              updated++
            } else {
              // Create new record
              await prisma.neighbors.create({
                data: {
                  id: plot.id,
                  neighborIds: nearestNeighbors,
                },
              })
              created++
            }

            processed++
            if (processed % 50 === 0) {
              console.log(`Processed ${processed} / ${plots.length} plots...`)
            }
          } catch (error) {
            console.error(`Error processing plot ${plot.id}:`, error)
          }
        })
      )

      console.log(`Completed batch ${Math.floor(i / batchSize) + 1} / ${Math.ceil(plots.length / batchSize)}`)
    }

    console.log('\n✅ Neighbors population complete!')
    console.log(`✅ Processed: ${processed} plots`)
    console.log(`✅ Created: ${created} neighbor records`)
    console.log(`✅ Updated: ${updated} neighbor records`)
    
    // Show some statistics
    const totalNeighbors = await prisma.neighbors.count()
    console.log(`\n📊 Total neighbor records in database: ${totalNeighbors}`)
    
  } catch (error) {
    console.error('Error populating neighbors:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

populateNeighbors()
  .catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })

