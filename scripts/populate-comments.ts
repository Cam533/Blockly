import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Comment templates for different types of neighborhood amenities
const commentTemplates = [
  // Parks & Recreation
  "This would be perfect for a community park! We really need more green space in this area.",
  "A playground here would be amazing for the kids in the neighborhood.",
  "I'd love to see a dog park here. There aren't many places for dogs to run around nearby.",
  "A community garden would be fantastic! We could grow fresh vegetables and bring neighbors together.",
  "This spot would make a great basketball court or sports field.",
  
  // Community Spaces
  "A community center would be wonderful here - we need a place for events and gatherings.",
  "This could be a great location for a farmers market on weekends.",
  "I think a public library branch would serve this neighborhood well.",
  "A community meeting space would help bring residents together.",
  
  // Food & Dining
  "A local cafe would be perfect here! We need more places to grab coffee and work.",
  "I'd love to see a small restaurant or food truck spot here.",
  "A community kitchen or food co-op would be great for this area.",
  "This location would be ideal for a weekend food market.",
  
  // Health & Fitness
  "A gym or fitness center would be great - we need more options for staying active.",
  "An outdoor fitness area with equipment would be perfect for this space.",
  "A yoga studio or wellness center would be wonderful here.",
  "A walking trail or jogging path would encourage healthy living.",
  
  // Housing & Development
  "Affordable housing would really help the community here.",
  "Mixed-use development with shops and apartments would be ideal.",
  "Senior housing would be great - we need more options for older residents.",
  "Student housing near the university would fill a real need.",
  
  // Retail & Services
  "A small grocery store would be so convenient for residents.",
  "We need a pharmacy nearby - this would be a great location.",
  "A laundromat would serve many people in this area.",
  "A small retail space for local businesses would help the economy.",
  
  // Arts & Culture
  "An art gallery or cultural center would add so much to the neighborhood.",
  "A performance space for local musicians and artists would be amazing.",
  "An outdoor amphitheater for concerts and events would be fantastic.",
  "A makerspace or workshop for creative projects would be wonderful.",
  
  // Safety & Infrastructure
  "Better lighting and security would make this area safer.",
  "A parking lot would help with the parking issues in this neighborhood.",
  "Public restrooms would be a great addition here.",
  "A bike-sharing station would encourage sustainable transportation.",
  
  // General
  "This vacant lot has so much potential! I hope something positive happens here soon.",
  "It would be great to see this space put to good use for the community.",
  "I've been hoping something would be built here - it's been empty for too long.",
  "Whatever goes here, I hope it benefits the local residents.",
]

// Variations to make comments more natural
const prefixes = [
  "I think",
  "In my opinion",
  "I'd love to see",
  "It would be great if",
  "We really need",
  "This would be perfect for",
  "I hope",
  "I wish",
  "Maybe",
  "",
]

const suffixes = [
  "!",
  ".",
  " What do others think?",
  " Anyone else agree?",
  " Let's make it happen!",
]

function generateComment(): string {
  const template = commentTemplates[Math.floor(Math.random() * commentTemplates.length)]
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)]
  const suffix = suffixes[Math.floor(Math.random() * suffixes.length)]
  
  // Sometimes use the template as-is, sometimes add prefix
  if (prefix && Math.random() > 0.5) {
    return `${prefix} ${template.toLowerCase()}${suffix}`
  }
  return `${template}${suffix}`
}

function randomUpvotes(): number {
  // Most comments get 0-5 upvotes, some get more
  const rand = Math.random()
  if (rand < 0.6) return Math.floor(Math.random() * 6) // 0-5
  if (rand < 0.9) return Math.floor(Math.random() * 15) + 5 // 5-20
  return Math.floor(Math.random() * 30) + 20 // 20-50
}

function randomDownvotes(upvotes: number): number {
  // Downvotes are usually less than upvotes, but not always
  const maxDownvotes = Math.max(1, Math.floor(upvotes * 0.7))
  return Math.floor(Math.random() * maxDownvotes)
}

async function main() {
  console.log('Starting comment population...')

  // Get all users
  const users = await prisma.user.findMany()
  if (users.length === 0) {
    console.log('No users found! Please create some users first by registering.')
    process.exit(1)
  }

  // Get all plots (using any to avoid type issues if Prisma client not regenerated)
  const plots = await (prisma as any).plot.findMany({
    where: {
      longitude: { not: null },
      latitude: { not: null },
    },
  })

  if (plots.length === 0) {
    console.log('No plots found! Please upload plots first using: npm run upload:plots')
    process.exit(1)
  }

  console.log(`Found ${users.length} users and ${plots.length} plots`)

  // Determine how many comments to create
  const commentsPerPlot = 3 // Average comments per plot
  const totalComments = Math.floor(plots.length * commentsPerPlot * (0.3 + Math.random() * 0.4)) // 30-70% of plots get comments
  
  console.log(`Creating approximately ${totalComments} comments...`)

  const commentsCreated: number[] = []
  let created = 0

  // Create comments
  for (let i = 0; i < totalComments; i++) {
    // Random plot
    const plot = plots[Math.floor(Math.random() * plots.length)]
    
    // Random user
    const user = users[Math.floor(Math.random() * users.length)]
    
    // Generate comment
    const content = generateComment()
    
    // Random votes
    const upvote = randomUpvotes()
    const downvote = randomDownvotes(upvote)
    
    try {
      const comment = await (prisma as any).comment.create({
        data: {
          plotId: plot.id,
          userId: user.id,
          content,
          upvote,
          downvote,
        },
      })
      
      commentsCreated.push(comment.id)
      created++
      
      if (created % 50 === 0) {
        console.log(`Created ${created} comments...`)
      }
    } catch (error) {
      console.error(`Error creating comment:`, error)
    }
  }

  console.log(`\n✅ Successfully created ${created} comments!`)
  
  // Count unique plots that got comments
  const plotsWithComments = await (prisma as any).comment.findMany({
    select: { plotId: true },
    distinct: ['plotId'],
  })
  console.log(`Comments distributed across ${plotsWithComments.length} different plots`)

  // Show some stats
  const stats = await (prisma as any).comment.aggregate({
    _sum: {
      upvote: true,
      downvote: true,
    },
    _count: true,
  })

  const totalUpvotes = stats._sum?.upvote || 0
  const totalDownvotes = stats._sum?.downvote || 0
  const totalCount = stats._count || 0
  const avgScore = totalCount > 0 ? (totalUpvotes - totalDownvotes) / totalCount : 0

  console.log(`\n📊 Statistics:`)
  console.log(`   Total comments: ${totalCount}`)
  console.log(`   Total upvotes: ${totalUpvotes}`)
  console.log(`   Total downvotes: ${totalDownvotes}`)
  console.log(`   Average score: ${avgScore.toFixed(2)}`)
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

