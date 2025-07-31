# MERN-Mafia Game Mechanics Documentation

## Overview

MERN-Mafia is a multiplayer social deduction game inspired by Mafia and Town of Salem. Players are assigned secret roles and must work together (or against each other) to achieve their faction's victory conditions.

## Game Flow

### Game Setup
1. Players join a room (up to a configurable maximum)
2. When the room is full, roles are randomly assigned based on a balance algorithm
3. The game begins with Day 1

### Day/Night Cycle
- **Day Phase**: Players can discuss, vote to eliminate someone, whisper privately, and use day abilities
- **Night Phase**: Players use night abilities, factions coordinate attacks, and role actions are resolved

### Phase Timing
- **First Day**: 5 seconds (quick start)
- **Regular Days**: Base duration + 10 seconds minimum, decreases over time
- **Nights**: Fixed 15 seconds

## Factions

### Town
- **Goal**: Eliminate all mafia and hostile neutral players
- **Abilities**: Various investigative, protective, and utility roles
- **Voting**: Can vote during the day to eliminate players

### Mafia
- **Goal**: Achieve numerical parity with or outnumber the town
- **Abilities**: Coordinated night attacks and deceptive roles
- **Coordination**: Share a private faction chat and vote on targets

### Neutral
- **Goal**: Varies by role (some seek to be eliminated, others to survive, etc.)
- **Abilities**: Unique roles with individual victory conditions

## Core Mechanics

### Voting and Elimination
- During day phases, players can vote to eliminate someone
- Requires a majority of living players to execute
- Once voted out, players cannot speak (except dead chat)
- Some roles have special interactions with voting

### Defense and Damage System
- **Basic Defense (1)**: Protects against basic attacks
- **Basic Attack (1)**: Standard damage from most roles
- **Enhanced Attack (3)**: Higher damage that bypasses basic defense
- **No Defense (0)**: Vulnerable to all attacks

### Role Blocking
- Prevents players from using their night abilities
- Some roles are immune to role blocking
- Roleblocked players are notified

### Visiting System
- Many roles "visit" other players to use abilities
- Visits can be tracked by certain investigative roles
- Some roles can see who visited them

## Special Mechanics

### Whispers
- Private messages between players during day phases
- 10% chance of being overheard by the entire town
- Can be intercepted by certain roles

### Jailing (Jailor Role)
- Jailor can jail someone during the day
- Jailed players are roleblocked and protected
- Jailor can choose to execute jailed players at night

### Unique Roles
- Some roles can only appear once per game
- These are typically powerful or game-changing roles

## Victory Conditions

### Town Victory
- All mafia members are eliminated
- All hostile neutral players are eliminated

### Mafia Victory
- Mafia achieves numerical parity with town
- No investigative roles remain to expose them

### Neutral Victory
- Varies by specific neutral role
- Some need to survive to the end
- Others have specific elimination conditions

### Draw Conditions
- Game reaches maximum day limit (25 days)
- No deaths occur for 3 consecutive days (Peacemaker victory)

## Balance System

The game uses a power rating system to balance team composition:

### Power Ratings
- **Town roles**: Positive values (help town)
- **Mafia roles**: Negative values (help mafia)
- **Neutral roles**: Usually negative (work against town)

### Role Assignment Algorithm
1. Calculate comparative power as roles are assigned
2. When power favors town too much (>15), add mafia roles
3. When power favors mafia too much (<-15), add town roles
4. Use randomization within balanced ranges
5. Remove unique roles from pool after assignment

## Game Constants

All game timing, probabilities, and balance values are defined in `constants/gameConstants.ts` to ensure consistency and ease of modification.

### Key Probabilities
- **Whisper Overheard**: 10%
- **Judge Error Rate**: 30%
- **Role Success Rates**: Vary by role (often 50% for uncertain outcomes)

### Timing Values
- **Session Length Multiplier**: 4000ms × room size
- **Night Duration**: 15000ms (fixed)
- **Minimum Day Duration**: 10000ms

## Technical Implementation

### Role System
- Abstract base `Role` class with common functionality
- Each role extends the base class with specific abilities
- Roles are assigned via a factory pattern in `RoleHandler`

### Communication
- Real-time communication via WebSockets
- Message types for different game events
- Separate channels for public, private, and faction communication

### Game State Management
- Centralized room state tracks all game information
- Phase transitions handled automatically
- Win condition checking after each phase

## Contributing

When adding new roles or modifying game mechanics:

1. Update relevant constants in `gameConstants.ts`
2. Add comprehensive JSDoc documentation
3. Include role power ratings for balance
4. Test with various game scenarios
5. Update this documentation for new mechanics