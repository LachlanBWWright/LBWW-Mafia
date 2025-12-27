#!/bin/bash

# MERN Mafia - One-Command Setup Script
# This script sets up the entire development environment

set -e  # Exit on error

echo "🎮 MERN Mafia - Development Environment Setup"
echo "=============================================="
echo ""

# Check Node.js version
echo "📋 Checking prerequisites..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18+ is required. Current version: $(node -v)"
    exit 1
fi
echo "✅ Node.js version OK: $(node -v)"

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env and add your credentials:"
    echo "   - NEXTAUTH_SECRET (generate with: npx auth secret)"
    echo "   - AUTH_GOOGLE_ID"
    echo "   - AUTH_GOOGLE_SECRET"
    echo ""
fi

# Install database package
echo "📦 Installing database package..."
cd packages/database
npm install
echo "✅ Database package installed"

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate
echo "✅ Prisma client generated"

# Run migrations
echo "🗄️  Running database migrations..."
npx prisma migrate dev --name initial_setup
echo "✅ Migrations applied"

# Seed database
echo "🌱 Seeding database with demo data..."
npm run db:seed
echo "✅ Database seeded"

cd ../..

# Install Next.js dependencies
echo "📦 Installing Next.js dependencies..."
cd nextjs
npm install
echo "✅ Next.js dependencies installed"

cd ..

# Install server dependencies
echo "📦 Installing server dependencies..."
cd server
npm install
echo "✅ Server dependencies installed"

cd ..

# Install mobile dependencies (optional)
read -p "📱 Install mobile app dependencies? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    cd mobile
    npm install
    echo "✅ Mobile dependencies installed"
    cd ..
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 To start development:"
echo "   Terminal 1: cd nextjs && npm run dev"
echo "   Terminal 2: cd server && npm start"
echo "   Terminal 3: cd mobile && npm start (optional)"
echo ""
echo "🌐 Access points:"
echo "   Web: http://localhost:3000"
echo "   API: http://localhost:3000/api/trpc"
echo "   Socket: http://localhost:8000"
echo ""
echo "📚 Next steps:"
echo "   1. Edit .env with your Google OAuth credentials"
echo "   2. Start the development servers"
echo "   3. Visit http://localhost:3000/leaderboard to see demo data"
echo "   4. Sign in at http://localhost:3000/auth/signin"
echo ""
echo "Happy coding! 🎉"
