'use strict'
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

const PLAYERS = [
  // Shoffy is masteradmin
  { name: 'Shoffy',           tmId: 'bb52ccd2-9073-4102-9244-49ae09e8d81f', role: 'ADMIN' },
  { name: 'LPNSebi',         tmId: '8d44442c-8d44-4b01-a678-01536390f3ce' },
  { name: 'DrTilt.',         tmId: 'e8d7efcd-7be0-419a-a543-e70c262a9e58' },
  { name: 'Agent-TM',        tmId: '25b98428-c59b-4153-8750-c860330d28ff' },
  { name: 'alexS..',         tmId: '3f9b1642-9901-4483-9d7a-392d034abe35' },
  { name: 'BeNNy_TM',        tmId: 'b1fa110b-ab63-42c6-b960-2ea65a9a4502' },
  { name: 'Boris_TM',        tmId: 'a47216d8-ad9e-495c-9592-a54766d7b50e' },
  { name: 'Clin_TM',         tmId: '53d2f483-3535-4fc5-8fef-2baa874e6ada' },
  { name: 'crypii',          tmId: '81909621-cd53-43aa-82bb-238fb9bdeb88' },
  { name: 'DMR-GameBros',    tmId: '5cafc8ea-9a29-4687-9101-71397643190b' },
  { name: 'Enibeti',         tmId: '3baab677-6232-420f-85f6-139b6b97311c' },
  { name: 'EXistenzminimum', tmId: 'ed0e5a9f-e9a0-4e3d-af90-10cfcda5ff44' },
  { name: 'Flonko',          tmId: '6fc2c2ca-2b3a-4290-8451-99ebf58d88ab' },
  { name: 'FrechdachsTM',    tmId: 'c8e0e024-2e47-46ac-b351-2d6d61886084' },
  { name: 'hyperxrage',      tmId: 'c063bb2f-f9d2-4bac-a2cf-48fa6c6afbc7' },
  { name: 'Jan_08',          tmId: '301b6b68-f694-49dc-88c3-80fcc2cfc0c1' },
  { name: 'Jooooooooey',     tmId: 'f4843288-5992-46a7-bca9-755faaba1608' },
  { name: 'Leonowitsch',     tmId: 'ba41544d-8f6d-48bd-ba27-9cd00d795dc6' },
  { name: 'Linkcrafter',     tmId: '86a91736-89cd-427e-b4ca-bc8a5d7137a9' },
  { name: 'Mobbi._.',        tmId: '63b5f159-9195-423f-8ae7-f0bba8fea36a' },
  { name: 'NismoTM',         tmId: '32671f34-92f1-4646-ab95-5dff579c772f' },
  { name: 'Niwes.',          tmId: '0341b936-c6e9-4ff5-9149-5e2b387a384b' },
  { name: 'PASZS',           tmId: 'db827c44-6b6c-4737-939d-7f7a6aae2c4b' },
  { name: 'ParZival_TM',     tmId: 'b52cc9c4-4e4f-48ce-ace6-b4a6ced9bfc3' },
  { name: 'PebTM',           tmId: '42b792dd-ec82-414d-a9e4-41f26c22207f' },
  { name: 'P3kingente',      tmId: '2b3ad3cd-e02e-459c-8d14-b36d46c2e2fd' },
  { name: 'Reghinald',       tmId: 'b2d3f198-5ac0-4589-8ef8-06dcd7427ed5' },
  { name: 's0nity',          tmId: 'b6aad18e-d1d7-4831-8e8a-a3344a68c8e3' },
  { name: 'SilentSamTM',     tmId: 'ed578d74-21da-4d85-ab71-ee44627ec293' },
  { name: 'Simi_TM',         tmId: 'dc512a57-42b5-411d-b798-ed1961c4fac3' },
  { name: 'Siri_TM',         tmId: 'b0723bea-c389-48b9-8e95-665dee7fe662' },
  { name: 'Spongelikezz',    tmId: '112e1294-275c-4e0c-91e8-19f0a4e1c857' },
  { name: 'SurvTM',          tmId: '7d3f4580-fc42-45de-9335-3118394ad2ec' },
  { name: 'Sven24TM',        tmId: 'a4413ba1-54a3-4c3c-bc6d-11641bfeb6f3' },
  { name: 'Totomoto1403',    tmId: '025ddb63-fbf8-465a-b5cc-dcdec965ce0a' },
  { name: 'TraTM',           tmId: '00e8a404-c174-44a8-a8e4-5e0c82902d22' },
  { name: 'TsunamiZ',        tmId: '65be7675-eeea-467e-8d1f-579aa3095fa8' },
  { name: 'UsoTM',           tmId: '16cede9b-cdc8-425d-b967-e356c18906ae' },
  { name: 'XomtosBodiis',    tmId: '0765948e-537a-4cc3-b9c7-d9768c1024a6' },
  { name: 'Oliwn',           tmId: '15f96556-99fe-4d24-82f7-bf9aaba03312' },
  { name: 'RaiiN-.',         tmId: '49ecdd10-9fd2-46a3-ba84-f491044304ea' },
  { name: 'ExoTM.',          tmId: '8b6277ee-4173-4678-b61a-153ef8b34dc0' },
  { name: 'Chomp.Tm',        tmId: '83b5f677-3296-4d2a-ad6b-5a100565de22' },
]

async function main() {
  console.log(`Seeding ${PLAYERS.length} players…`)
  let created = 0
  let skipped = 0

  // Logins are only created when setting up an empty database. Afterwards accounts are
  // managed on the Accounts page, and a deleted login must not come back on restart.
  const bootstrapLogins = (await prisma.user.count()) === 0

  for (const p of PLAYERS) {
    const username = p.name.toLowerCase()

    // Create player if tmId not known yet, otherwise leave existing data untouched
    const player = await prisma.player.upsert({
      where: { tmId: p.tmId },
      update: {},
      create: { name: p.name, tmId: p.tmId },
      include: { statusChanges: { orderBy: { effectiveFrom: 'desc' }, take: 1 } },
    })

    // Guests never get a login created automatically; a deleted one must stay deleted
    const status = player.statusChanges[0]?.status ?? player.initialStatus
    if (!bootstrapLogins || status === 'GUEST') {
      skipped++
      continue
    }

    // Skip if username taken OR player already linked to a user
    const [existingByUsername, playerWithUser] = await Promise.all([
      prisma.user.findUnique({ where: { username } }),
      prisma.user.findUnique({ where: { playerId: player.id } }),
    ])
    if (existingByUsername || playerWithUser) {
      skipped++
      continue
    }

    const hashed = await bcrypt.hash(username, 10)
    await prisma.user.create({
      data: {
        name: p.name,
        username,
        password: hashed,
        role: p.role ?? 'PLAYER',
        playerId: player.id,
      },
    })
    console.log(`  + ${p.name} (${username})`)
    created++
  }

  console.log(`Seed done — ${created} created, ${skipped} skipped.`)

  // Every tournament needs a start date: it decides who counts as member or guest
  const tournaments = await prisma.tournament.findMany({ where: { startDate: null }, select: { id: true, createdAt: true } })
  for (const t of tournaments) {
    await prisma.tournament.update({ where: { id: t.id }, data: { startDate: t.createdAt } })
  }
  if (tournaments.length > 0) console.log(`Set start date for ${tournaments.length} tournament(s).`)
}

main()
  .catch((e) => { console.error('Seed failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
