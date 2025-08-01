'use client'

import { useState } from 'react'
import { api } from '~/utils/api'
import { useRouter } from 'next/navigation'

// Mock session for demonstration
const mockSession = {
  user: {
    id: 'user_123',
    name: 'Demo Player',
    email: 'demo@example.com',
    image: null,
  }
}

export function GameLobbyDemo() {
  const router = useRouter()
  const [roomCode, setRoomCode] = useState('')
  const [isSignedIn, setIsSignedIn] = useState(false)
  
  const createGameMutation = api.demo.createDemo.useMutation({
    onSuccess: (result) => {
      router.push(`/room/${result.roomCode}`)
    },
    onError: () => {
      alert('Failed to create game')
    }
  })
  
  const joinGameMutation = api.demo.joinDemo.useMutation({
    onSuccess: (result) => {
      if (result) {
        router.push(`/room/${result.roomCode}`)
      }
    },
    onError: () => {
      alert('Failed to join game')
    }
  })
  
  const { data: activeGames } = api.gameSession.getActive.useQuery()
  const { data: userHistory } = api.demo.getUserHistoryDemo.useQuery(undefined, {
    enabled: isSignedIn,
  })

  const handleCreateGame = async () => {
    createGameMutation.mutate({
      maxPlayers: 10,
      settings: {
        gameMode: 'classic',
        dayDuration: 300,
        nightDuration: 120,
      },
    })
  }

  const handleJoinGame = async () => {
    if (!roomCode.trim()) {
      alert('Please enter a room code')
      return
    }

    joinGameMutation.mutate({ roomCode: roomCode.trim() })
  }

  const handleJoinActiveGame = (gameRoomCode: string) => {
    joinGameMutation.mutate({ roomCode: gameRoomCode })
  }

  if (!isSignedIn) {
    return (
      <div className="container mt-4">
        <div className="text-center">
          <h2>Demo Mode - Sign in to play</h2>
          <p className="text-muted">
            This is a demo of the game session management system.<br/>
            Click "Demo Sign In" to test the functionality.
          </p>
          <button 
            className="btn btn-primary" 
            onClick={() => setIsSignedIn(true)}
          >
            Demo Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mt-4">
      <div className="row">
        <div className="col-md-12">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2>Welcome, {mockSession.user.name}</h2>
            <button 
              className="btn btn-outline-secondary" 
              onClick={() => setIsSignedIn(false)}
            >
              Demo Sign Out
            </button>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-md-6">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Create New Game</h5>
              <p className="card-text">Start a new Mafia game session</p>
              <button 
                className="btn btn-success" 
                onClick={handleCreateGame}
                disabled={createGameMutation.isPending}
              >
                {createGameMutation.isPending ? 'Creating...' : 'Create Game'}
              </button>
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Join Game</h5>
              <div className="mb-3">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Enter room code"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                />
              </div>
              <button 
                className="btn btn-primary" 
                onClick={handleJoinGame}
                disabled={joinGameMutation.isPending}
              >
                {joinGameMutation.isPending ? 'Joining...' : 'Join Game'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="row mt-4">
        <div className="col-md-6">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Active Games</h5>
              {!activeGames ? (
                <div className="text-center">
                  <div className="spinner-border spinner-border-sm" role="status">
                    <span className="sr-only">Loading...</span>
                  </div>
                </div>
              ) : activeGames.length === 0 ? (
                <p>No active games available</p>
              ) : (
                <div>
                  {activeGames.map((game) => (
                    <div key={game.id} className="border p-2 mb-2 rounded">
                      <div className="d-flex justify-content-between">
                        <span>Room: {game.roomCode}</span>
                        <span>{game.participants.length}/{game.maxPlayers} players</span>
                      </div>
                      <button 
                        className="btn btn-sm btn-outline-primary mt-1"
                        onClick={() => handleJoinActiveGame(game.roomCode)}
                        disabled={joinGameMutation.isPending}
                      >
                        Join
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Your Game History</h5>
              {!userHistory ? (
                <div className="text-center">
                  <div className="spinner-border spinner-border-sm" role="status">
                    <span className="sr-only">Loading...</span>
                  </div>
                </div>
              ) : userHistory.length === 0 ? (
                <p>No games played yet</p>
              ) : (
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {userHistory.slice(0, 5).map((game) => (
                    <div key={game.id} className="border p-2 mb-2 rounded">
                      <div className="d-flex justify-content-between">
                        <span>Room: {game.roomCode}</span>
                        <span className={`badge ${
                          game.status === 'FINISHED' ? 'badge-success' : 
                          game.status === 'IN_PROGRESS' ? 'badge-warning' : 
                          'badge-secondary'
                        }`}>
                          {game.status}
                        </span>
                      </div>
                      <small className="text-muted">
                        Role: {game.userRole || 'None'} | 
                        Players: {game.participants.length}
                      </small>
                      {(game.status === 'WAITING' || game.status === 'IN_PROGRESS') && (
                        <div className="mt-1">
                          <button 
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => router.push(`/room/${game.roomCode}`)}
                          >
                            Rejoin
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="alert alert-info mt-4">
        <h6>Demo Information:</h6>
        <p className="mb-0">
          This is a demonstration of the game session management system integrated with tRPC, Zod validation, and database persistence.
          The lobby shows active games, allows creating new sessions, and maintains player history.
        </p>
      </div>
    </div>
  )
}