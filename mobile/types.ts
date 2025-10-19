// Shared types for mobile app
// These should match the types from the Next.js backend

export interface User {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

export interface GameParticipation {
  id: string;
  userId: string;
  gameSessionId: string;
  role: string;
  joinedAt: Date;
  leftAt: Date | null;
  user?: User;
}

export interface GameSession {
  id: string;
  roomId: string;
  roomCode: string;
  maxPlayers: number;
  status: 'WAITING' | 'STARTING' | 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED';
  settings: Record<string, any>;
  result: Record<string, any> | null;
  createdAt: Date;
  startTime: Date | null;
  endTime: Date | null;
  participants: GameParticipation[];
}
