import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create demo users
  const demoUser1 = await prisma.user.upsert({
    where: { email: 'demo1@example.com' },
    update: {},
    create: {
      email: 'demo1@example.com',
      name: 'Demo Player 1',
      displayName: 'ProTownPlayer',
      image: null,
    },
  });

  const demoUser2 = await prisma.user.upsert({
    where: { email: 'demo2@example.com' },
    update: {},
    create: {
      email: 'demo2@example.com',
      name: 'Demo Player 2',
      displayName: 'MafiaKing',
      image: null,
    },
  });

  console.log('✅ Created demo users');

  // Create user stats for demo users
  await prisma.userStats.upsert({
    where: { userId: demoUser1.id },
    update: {},
    create: {
      userId: demoUser1.id,
      totalGames: 15,
      totalWins: 10,
      townGames: 10,
      townWins: 7,
      mafiaGames: 5,
      mafiaWins: 3,
      neutralGames: 0,
      neutralWins: 0,
    },
  });

  await prisma.userStats.upsert({
    where: { userId: demoUser2.id },
    update: {},
    create: {
      userId: demoUser2.id,
      totalGames: 20,
      totalWins: 12,
      townGames: 8,
      townWins: 4,
      mafiaGames: 10,
      mafiaWins: 7,
      neutralGames: 2,
      neutralWins: 1,
    },
  });

  console.log('✅ Created user stats');

  // Create user preferences
  await prisma.userPreferences.upsert({
    where: { userId: demoUser1.id },
    update: {},
    create: {
      userId: demoUser1.id,
      soundEnabled: true,
      notificationsEnabled: true,
      theme: 'dark',
    },
  });

  await prisma.userPreferences.upsert({
    where: { userId: demoUser2.id },
    update: {},
    create: {
      userId: demoUser2.id,
      soundEnabled: false,
      notificationsEnabled: true,
      theme: 'system',
    },
  });

  console.log('✅ Created user preferences');

  // Create sample game sessions
  const gameSession1 = await prisma.gameSession.create({
    data: {
      roomId: 'demo-room-1',
      roomCode: 'DEMO01',
      status: 'FINISHED',
      maxPlayers: 10,
      startTime: new Date(Date.now() - 3600000), // 1 hour ago
      endTime: new Date(Date.now() - 1800000), // 30 minutes ago
      settings: { gameMode: 'classic' },
      result: { winner: 'town', phases: 5 },
    },
  });

  const gameSession2 = await prisma.gameSession.create({
    data: {
      roomId: 'demo-room-2',
      roomCode: 'DEMO02',
      status: 'FINISHED',
      maxPlayers: 10,
      startTime: new Date(Date.now() - 7200000), // 2 hours ago
      endTime: new Date(Date.now() - 5400000), // 1.5 hours ago
      settings: { gameMode: 'classic' },
      result: { winner: 'mafia', phases: 4 },
    },
  });

  console.log('✅ Created game sessions');

  // Create game participations
  await prisma.gameParticipation.create({
    data: {
      userId: demoUser1.id,
      gameSessionId: gameSession1.id,
      role: 'Doctor',
      isAlive: true,
      isWinner: true,
      joinedAt: new Date(Date.now() - 3600000),
    },
  });

  await prisma.gameParticipation.create({
    data: {
      userId: demoUser2.id,
      gameSessionId: gameSession1.id,
      role: 'Mafia',
      isAlive: false,
      isWinner: false,
      joinedAt: new Date(Date.now() - 3600000),
    },
  });

  await prisma.gameParticipation.create({
    data: {
      userId: demoUser1.id,
      gameSessionId: gameSession2.id,
      role: 'Townsperson',
      isAlive: false,
      isWinner: false,
      joinedAt: new Date(Date.now() - 7200000),
    },
  });

  await prisma.gameParticipation.create({
    data: {
      userId: demoUser2.id,
      gameSessionId: gameSession2.id,
      role: 'Mafia',
      isAlive: true,
      isWinner: true,
      joinedAt: new Date(Date.now() - 7200000),
    },
  });

  console.log('✅ Created game participations');
  console.log('\n🎉 Seed completed successfully!');
  console.log('\nDemo users created:');
  console.log('  1. demo1@example.com (ProTownPlayer)');
  console.log('  2. demo2@example.com (MafiaKing)');
  console.log('\nYou can now:');
  console.log('  - View leaderboard at /leaderboard');
  console.log('  - Check stats at /stats');
  console.log('  - Browse match history at /history');
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
