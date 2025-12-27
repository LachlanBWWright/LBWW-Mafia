'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { api } from '~/utils/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function MatchHistoryPage() {
  const { status } = useSession();
  const router = useRouter();
  const [filter, setFilter] = useState<{ status?: 'FINISHED' | 'CANCELLED' }>({});

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = api.match.getHistory.useInfiniteQuery(
    { limit: 20, filter },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      enabled: status === 'authenticated',
    }
  );

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    router.push('/auth/signin?callbackUrl=/history');
    return null;
  }

  const matches = data?.pages.flatMap(page => page.items) ?? [];

  return (
    <div className="min-h-screen bg-gray-900 text-white py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">Match History</h1>

        {/* Filters */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-4 mb-6">
          <div className="flex gap-4 flex-wrap">
            <select
              value={filter.status || ''}
              onChange={(e) => setFilter({ status: e.target.value as 'FINISHED' | 'CANCELLED' | undefined })}
              className="bg-gray-700 text-white border border-gray-600 rounded px-3 py-2"
            >
              <option value="">All Games</option>
              <option value="FINISHED">Finished</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Match List */}
        <div className="space-y-4">
          {matches.length === 0 ? (
            <div className="bg-gray-800 rounded-lg shadow-lg p-8 text-center">
              <p className="text-gray-400 text-lg">No matches found</p>
              <Link href="/lobby" className="text-blue-400 hover:text-blue-300 mt-4 inline-block">
                Join a game to start playing!
              </Link>
            </div>
          ) : (
            matches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))
          )}
        </div>

        {/* Load More */}
        {hasNextPage && (
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="mt-6 w-full py-3 bg-blue-600 hover:bg-blue-700 
                       text-white font-medium rounded-lg
                       disabled:bg-gray-700 disabled:cursor-not-allowed
                       transition-colors duration-200"
          >
            {isFetchingNextPage ? 'Loading...' : 'Load More'}
          </button>
        )}
      </div>
    </div>
  );
}

function MatchCard({ match }: { match: any }) {
  const gameDate = new Date(match.joinedAt);
  const isWinner = match.isWinner === true;
  
  return (
    <Link href={`/history/${match.gameSession.id}`}>
      <div className="bg-gray-800 rounded-lg shadow-lg p-5 hover:bg-gray-750 transition-colors cursor-pointer">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xl font-semibold text-white">
                Room: {match.gameSession.roomCode}
              </span>
              {isWinner !== null && (
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  isWinner 
                    ? 'bg-green-900 text-green-200' 
                    : 'bg-red-900 text-red-200'
                }`}>
                  {isWinner ? 'Victory' : 'Defeat'}
                </span>
              )}
            </div>
            <div className="flex gap-4 text-sm text-gray-400">
              <span>Role: {match.role ?? 'Unknown'}</span>
              <span>•</span>
              <span>{match.gameSession._count.participants} players</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400">
              {gameDate.toLocaleDateString()}
            </div>
            <div className="text-xs text-gray-500">
              {gameDate.toLocaleTimeString()}
            </div>
          </div>
        </div>
        
        {match.gameSession.status === 'CANCELLED' && (
          <div className="text-xs text-gray-500 italic">Game was cancelled</div>
        )}
      </div>
    </Link>
  );
}
