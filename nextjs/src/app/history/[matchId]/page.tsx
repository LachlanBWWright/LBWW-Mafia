'use client';

import { useSession } from 'next-auth/react';
import { api } from '~/utils/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { use } from 'react';

export default function MatchDetailsPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = use(params);
  const { status } = useSession();
  const router = useRouter();

  const { data: match, isLoading, error } = api.match.getMatchDetails.useQuery(
    { gameSessionId: matchId },
    { enabled: status === 'authenticated' }
  );

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    router.push(`/auth/signin?callbackUrl=/history/${matchId}`);
    return null;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">❌</div>
          <div className="text-white text-xl mb-2">Error Loading Match</div>
          <div className="text-gray-400">{error.message}</div>
          <Link href="/history" className="text-blue-400 hover:text-blue-300 mt-4 inline-block">
            ← Back to Match History
          </Link>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-xl">Match not found</div>
      </div>
    );
  }

  const startTime = match.startTime ? new Date(match.startTime) : null;
  const endTime = match.endTime ? new Date(match.endTime) : null;
  const duration = startTime && endTime 
    ? Math.round((endTime.getTime() - startTime.getTime()) / 1000 / 60)
    : null;

  return (
    <div className="min-h-screen bg-gray-900 text-white py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="mb-6">
          <Link href="/history" className="text-blue-400 hover:text-blue-300">
            ← Back to Match History
          </Link>
        </div>

        {/* Match Header */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-4xl font-bold mb-2">Room: {match.roomCode}</h1>
              <div className="flex gap-4 text-gray-400">
                <span>Status: {match.status}</span>
                <span>•</span>
                <span>{match.participants.length} Players</span>
              </div>
            </div>
            <div className="text-right">
              {startTime && (
                <div className="text-sm text-gray-400">
                  {startTime.toLocaleDateString()}
                </div>
              )}
              {duration && (
                <div className="text-sm text-gray-500">
                  Duration: {duration} min
                </div>
              )}
            </div>
          </div>

          {/* Game Result */}
          {match.result && typeof match.result === 'object' && 'winner' in match.result && (
            <div className={`p-4 rounded-lg ${
              match.result.winner === 'town' 
                ? 'bg-green-900 bg-opacity-30 border border-green-700'
                : 'bg-red-900 bg-opacity-30 border border-red-700'
            }`}>
              <div className="text-center text-lg font-semibold">
                {match.result.winner === 'town' ? '🏛️ Town Victory!' : '🗡️ Mafia Victory!'}
              </div>
            </div>
          )}
        </div>

        {/* Players List */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Players</h2>
          <div className="space-y-3">
            {match.participants.map((participant: any) => (
              <div 
                key={participant.id}
                className={`p-4 rounded-lg flex items-center gap-4 ${
                  participant.isAlive 
                    ? 'bg-gray-700' 
                    : 'bg-gray-900 opacity-60'
                }`}
              >
                <img
                  src={participant.user.image ?? '/default-avatar.png'}
                  alt={participant.user.name ?? 'Player'}
                  className="w-12 h-12 rounded-full border-2 border-gray-600"
                />
                <div className="flex-1">
                  <div className="font-semibold">
                    {participant.user.displayName || participant.user.name || 'Unknown Player'}
                  </div>
                  <div className="text-sm text-gray-400">
                    Role: {participant.role ?? 'Unknown'}
                  </div>
                </div>
                <div className="flex gap-2">
                  {!participant.isAlive && (
                    <span className="px-3 py-1 bg-red-900 text-red-200 rounded-full text-xs">
                      Eliminated
                    </span>
                  )}
                  {participant.isWinner === true && (
                    <span className="px-3 py-1 bg-green-900 text-green-200 rounded-full text-xs">
                      Winner
                    </span>
                  )}
                  {participant.isWinner === false && (
                    <span className="px-3 py-1 bg-gray-700 text-gray-300 rounded-full text-xs">
                      Loser
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Game Timeline (if available) */}
        {match.result && typeof match.result === 'object' && 'phases' in match.result && (
          <div className="bg-gray-800 rounded-lg shadow-lg p-6 mt-6">
            <h2 className="text-2xl font-semibold mb-4">Game Stats</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-700 p-4 rounded-lg text-center">
                <div className="text-3xl font-bold text-blue-400">
                  {(match.result as any).phases ?? 'N/A'}
                </div>
                <div className="text-sm text-gray-400">Phases</div>
              </div>
              <div className="bg-gray-700 p-4 rounded-lg text-center">
                <div className="text-3xl font-bold text-green-400">
                  {match.participants.filter(p => p.isAlive).length}
                </div>
                <div className="text-sm text-gray-400">Survived</div>
              </div>
              <div className="bg-gray-700 p-4 rounded-lg text-center">
                <div className="text-3xl font-bold text-red-400">
                  {match.participants.filter(p => !p.isAlive).length}
                </div>
                <div className="text-sm text-gray-400">Eliminated</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
