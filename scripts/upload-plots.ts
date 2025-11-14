import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

interface GeoJSONFeature {
  type: string
  properties: {
    objectid: number
    address: string | null
    owner1: string | null
    owner2: string | null
    bldg_desc: string | null
    opa_id: string | null
    lniaddresskey: string | null
    councildistrict: string | null
    zoningbasedistrict: string | null
    zipcode: string | null
    land_rank: number | null
    build_rank: number | null
    vacant_flag: string | null
    vacant_rank: number | null
    date_update: string | null
  }
  geometry: {
    type: string
    coordinates: [number, number] // [longitude, latitude]
  }
}

interface GeoJSONData {
  type: string
  features: GeoJSONFeature[]
}

function parseDate(dateStr: string | null): Date | null {
  if (!dateStr || dateStr.trim() === '') return null
  
  try {
    // Handle ISO format: "2025-11-13T00:00:00Z"
    return new Date(dateStr)
  } catch {
    return null
  }
}

async function uploadPlots() {
  try {
    console.log('Reading GeoJSON file...')
    const filePath = path.join(process.cwd(), 'Vacant_Indicators_Points.geojson')
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`)
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8')
    const geojson: GeoJSONData = JSON.parse(fileContent)

    console.log(`Found ${geojson.features.length} features to process`)

    let successCount = 0
    let skipCount = 0
    let errorCount = 0

    // Process in batches to avoid overwhelming the database
    const batchSize = 100
    for (let i = 0; i < geojson.features.length; i += batchSize) {
      const batch = geojson.features.slice(i, i + batchSize)
      
      await Promise.all(
        batch.map(async (feature) => {
          try {
            const props = feature.properties
            const coords = feature.geometry.coordinates // [longitude, latitude]

            // Parse date_update
            const dateUpdate = parseDate(props.date_update)

            // Check if plot with this objectid already exists
            const existing = await prisma.plot.findUnique({
              where: { objectid: props.objectid }
            })

            if (existing) {
              skipCount++
              return
            }

            await prisma.plot.create({
              data: {
                objectid: props.objectid,
                longitude: coords[0], // First element is longitude
                latitude: coords[1],  // Second element is latitude
                address: props.address || null,
                owner1: props.owner1 || null,
                owner2: props.owner2 || null,
                bldgDesc: props.bldg_desc || null,
                opaId: props.opa_id || null,
                lniAddressKey: props.lniaddresskey || null,
                councilDistrict: props.councildistrict || null,
                zoningBaseDistrict: props.zoningbasedistrict || null,
                zipcode: props.zipcode || null,
                landRank: props.land_rank ?? null,
                buildRank: props.build_rank ?? null,
                vacantFlag: props.vacant_flag || null,
                vacantRank: props.vacant_rank ?? null,
                dateUpdate: dateUpdate,
              }
            })

            successCount++
          } catch (error) {
            console.error(`Error processing objectid ${feature.properties.objectid}:`, error)
            errorCount++
          }
        })
      )

      console.log(`Processed ${Math.min(i + batchSize, geojson.features.length)} / ${geojson.features.length} features...`)
    }

    console.log('\n✅ Upload complete!')
    console.log(`✅ Successfully uploaded: ${successCount}`)
    console.log(`⏭️  Skipped (already exists): ${skipCount}`)
    console.log(`❌ Errors: ${errorCount}`)
  } catch (error) {
    console.error('Error uploading plots:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

uploadPlots()
  .catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })
