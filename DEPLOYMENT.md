# Production Deployment Guide

This guide covers deploying MERN Mafia to production environments.

## 🚀 Quick Deploy Options

### Option 1: Vercel (Next.js) + Railway (Database)

**Advantages:**
- Zero-config deployment
- Automatic HTTPS
- Edge network distribution
- Free tier available

**Steps:**

1. **Deploy Database to Railway**
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login
   railway login
   
   # Create new project
   railway init
   
   # Add PostgreSQL
   railway add postgresql
   
   # Get DATABASE_URL
   railway variables
   ```

2. **Deploy Next.js to Vercel**
   ```bash
   # Install Vercel CLI
   npm install -g vercel
   
   # Login
   vercel login
   
   # Deploy
   cd nextjs
   vercel
   ```

3. **Configure Environment Variables in Vercel**
   - `DATABASE_URL` - From Railway
   - `NEXTAUTH_SECRET` - Generate with `npx auth secret`
   - `AUTH_GOOGLE_ID` - From Google Cloud Console
   - `AUTH_GOOGLE_SECRET` - From Google Cloud Console
   - `NEXTAUTH_URL` - Your Vercel URL

4. **Update Google OAuth**
   - Add Vercel URL to authorized redirect URIs
   - Format: `https://your-app.vercel.app/api/auth/callback/google`

### Option 2: Docker + VPS (Full Control)

**Advantages:**
- Complete control
- Self-hosted
- Cost-effective for high traffic

**Steps:**

1. **Prepare Server**
   ```bash
   # Ubuntu/Debian
   apt update && apt upgrade -y
   apt install docker.io docker-compose -y
   ```

2. **Clone Repository**
   ```bash
   git clone https://github.com/LachlanBWWright/MERN-Mafia.git
   cd MERN-Mafia
   ```

3. **Configure Production Environment**
   ```bash
   cp .env.example .env.production
   # Edit .env.production with production values
   ```

4. **Update docker-compose.yml**
   ```yaml
   # Use production DATABASE_URL
   # Add proper secrets management
   # Configure reverse proxy (nginx/traefik)
   ```

5. **Deploy**
   ```bash
   docker-compose -f docker-compose.yml up -d
   ```

6. **Setup SSL with Let's Encrypt**
   ```bash
   # Using Certbot
   apt install certbot python3-certbot-nginx
   certbot --nginx -d yourdomain.com
   ```

### Option 3: AWS (Enterprise)

**Advantages:**
- Scalable
- Full AWS ecosystem
- Professional support

**Services Used:**
- **RDS PostgreSQL** - Database
- **Elastic Beanstalk** - Next.js application
- **EC2/ECS** - Socket.IO server
- **CloudFront** - CDN
- **Route 53** - DNS

## 🔐 Security Checklist

### Before Deploying

- [ ] Strong `NEXTAUTH_SECRET` (32+ characters)
- [ ] Enable HTTPS everywhere
- [ ] Configure CORS properly
- [ ] Set up rate limiting
- [ ] Enable database backups
- [ ] Configure firewall rules
- [ ] Use environment variables (never commit secrets)
- [ ] Enable database SSL connections
- [ ] Set up monitoring and alerts
- [ ] Configure proper CSP headers

### Database Security

```env
# PostgreSQL with SSL
DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"
```

### NextAuth Configuration

```typescript
// nextjs/src/server/api/auth.ts
export const authOptions: NextAuthOptions = {
  // ... existing config
  cookies: {
    sessionToken: {
      name: `__Secure-next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: true, // HTTPS only in production
      },
    },
  },
};
```

## 📊 Database Migration

### Migrate from SQLite to PostgreSQL

1. **Backup SQLite Data**
   ```bash
   cd packages/database
   npx prisma db push --accept-data-loss
   ```

2. **Update DATABASE_URL**
   ```env
   DATABASE_URL="postgresql://user:password@host:5432/dbname"
   ```

3. **Run Migrations**
   ```bash
   npx prisma migrate deploy
   ```

4. **Seed if Needed**
   ```bash
   npm run db:seed
   ```

## 🔧 Environment Variables

### Required Variables

```env
# Database
DATABASE_URL="postgresql://..."

# NextAuth
NEXTAUTH_URL="https://yourdomain.com"
NEXTAUTH_SECRET="<generate-32-char-secret>"

# Google OAuth
AUTH_GOOGLE_ID="..."
AUTH_GOOGLE_SECRET="..."

# Optional: Socket.IO URL
NEXT_PUBLIC_SOCKETIO_URL="wss://socket.yourdomain.com"
```

### Generate Secrets

```bash
# NEXTAUTH_SECRET
npx auth secret

# Or use openssl
openssl rand -base64 32
```

## 📈 Performance Optimization

### Database Indexing

Ensure these indexes exist:
```sql
CREATE INDEX idx_game_session_status ON GameSession(status);
CREATE INDEX idx_game_session_created ON GameSession(createdAt);
CREATE INDEX idx_participation_user ON GameParticipation(userId);
CREATE INDEX idx_user_stats_wins ON UserStats(totalWins);
```

### Next.js Optimization

```javascript
// next.config.js
module.exports = {
  output: 'standalone', // For Docker
  compress: true,
  images: {
    domains: ['lh3.googleusercontent.com'], // Google profile images
  },
};
```

### Caching Strategy

1. **React Query** - Already configured with stale times
2. **CDN Caching** - Static assets via CloudFront/Vercel Edge
3. **Database Connection Pooling** - Configure in Prisma

## 🔍 Monitoring

### Recommended Tools

1. **Sentry** - Error tracking
   ```bash
   npm install @sentry/nextjs
   ```

2. **LogRocket** - Session replay
3. **Datadog** - Infrastructure monitoring
4. **Prisma Pulse** - Database monitoring

### Health Check Endpoints

Add to `/nextjs/src/app/api/health/route.ts`:
```typescript
export async function GET() {
  // Check database connection
  // Check external services
  return Response.json({ status: 'ok' });
}
```

## 🔄 CI/CD Pipeline

GitHub Actions workflow already configured at `.github/workflows/ci.yml`.

### Additional Steps for Production

1. **Add Deployment Step**
   ```yaml
   - name: Deploy to Production
     if: github.ref == 'refs/heads/main'
     run: vercel --prod
   ```

2. **Database Migrations**
   ```yaml
   - name: Run Migrations
     run: npx prisma migrate deploy
   ```

3. **Smoke Tests**
   ```yaml
   - name: Smoke Test
     run: curl https://yourdomain.com/api/health
   ```

## 📱 Mobile App Deployment

### iOS (App Store)

1. **Configure App**
   ```bash
   cd mobile
   npx expo prebuild
   ```

2. **Update API URLs**
   ```typescript
   // mobile/config.ts
   export const config = {
     apiUrl: 'https://api.yourdomain.com',
     socketUrl: 'wss://socket.yourdomain.com',
   };
   ```

3. **Build**
   ```bash
   eas build --platform ios
   ```

### Android (Google Play)

1. **Build APK**
   ```bash
   eas build --platform android
   ```

2. **Submit**
   ```bash
   eas submit -p android
   ```

## 🚨 Rollback Strategy

### Quick Rollback

**Vercel:**
```bash
vercel rollback <deployment-url>
```

**Docker:**
```bash
docker-compose down
git checkout <previous-commit>
docker-compose up -d
```

### Database Rollback

```bash
# Revert last migration
npx prisma migrate resolve --rolled-back <migration-name>
```

## 📝 Post-Deployment Checklist

- [ ] Test authentication flow
- [ ] Verify database connections
- [ ] Check all API endpoints
- [ ] Test socket connections
- [ ] Verify email notifications (if implemented)
- [ ] Test mobile app connectivity
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Verify backups are running
- [ ] Test rollback procedure

## 🆘 Troubleshooting

### Common Issues

**Issue: OAuth redirect mismatch**
- Solution: Update Google Cloud Console authorized redirect URIs

**Issue: Database connection timeout**
- Solution: Check connection pooling settings, increase timeout

**Issue: WebSocket connection fails**
- Solution: Verify CORS and WebSocket proxy configuration

**Issue: Build fails on Vercel**
- Solution: Check build logs, verify environment variables

## 📞 Support

For deployment issues:
1. Check GitHub Issues
2. Review deployment logs
3. Open a support ticket

---

**Remember:** Always test in staging before production!
