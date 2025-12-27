'use client';

import { useSession } from 'next-auth/react';
import { api } from '~/utils/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AccountPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { data: profile } = api.user.getProfile.useQuery(undefined, {
    enabled: status === 'authenticated',
  });
  const { data: stats } = api.stats.getPersonalStats.useQuery(undefined, {
    enabled: status === 'authenticated',
  });

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    router.push('/auth/signin?callbackUrl=/account');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <h1 className="text-4xl font-bold mb-8">My Account</h1>

        {/* Profile Summary */}
        <section className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center gap-6">
            <img
              src={profile?.image ?? '/default-avatar.png'}
              alt={profile?.name ?? 'User'}
              className="w-24 h-24 rounded-full border-4 border-gray-700"
            />
            <div>
              <h2 className="text-3xl font-semibold mb-1">
                {profile?.displayName || profile?.name || 'Player'}
              </h2>
              <p className="text-gray-400 mb-2">{session?.user?.email}</p>
              <Link 
                href="/account/profile" 
                className="text-blue-400 hover:text-blue-300 underline"
              >
                Edit Profile
              </Link>
            </div>
          </div>
        </section>

        {/* Quick Stats */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <StatCard title="Games Played" value={stats?.totalGames ?? 0} />
          <StatCard title="Games Won" value={stats?.totalWins ?? 0} />
          <StatCard 
            title="Win Rate" 
            value={`${stats?.winRate?.toFixed(1) ?? 0}%`} 
          />
        </section>

        {/* Quick Links */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <QuickLinkCard
            title="Match History"
            description="View your past games and performance"
            href="/history"
            icon="📜"
          />
          <QuickLinkCard
            title="Statistics"
            description="Detailed stats and role performance"
            href="/stats"
            icon="📊"
          />
          <QuickLinkCard
            title="Settings"
            description="Manage preferences and notifications"
            href="/account/settings"
            icon="⚙️"
          />
          <QuickLinkCard
            title="Leaderboard"
            description="See how you rank against others"
            href="/leaderboard"
            icon="🏆"
          />
        </section>
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number | string }) {
  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6">
      <h3 className="text-gray-400 text-sm font-medium mb-2">{title}</h3>
      <p className="text-4xl font-bold text-white">{value}</p>
    </div>
  );
}

function QuickLinkCard({ 
  title, 
  description, 
  href, 
  icon 
}: { 
  title: string; 
  description: string; 
  href: string;
  icon: string;
}) {
  return (
    <Link href={href}>
      <div className="bg-gray-800 rounded-lg shadow-lg p-6 hover:bg-gray-750 transition-colors cursor-pointer h-full">
        <div className="flex items-start gap-4">
          <span className="text-4xl">{icon}</span>
          <div>
            <h3 className="text-xl font-semibold mb-2 text-white">{title}</h3>
            <p className="text-gray-400 text-sm">{description}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}
