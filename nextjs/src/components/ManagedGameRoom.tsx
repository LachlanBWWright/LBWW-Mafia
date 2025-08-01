'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { api } from '~/utils/api'
import { Room } from '../app/play/Room'
import { PartyKitSocketClient } from '~/socket/PartyKitClient'
import { SocketIoClient } from '~/socket/SocketIoClient'
import { env } from '~/env'
import type { AbstractSocketClient } from '~/socket/AbstractSocketClient'

interface ManagedGameRoomProps {
  roomCode: string
}

export function ManagedGameRoom({ roomCode }: ManagedGameRoomProps) {
  const { data: session } = useSession()
  const [socketClient, setSocketClient] = useState<AbstractSocketClient | null>(null)
  const [playerRole, setPlayerRole] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [failReason, setFailReason] = useState('')
  const [hasJoinedSocket, setHasJoinedSocket] = useState(false)

  // Get game session data
  const { 
    data: gameSession, 
    refetch: refetchGameSession,
    isLoading: gameSessionLoading 
  } = api.gameSession.get.useQuery({ roomCode })

  // Set up socket client
  useEffect(() => {
    if (!gameSession?.roomId) return

    const backend = env.NEXT_PUBLIC_SOCKET_BACKEND
    let client: AbstractSocketClient

    if (backend === 'partykit') {
      client = new PartyKitSocketClient(
        env.NEXT_PUBLIC_PARTYKIT_URL,
        gameSession.roomId
      )
    } else {
      client = new SocketIoClient(env.NEXT_PUBLIC_SOCKETIO_URL)
    }

    setSocketClient(client)

    return () => {
      // Cleanup socket connection
      if (client && typeof client.disconnect === 'function') {
        client.disconnect()
      }
    }
  }, [gameSession?.roomId])

  // Set player name from session
  useEffect(() => {
    if (session?.user?.name) {
      setPlayerName(session.user.name)
    }
  }, [session])

  // Auto-join database game session if not already joined
  const joinDatabaseSession = api.gameSession.join.useMutation({
    onSuccess: () => {
      refetchGameSession()
    },
    onError: (error) => {
      setFailReason(error.message)
    }
  })

  useEffect(() => {
    if (gameSession && session?.user && !gameSessionLoading) {
      // Check if user is already in the game session
      const userInSession = gameSession.participants.some(
        p => p.user.id === session.user.id
      )
      
      if (!userInSession && gameSession.status === 'WAITING') {
        // Auto-join the database session
        joinDatabaseSession.mutate({ roomCode })
      }
    }
  }, [gameSession, session, gameSessionLoading, roomCode])

  // Handle game state updates
  const updateGameSession = api.gameSession.update.useMutation({
    onSuccess: () => {
      refetchGameSession()
    }
  })

  // Start game function (for host)
  const startGame = () => {
    if (gameSession) {
      updateGameSession.mutate({
        gameSessionId: gameSession.id,
        status: 'IN_PROGRESS'
      })
    }
  }

  // End game function (for host)
  const endGame = (result: any) => {
    if (gameSession) {
      updateGameSession.mutate({
        gameSessionId: gameSession.id,
        status: 'FINISHED',
        result
      })
    }
  }

  if (gameSessionLoading) {
    return (
      <div className="container mt-4">
        <div className="text-center">
          <div className="spinner-border" role="status">
            <span className="sr-only">Loading...</span>
          </div>
          <p>Loading game session...</p>
        </div>
      </div>
    )
  }

  if (!gameSession) {
    return (
      <div className="container mt-4">
        <div className="alert alert-danger">
          <h4>Game session not found</h4>
          <p>Room code "{roomCode}" does not exist or has been closed.</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="container mt-4">
        <div className="alert alert-warning">
          <h4>Authentication required</h4>
          <p>Please sign in to join this game session.</p>
        </div>
      </div>
    )
  }

  const userInSession = gameSession.participants.some(
    p => p.user.id === session.user.id
  )
  const isHost = gameSession.participants.some(
    p => p.user.id === session.user.id && p.role === 'HOST'
  )

  if (!userInSession) {
    return (
      <div className="container mt-4">
        <div className="card">
          <div className="card-body">
            <h5 className="card-title">Join Game Session</h5>
            <p>Room: {gameSession.roomCode}</p>
            <p>Players: {gameSession.participants.length}/{gameSession.maxPlayers}</p>
            <p>Status: {gameSession.status}</p>
            
            {gameSession.status === 'WAITING' ? (
              <button 
                className="btn btn-primary"
                onClick={() => joinDatabaseSession.mutate({ roomCode })}
                disabled={joinDatabaseSession.isPending}
              >
                {joinDatabaseSession.isPending ? 'Joining...' : 'Join Game'}
              </button>
            ) : (
              <div className="alert alert-info">
                This game has already started or finished.
              </div>
            )}
            
            {failReason && (
              <div className="alert alert-danger mt-2">
                {failReason}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container-fluid" style={{ height: '100vh' }}>
      <div className="row h-100">
        <div className="col-md-9 h-100">
          {/* Game Room Component */}
          {socketClient ? (
            <div className="card h-100">
              <div className="card-body d-flex flex-column">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <h5>Room: {gameSession.roomCode}</h5>
                    <span className="badge badge-secondary">{gameSession.status}</span>
                  </div>
                  {isHost && gameSession.status === 'WAITING' && (
                    <button 
                      className="btn btn-success"
                      onClick={startGame}
                      disabled={updateGameSession.isPending || gameSession.participants.length < 4}
                    >
                      {updateGameSession.isPending ? 'Starting...' : 'Start Game'}
                    </button>
                  )}
                </div>
                
                <div className="flex-grow-1 d-flex flex-column">
                  <Room
                    socketClient={socketClient}
                    captchaToken="dummy-token"
                    setFailReason={setFailReason}
                    setName={setPlayerName}
                    setRoom={() => {}}
                    setRole={setPlayerRole}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="d-flex justify-content-center align-items-center h-100">
              <div className="text-center">
                <div className="spinner-border" role="status">
                  <span className="sr-only">Loading...</span>
                </div>
                <p>Connecting to game server...</p>
              </div>
            </div>
          )}
        </div>
        
        <div className="col-md-3">
          {/* Game Session Info Panel */}
          <div className="card h-100">
            <div className="card-header">
              <h6>Game Information</h6>
            </div>
            <div className="card-body">
              <div className="mb-3">
                <strong>Room Code:</strong> {gameSession.roomCode}
              </div>
              <div className="mb-3">
                <strong>Status:</strong> 
                <span className={`badge ml-2 ${
                  gameSession.status === 'WAITING' ? 'badge-warning' :
                  gameSession.status === 'IN_PROGRESS' ? 'badge-success' :
                  gameSession.status === 'FINISHED' ? 'badge-primary' :
                  'badge-secondary'
                }`}>
                  {gameSession.status}
                </span>
              </div>
              <div className="mb-3">
                <strong>Players ({gameSession.participants.length}/{gameSession.maxPlayers}):</strong>
                <ul className="list-unstyled mt-2">
                  {gameSession.participants.map((participant, index) => (
                    <li key={participant.id} className="mb-1">
                      <div className="d-flex align-items-center">
                        {participant.user.image && (
                          <img 
                            src={participant.user.image} 
                            alt=""
                            className="rounded-circle mr-2"
                            style={{ width: '20px', height: '20px' }}
                          />
                        )}
                        <span className="flex-grow-1">
                          {participant.user.name}
                          {participant.role === 'HOST' && (
                            <span className="badge badge-primary ml-1">Host</span>
                          )}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              
              {gameSession.settings && (
                <div className="mb-3">
                  <strong>Settings:</strong>
                  <pre className="mt-1 p-2 bg-light rounded small">
                    {JSON.stringify(gameSession.settings, null, 2)}
                  </pre>
                </div>
              )}
              
              {failReason && (
                <div className="alert alert-danger alert-sm">
                  {failReason}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}