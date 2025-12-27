'use client';

import { useState } from 'react';
import { api } from '~/utils/api';

type LeaderboardType = 'wins' | 'games' | 'winRate';

export default function LeaderboardPage() {
  const [type, setType] = useState<LeaderboardType>('wins');
  
  const { data: leaderboard, isLoading } = api.stats.getLeaderboard.useQuery({
    type,
    limit: 50,
  });

  return (
    <div className="min-h-screen bg-gray-900 text-white py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8 text-center">🏆 Leaderboard</h1>

        {/* Filter Tabs */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setType('wins')}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                type === 'wins'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Most Wins
            </button>
            <button
              onClick={() => setType('games')}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                type === 'games'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Most Games
            </button>
            <button
              onClick={() => setType('winRate')}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                type === 'winRate'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Win Rate
            </button>
          </div>
        </div>

        {/* Leaderboard List */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="text-xl text-gray-400">Loading leaderboard...</div>
          </div>
        ) : leaderboard && leaderboard.length > 0 ? (
          <div className="space-y-2">
            {leaderboard.map((entry, index) => (
              <LeaderboardEntry
                key={entry.user.id}
                entry={entry}
                type={type}
                highlight={index < 3}
              />
            ))}
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg shadow-lg p-8 text-center">
            <p className="text-gray-400 text-lg">No leaderboard data yet</p>
            <p className="text-gray-500 text-sm mt-2">
              Be the first to play and claim the top spot!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function LeaderboardEntry({ 
  entry, 
  type, 
  highlight 
}: { 
  entry: any; 
  type: LeaderboardType; 
  highlight: boolean;
}) {
  const rankColors = ['text-yellow-400', 'text-gray-300', 'text-amber-600'];
  const rankEmojis = ['🥇', '🥈', '🥉'];
  
  return (
    <div className={`bg-gray-800 rounded-lg shadow-lg p-4 flex items-center gap-4 ${
      highlight ? 'ring-2 ring-blue-500' : ''
    }`}>
      {/* Rank */}
      <div className={`text-2xl font-bold min-w-[3rem] text-center ${
        entry.rank <= 3 ? rankColors[entry.rank - 1] : 'text-gray-400'
      }`}>
        {entry.rank <= 3 ? rankEmojis[entry.rank - 1] : `#${entry.rank}`}
      </div>

      {/* Avatar */}
      <img
        src={entry.user.image ?? '/default-avatar.png'}
        alt={entry.user.name ?? 'Player'}
        className="w-12 h-12 rounded-full border-2 border-gray-700"
      />

      {/* Name */}
      <div className="flex-1">
        <div className="font-semibold text-lg text-white">
          {entry.user.name ?? 'Anonymous Player'}
        </div>
      </div>

      {/* Stats */}
      <div className="text-right">
        {type === 'wins' && (
          <div className="text-xl font-bold text-green-400">
            {entry.gamesWon} wins
          </div>
        )}
        {type === 'games' && (
          <div className="text-xl font-bold text-blue-400">
            {entry.gamesPlayed} games
          </div>
        )}
        {type === 'winRate' && (
          <div className="text-xl font-bold text-purple-400">
            {entry.winRate}%
          </div>
        )}
        <div className="text-xs text-gray-500">
          {entry.gamesPlayed} games • {entry.gamesWon} wins
        </div>
      </div>
    </div>
  );
}
