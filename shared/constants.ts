/**
 * Application constants for MERN Mafia
 */

// ========== Application ==========

export const APP_NAME = 'MERN Mafia';
export const APP_VERSION = '2.0.0';
export const APP_DESCRIPTION = 'Online multiplayer social deduction game';

// ========== URLs ==========

export const GITHUB_URL = 'https://github.com/LachlanBWWright/MERN-Mafia';
export const ISSUES_URL = `${GITHUB_URL}/issues`;
export const DOCS_URL = `${GITHUB_URL}#readme`;

// ========== Time Intervals (milliseconds) ==========

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

// ========== Game Constants ==========

export const ROOM_CODE_LENGTH = 6;
export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 15;
export const DEFAULT_MAX_PLAYERS = 10;

export const DEFAULT_DAY_PHASE_TIME = 90 * SECOND; // 90 seconds
export const DEFAULT_NIGHT_PHASE_TIME = 45 * SECOND; // 45 seconds
export const DEFAULT_VOTING_TIME = 60 * SECOND; // 60 seconds
export const DEFAULT_DISCUSSION_TIME = 30 * SECOND; // 30 seconds

// ========== Rate Limits ==========

export const MAX_REQUESTS_PER_MINUTE = 60;
export const MAX_MESSAGES_PER_MINUTE = 30;
export const MAX_GAME_JOINS_PER_HOUR = 10;

// ========== Pagination ==========

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const MATCH_HISTORY_PAGE_SIZE = 20;
export const LEADERBOARD_PAGE_SIZE = 50;

// ========== Cache Times ==========

export const CACHE_SHORT = 5 * MINUTE; // 5 minutes
export const CACHE_MEDIUM = 15 * MINUTE; // 15 minutes
export const CACHE_LONG = HOUR; // 1 hour
export const CACHE_DAY = DAY; // 1 day

// ========== Session ==========

export const SESSION_MAX_AGE = 30 * DAY; // 30 days
export const SESSION_UPDATE_AGE = DAY; // 1 day

// ========== Validation ==========

export const MIN_DISPLAY_NAME_LENGTH = 1;
export const MAX_DISPLAY_NAME_LENGTH = 30;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;
export const MIN_CHAT_MESSAGE_LENGTH = 1;
export const MAX_CHAT_MESSAGE_LENGTH = 500;

// ========== Role Distribution ==========

// Minimum percentages for balanced gameplay
export const MIN_MAFIA_PERCENTAGE = 0.2; // 20% mafia
export const MAX_MAFIA_PERCENTAGE = 0.4; // 40% mafia
export const TARGET_MAFIA_PERCENTAGE = 0.3; // 30% mafia ideal

// ========== File Sizes ==========

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2MB

// ========== HTTP Status Codes ==========

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;

// ========== Error Codes ==========

export const ERROR_CODES = {
  // Auth
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  AUTH_INVALID: 'AUTH_INVALID',
  
  // Authorization
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  
  // Resources
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',
  
  // Game
  ROOM_FULL: 'ROOM_FULL',
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  ALREADY_IN_GAME: 'ALREADY_IN_GAME',
  GAME_IN_PROGRESS: 'GAME_IN_PROGRESS',
  INVALID_ROOM_CODE: 'INVALID_ROOM_CODE',
  NOT_HOST: 'NOT_HOST',
  INVALID_ACTION: 'INVALID_ACTION',
  
  // System
  RATE_LIMIT: 'RATE_LIMIT',
  SERVER_ERROR: 'SERVER_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
} as const;

// ========== Colors ==========

export const COLORS = {
  // Factions
  TOWN: '#28a745',
  MAFIA: '#dc3545',
  NEUTRAL: '#ffc107',
  
  // UI
  PRIMARY: '#007bff',
  SECONDARY: '#6c757d',
  SUCCESS: '#28a745',
  DANGER: '#dc3545',
  WARNING: '#ffc107',
  INFO: '#17a2b8',
  LIGHT: '#f8f9fa',
  DARK: '#343a40',
  
  // Game States
  ALIVE: '#28a745',
  DEAD: '#6c757d',
  WINNER: '#ffd700',
  LOSER: '#dc3545',
} as const;

// ========== Roles Configuration ==========

export const ROLE_PRIORITIES = {
  // Higher priority = executed first during night phase
  Veteran: 100,
  Transporter: 90,
  Witch: 85,
  Bodyguard: 80,
  Doctor: 75,
  Escort: 70,
  Consort: 70,
  Mafia: 60,
  Godfather: 60,
  Vigilante: 55,
  'Serial Killer': 50,
  Arsonist: 45,
  Investigator: 30,
  Sheriff: 30,
  Lookout: 30,
  Spy: 30,
  Consigliere: 30,
} as const;

// ========== Socket Events ==========

export const SOCKET_EVENTS = {
  // Connection
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'error',
  
  // Game
  JOIN_ROOM: 'joinRoom',
  LEAVE_ROOM: 'leaveRoom',
  START_GAME: 'startGame',
  GAME_STARTED: 'gameStarted',
  GAME_ENDED: 'gameEnded',
  
  // Phase
  PHASE_CHANGE: 'phaseChange',
  DAY_PHASE: 'dayPhase',
  NIGHT_PHASE: 'nightPhase',
  
  // Actions
  VOTE: 'vote',
  ABILITY: 'ability',
  CHAT_MESSAGE: 'chatMessage',
  PLAYER_READY: 'playerReady',
  
  // Updates
  PLAYER_JOINED: 'playerJoined',
  PLAYER_LEFT: 'playerLeft',
  PLAYER_DIED: 'playerDied',
  ROLE_ASSIGNED: 'roleAssigned',
  
  // Results
  VOTE_RESULT: 'voteResult',
  ABILITY_RESULT: 'abilityResult',
  WIN_ANNOUNCEMENT: 'winAnnouncement',
} as const;

// ========== Local Storage Keys ==========

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'mernmafia_auth_token',
  USER_PREFERENCES: 'mernmafia_user_prefs',
  LAST_ROOM_CODE: 'mernmafia_last_room',
  VOLUME_SETTINGS: 'mernmafia_volume',
  GUEST_MODE: 'mernmafia_guest_mode',
} as const;

// ========== Feature Flags ==========

export const FEATURES = {
  GOOGLE_AUTH: true,
  DISCORD_AUTH: false, // Coming soon
  EMAIL_AUTH: false, // Coming soon
  ACHIEVEMENTS: false, // Coming soon
  TOURNAMENTS: false, // Coming soon
  FRIEND_SYSTEM: false, // Coming soon
  VOICE_CHAT: false, // Coming soon
} as const;

// ========== Analytics Events ==========

export const ANALYTICS_EVENTS = {
  USER_SIGNED_UP: 'user_signed_up',
  USER_SIGNED_IN: 'user_signed_in',
  USER_SIGNED_OUT: 'user_signed_out',
  GAME_CREATED: 'game_created',
  GAME_JOINED: 'game_joined',
  GAME_STARTED: 'game_started',
  GAME_COMPLETED: 'game_completed',
  PAGE_VIEW: 'page_view',
  ERROR_OCCURRED: 'error_occurred',
} as const;

// ========== Environment ==========

export const IS_PRODUCTION = process.env.NODE_ENV === 'production';
export const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';
export const IS_TEST = process.env.NODE_ENV === 'test';

export const IS_BROWSER = typeof globalThis !== 'undefined' && 'window' in globalThis;
export const IS_SERVER = !IS_BROWSER;
