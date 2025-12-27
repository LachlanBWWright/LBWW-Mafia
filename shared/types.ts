/**
 * Shared TypeScript type definitions for MERN Mafia
 */

// ========== User Types ==========

export interface User {
  id: string;
  name: string | null;
  email: string | null;
  displayName: string | null;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile extends User {
  preferences?: UserPreferences;
  stats?: UserStats;
  _count?: {
    gameParticipations: number;
  };
}

export interface UserPreferences {
  id: string;
  userId: string;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  theme: 'light' | 'dark' | 'system';
  createdAt: Date;
  updatedAt: Date;
}

export interface UserStats {
  id: string;
  userId: string;
  totalGames: number;
  totalWins: number;
  townGames: number;
  townWins: number;
  mafiaGames: number;
  mafiaWins: number;
  neutralGames: number;
  neutralWins: number;
  lastUpdated: Date;
}

// ========== Game Types ==========

export type GameStatus = 'WAITING' | 'STARTING' | 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED';

export type Faction = 'Town' | 'Mafia' | 'Neutral';

export interface GameSession {
  id: string;
  roomId: string;
  roomCode: string;
  status: GameStatus;
  startTime: Date | null;
  endTime: Date | null;
  maxPlayers: number;
  settings: GameSettings | null;
  result: GameResult | null;
  createdAt: Date;
  updatedAt: Date;
  participants: GameParticipation[];
}

export interface GameSettings {
  gameMode?: 'classic' | 'quick' | 'custom';
  dayPhaseTime?: number;
  nightPhaseTime?: number;
  votingTime?: number;
  discussionTime?: number;
  allowedRoles?: string[];
  [key: string]: any;
}

export interface GameResult {
  winner: 'town' | 'mafia' | 'neutral' | 'draw';
  phases?: number;
  duration?: number;
  mvp?: string;
  [key: string]: any;
}

export interface GameParticipation {
  id: string;
  userId: string;
  gameSessionId: string;
  role: string | null;
  isAlive: boolean;
  isWinner: boolean | null;
  joinedAt: Date;
  leftAt: Date | null;
  user?: User;
  gameSession?: GameSession;
}

// ========== Role Types ==========

export interface Role {
  name: string;
  faction: Faction;
  description: string;
  abilities: string[];
  category: 'investigative' | 'protective' | 'killing' | 'support' | 'random';
}

export const TOWN_ROLES = [
  'Doctor',
  'Investigator',
  'Sheriff',
  'Bodyguard',
  'Vigilante',
  'Escort',
  'Lookout',
  'Spy',
  'Transporter',
  'Veteran',
  'Mayor',
  'Marshall',
  'Retributionist',
  'Medium',
  'Townsperson',
] as const;

export const MAFIA_ROLES = [
  'Mafia',
  'Godfather',
  'Mafioso',
  'Consort',
  'Consigliere',
  'Blackmailer',
  'Janitor',
  'Disguiser',
  'Forger',
] as const;

export const NEUTRAL_ROLES = [
  'Jester',
  'Executioner',
  'Arsonist',
  'Serial Killer',
  'Witch',
  'Survivor',
  'Amnesiac',
] as const;

export type TownRole = typeof TOWN_ROLES[number];
export type MafiaRole = typeof MAFIA_ROLES[number];
export type NeutralRole = typeof NEUTRAL_ROLES[number];
export type RoleName = TownRole | MafiaRole | NeutralRole;

// ========== Match History Types ==========

export interface MatchHistoryItem {
  id: string;
  role: string | null;
  isAlive: boolean;
  isWinner: boolean | null;
  joinedAt: Date;
  leftAt: Date | null;
  gameSession: {
    id: string;
    roomCode: string;
    status: GameStatus;
    startTime: Date | null;
    endTime: Date | null;
    result: GameResult | null;
    _count: {
      participants: number;
    };
  };
}

export interface MatchDetails extends GameSession {
  participants: (GameParticipation & {
    user: Pick<User, 'id' | 'name' | 'displayName' | 'image'>;
  })[];
}

// ========== Leaderboard Types ==========

export interface LeaderboardEntry {
  rank: number;
  user: {
    id: string;
    name: string | null;
    image: string | null;
  };
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
}

export type LeaderboardType = 'wins' | 'games' | 'winRate';

// ========== Stats Types ==========

export interface PersonalStats {
  totalGames: number;
  totalWins: number;
  winRate: number;
  townGames: number;
  townWins: number;
  mafiaGames: number;
  mafiaWins: number;
  neutralGames: number;
  neutralWins: number;
  roleStats: RoleStats[];
}

export interface RoleStats {
  role: string;
  gamesPlayed: number;
  wins?: number;
  winRate?: number;
}

// ========== API Response Types ==========

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  message: string;
  code?: string;
  statusCode?: number;
  fields?: Record<string, string>;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor?: string;
  hasMore?: boolean;
  total?: number;
}

// ========== Socket Event Types ==========

export interface SocketEvent {
  type: string;
  payload: any;
  timestamp: Date;
}

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: Date;
  isSystem?: boolean;
}

export interface PlayerAction {
  playerId: string;
  action: 'vote' | 'ability' | 'chat' | 'ready';
  target?: string;
  data?: any;
}

// ========== Form Types ==========

export interface LoginForm {
  email: string;
  password: string;
}

export interface SignUpForm extends LoginForm {
  name: string;
  confirmPassword: string;
}

export interface ProfileUpdateForm {
  name?: string;
  displayName?: string;
}

export interface PreferencesUpdateForm {
  soundEnabled?: boolean;
  notificationsEnabled?: boolean;
  theme?: 'light' | 'dark' | 'system';
}

export interface CreateGameForm {
  maxPlayers: number;
  isPrivate?: boolean;
  settings?: GameSettings;
}

export interface JoinGameForm {
  roomCode: string;
}

// ========== Utility Types ==========

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Nullable<T> = T | null;

export type Optional<T> = T | undefined;

export type ID = string;

export type Timestamp = Date | string;

// ========== Auth Types ==========

export interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export interface AuthSession {
  user: SessionUser;
  expires: string;
}

export interface AuthToken {
  token: string;
  expiresAt: Date;
}
