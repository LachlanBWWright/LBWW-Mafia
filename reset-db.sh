#!/bin/bash

# Database Reset and Seed Script for MERN Mafia

echo "🔄 Resetting database..."

cd packages/database

# Remove existing database
rm -f dev.db dev.db-journal

# Run migrations
echo "📦 Running migrations..."
npx prisma migrate dev --name reset

# Install tsx if not present
if ! command -v tsx &> /dev/null; then
    echo "📥 Installing tsx..."
    npm install tsx
fi

# Run seed
echo "🌱 Seeding database..."
npm run db:seed

echo "✅ Database reset and seeded successfully!"
echo ""
echo "You can now:"
echo "  - Start the Next.js server: cd nextjs && npm run dev"
echo "  - Open Prisma Studio: cd packages/database && npx prisma studio"
echo "  - View at: http://localhost:3000"
