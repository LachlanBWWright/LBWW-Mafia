/**
 * Common utility functions for MERN Mafia
 * Shared between client and server
 */

/**
 * Generate a random room code for games
 * @param length Length of the code (default: 6)
 * @returns Alphanumeric room code
 */
export function generateRoomCode(length: number = 6): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

/**
 * Calculate win rate percentage
 * @param wins Number of wins
 * @param total Total games played
 * @returns Win rate as percentage (0-100)
 */
export function calculateWinRate(wins: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((wins / total) * 1000) / 10; // Round to 1 decimal
}

/**
 * Format duration between two dates
 * @param start Start date
 * @param end End date
 * @returns Formatted duration string
 */
export function formatDuration(start: Date, end: Date): string {
  const diff = end.getTime() - start.getTime();
  const minutes = Math.floor(diff / 1000 / 60);
  const seconds = Math.floor((diff / 1000) % 60);
  
  if (minutes === 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

/**
 * Format relative time (e.g., "2 hours ago")
 * @param date Date to format
 * @returns Relative time string
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`;
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`;
  return `${years} year${years !== 1 ? 's' : ''} ago`;
}

/**
 * Truncate text to a maximum length
 * @param text Text to truncate
 * @param maxLength Maximum length
 * @returns Truncated text with ellipsis if needed
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Validate email format
 * @param email Email to validate
 * @returns True if valid email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Debounce a function call
 * @param func Function to debounce
 * @param delay Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Capitalize first letter of a string
 * @param str String to capitalize
 * @returns Capitalized string
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Get faction from role name
 * @param role Role name
 * @returns Faction name (Town, Mafia, or Neutral)
 */
export function getFactionFromRole(role: string): 'Town' | 'Mafia' | 'Neutral' {
  const mafiaRoles = ['Mafia', 'Godfather', 'Consort'];
  const neutralRoles = ['Jester', 'Executioner', 'Serial Killer', 'Arsonist'];
  
  if (mafiaRoles.includes(role)) return 'Mafia';
  if (neutralRoles.includes(role)) return 'Neutral';
  return 'Town';
}

/**
 * Get role color based on faction
 * @param role Role name
 * @returns Hex color code
 */
export function getRoleColor(role: string): string {
  const faction = getFactionFromRole(role);
  switch (faction) {
    case 'Town':
      return '#28a745'; // Green
    case 'Mafia':
      return '#dc3545'; // Red
    case 'Neutral':
      return '#ffc107'; // Yellow
    default:
      return '#6c757d'; // Gray
  }
}

/**
 * Sort players by role (Mafia > Neutral > Town)
 * @param players Array of players with role property
 * @returns Sorted array
 */
export function sortPlayersByRole<T extends { role: string | null }>(players: T[]): T[] {
  return [...players].sort((a, b) => {
    if (!a.role) return 1;
    if (!b.role) return -1;
    
    const factionA = getFactionFromRole(a.role);
    const factionB = getFactionFromRole(b.role);
    
    const order = { Mafia: 0, Neutral: 1, Town: 2 };
    return order[factionA] - order[factionB];
  });
}

/**
 * Check if user can perform action (rate limiting check)
 * @param lastAction Timestamp of last action
 * @param cooldown Cooldown in milliseconds
 * @returns True if action is allowed
 */
export function canPerformAction(lastAction: Date | null, cooldown: number): boolean {
  if (!lastAction) return true;
  const now = new Date();
  return now.getTime() - lastAction.getTime() >= cooldown;
}

/**
 * Parse JSON safely
 * @param json JSON string to parse
 * @param fallback Fallback value if parsing fails
 * @returns Parsed object or fallback
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Generate random integer between min and max (inclusive)
 * @param min Minimum value
 * @param max Maximum value
 * @returns Random integer
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Shuffle array using Fisher-Yates algorithm
 * @param array Array to shuffle
 * @returns Shuffled array
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
