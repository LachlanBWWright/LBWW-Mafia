/**
 * Game constants for MERN-Mafia
 * 
 * This file contains all magic numbers used throughout the game logic,
 * organized by category to improve maintainability and reduce tech debt.
 */

// ===== TIMING CONSTANTS =====
/**
 * Base session length multiplier (in milliseconds)
 * Used to calculate initial day/night durations based on room size
 */
export const SESSION_LENGTH_MULTIPLIER = 4000;

/**
 * Duration of the first day in milliseconds
 * First day is shorter than normal days to get the game started quickly
 */
export const FIRST_DAY_DURATION = 5000;

/**
 * Minimum duration for day sessions in milliseconds
 * Days have a minimum length regardless of decreasing session times
 */
export const MINIMUM_DAY_DURATION = 10000;

/**
 * Duration of night sessions in milliseconds
 * Nights are always fixed length
 */
export const NIGHT_DURATION = 15000;

// ===== PROBABILITY CONSTANTS =====
/**
 * Probability that a whisper will be overheard by the town (0.0 to 1.0)
 * 10% chance that private whispers become public
 */
export const WHISPER_OVERHEARD_CHANCE = 0.1;

/**
 * Probability that the Judge role gives incorrect information (0.0 to 1.0)
 * 30% chance the Judge gets wrong faction information
 */
export const JUDGE_ERROR_RATE = 0.3;

/**
 * General 50/50 probability used by various roles (0.0 to 1.0)
 * Used for coin-flip decisions in role abilities
 */
export const FIFTY_FIFTY_CHANCE = 0.5;

/**
 * Probability threshold for adding neutral roles vs mafia (0.0 to 1.0)
 * 30% chance to add neutral role, 70% chance to add mafia when not adding town
 */
export const NEUTRAL_ROLE_THRESHOLD = 0.3;

// ===== GAME BALANCE CONSTANTS =====
/**
 * Power balance threshold for town advantage
 * When comparative power exceeds this, force mafia roles to balance
 */
export const TOWN_POWER_THRESHOLD = 15;

/**
 * Power balance threshold for mafia advantage  
 * When comparative power drops below negative this, force town roles to balance
 */
export const MAFIA_POWER_THRESHOLD = -15;

/**
 * Random variance range for role assignment decisions
 * Random number between -15 and +15 used in role selection algorithm
 */
export const ROLE_ASSIGNMENT_VARIANCE = 15;

/**
 * Maximum number of days before game ends in a draw
 * Prevents games from going on indefinitely
 */
export const MAX_GAME_DAYS = 25;

/**
 * Number of days to extend game when someone dies
 * Resets the end-game timer when players are eliminated
 */
export const DEATH_EXTENSION_DAYS = 3;

// ===== ROLE-SPECIFIC CONSTANTS =====
/**
 * Number of research sessions available to the Vetter role
 * Vetter can investigate players this many times per game
 */
export const VETTER_RESEARCH_SLOTS = 3;

/**
 * Damage amount applied when a player abandons the game
 * High enough to guarantee elimination of disconnected players
 */
export const ABANDON_DAMAGE = 999;

// ===== DEFENSE AND DAMAGE CONSTANTS =====
/**
 * Base defense value for most roles
 * Standard defense level when no special protection is active
 */
export const BASE_DEFENSE = 0;

/**
 * Basic attack damage value
 * Standard damage dealt by most attacking roles
 */
export const BASIC_ATTACK_DAMAGE = 1;

/**
 * Execution damage dealt by Jailor role
 * Higher damage to bypass certain defenses
 */
export const JAILOR_EXECUTION_DAMAGE = 3;

// ===== ROLE POWER RATINGS =====
/**
 * Power ratings for town roles (positive values help town)
 * Used in the role assignment algorithm to balance teams
 */
export const TOWN_ROLE_POWER = {
  DOCTOR: 5,
  JUDGE: 6,
  WATCHMAN: 4,
  INVESTIGATOR: 4,
  LAWMAN: 8,
  VETTER: 4,
  TAPPER: 3,
  TRACKER: 5,
  BODYGUARD: 6,
  NIMBY: 5,
  SACRIFICER: 8,
  FORTIFIER: 8,
  ROLEBLOCKER: 5,
  JAILOR: 12,
} as const;

/**
 * Power ratings for mafia roles (negative values help mafia)
 * Used in the role assignment algorithm to balance teams
 */
export const MAFIA_ROLE_POWER = {
  MAFIA: -13,
  MAFIA_ROLEBLOCKER: -20,
  MAFIA_INVESTIGATOR: -15,
} as const;

/**
 * Power ratings for neutral roles (negative values as they work against town)
 * Used in the role assignment algorithm to balance teams
 */
export const NEUTRAL_ROLE_POWER = {
  MANIAC: -12,
  SNIPER: -10,
  FRAMER: -5,
  CONFESSER: -5,
  PEACEMAKER: -2,
} as const;