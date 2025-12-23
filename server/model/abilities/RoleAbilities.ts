import type { Player } from "../player/player.js";
import type { Role } from "../roles/abstractRole.js";

/**
 * Context for role abilities
 */
export interface RoleContext {
  role: Role;
  target: Player | null;
  night: boolean;
}

/**
 * Passive trait interface for role modifiers
 */
export interface PassiveTrait {
  /**
   * Apply the trait effect
   */
  apply(context: RoleContext): void;

  /**
   * Get trait name/description
   */
  getName(): string;

  /**
   * Get priority (higher = applied first)
   */
  getPriority(): number;
}

/**
 * Base interface for role abilities using composition
 */
export interface RoleAbility {
  /**
   * Check if the ability can be used in the current context
   */
  canUse(context: RoleContext): boolean;

  /**
   * Use the ability on a target
   */
  use(target: Player, context: RoleContext): void;

  /**
   * Get the priority of this ability (higher = executed first)
   */
  getPriority(): number;

  /**
   * Get the ability name/description
   */
  getName(): string;
}

/**
 * Heal ability - protects a target from attacks
 */
export class HealAbility implements RoleAbility {
  private healPower: number;

  constructor(healPower = 1) {
    this.healPower = healPower;
  }

  getPriority(): number {
    return 50; // Medium priority
  }

  getName(): string {
    return "Heal";
  }

  canUse(context: RoleContext): boolean {
    return context.night && context.target !== null;
  }

  use(target: Player, _context: RoleContext): void {
    if (target.role) {
      target.role.defence += this.healPower;
    }
  }
}

/**
 * Attack ability - deals damage to a target
 */
export class AttackAbility implements RoleAbility {
  private attackPower: number;

  constructor(attackPower = 1) {
    this.attackPower = attackPower;
  }

  getPriority(): number {
    return 40; // Medium-low priority
  }

  getName(): string {
    return "Attack";
  }

  canUse(context: RoleContext): boolean {
    return context.night && context.target !== null;
  }

  use(target: Player, context: RoleContext): void {
    if (target.role) {
      target.role.damage = Math.max(target.role.damage, this.attackPower);
      target.role.attackers.push(context.role);
    }
  }
}

/**
 * Roleblock ability - prevents a target from using their abilities
 */
export class RoleblockAbility implements RoleAbility {
  getPriority(): number {
    return 100; // High priority - should execute first
  }

  getName(): string {
    return "Roleblock";
  }

  canUse(context: RoleContext): boolean {
    return context.night && context.target !== null;
  }

  use(target: Player, context: RoleContext): void {
    if (target.role) {
      target.role.roleblocked = true;
      context.role.roleblocking = target.role;
    }
  }
}

/**
 * Investigate ability - reveals information about a target
 */
export class InvestigateAbility implements RoleAbility {
  private investigationType: "role" | "faction" | "alignment";

  constructor(type: "role" | "faction" | "alignment" = "alignment") {
    this.investigationType = type;
  }

  getPriority(): number {
    return 30; // Lower priority
  }

  getName(): string {
    return "Investigate";
  }

  canUse(context: RoleContext): boolean {
    return context.night && context.target !== null;
  }

  use(_target: Player, _context: RoleContext): void {
    // Investigation logic would send information to the investigator
    // This is a placeholder for the actual implementation

    switch (this.investigationType) {
      case "role":
        // info = `${target.playerUsername} is a ${target.role.name}`;
        break;
      case "faction":
        // info = `${target.playerUsername} is in the ${target.role.group} faction`;
        break;
      case "alignment":
        // info = `${target.playerUsername} appears to be ${target.role.group}`;
        break;
    }

    // Would send this info to the investigator via socketHandler
    // context.role.room.socketHandler.sendPlayerMessage(...)
  }
}

/**
 * Protect ability - grants temporary immunity
 */
export class ProtectAbility implements RoleAbility {
  private protectionLevel: number;

  constructor(protectionLevel = 2) {
    this.protectionLevel = protectionLevel;
  }

  getPriority(): number {
    return 60; // Higher than heal
  }

  getName(): string {
    return "Protect";
  }

  canUse(context: RoleContext): boolean {
    return context.night && context.target !== null;
  }

  use(target: Player, _context: RoleContext): void {
    if (target.role) {
      target.role.defence = Math.max(target.role.defence, this.protectionLevel);
    }
  }
}

/**
 * Passive trait: Bulletproof - permanent defence boost
 */
export class BulletproofTrait implements PassiveTrait {
  private defenceBonus: number;

  constructor(defenceBonus = 1) {
    this.defenceBonus = defenceBonus;
  }

  getPriority(): number {
    return 100;
  }

  getName(): string {
    return "Bulletproof";
  }

  apply(context: RoleContext): void {
    if (context.role) {
      context.role.baseDefence += this.defenceBonus;
      context.role.defence += this.defenceBonus;
    }
  }
}

/**
 * Passive trait: Powerful - increased attack power
 */
export class PowerfulTrait implements PassiveTrait {
  getPriority(): number {
    return 90;
  }

  getName(): string {
    return "Powerful";
  }

  apply(_context: RoleContext): void {
    // This would modify attack abilities to deal more damage
    // Implementation depends on how abilities are composed
  }
}

/**
 * Role ability manager for composition-based roles
 */
export class RoleAbilityManager {
  private abilities: RoleAbility[] = [];
  private passiveTraits: PassiveTrait[] = [];

  /**
   * Add an ability to the role
   */
  addAbility(ability: RoleAbility): void {
    this.abilities.push(ability);
    this.abilities.sort((a, b) => b.getPriority() - a.getPriority());
  }

  /**
   * Add a passive trait to the role
   */
  addTrait(trait: PassiveTrait): void {
    this.passiveTraits.push(trait);
    this.passiveTraits.sort((a, b) => b.getPriority() - a.getPriority());
  }

  /**
   * Execute all abilities on a target
   */
  executeAbilities(target: Player, context: RoleContext): void {
    for (const ability of this.abilities) {
      if (ability.canUse(context)) {
        ability.use(target, context);
      }
    }
  }

  /**
   * Apply all passive traits
   */
  applyTraits(context: RoleContext): void {
    for (const trait of this.passiveTraits) {
      trait.apply(context);
    }
  }

  /**
   * Get all abilities
   */
  getAbilities(): readonly RoleAbility[] {
    return [...this.abilities];
  }

  /**
   * Get all traits
   */
  getTraits(): readonly PassiveTrait[] {
    return [...this.passiveTraits];
  }

  /**
   * Remove an ability
   */
  removeAbility(ability: RoleAbility): void {
    const index = this.abilities.indexOf(ability);
    if (index > -1) {
      this.abilities.splice(index, 1);
    }
  }

  /**
   * Remove a trait
   */
  removeTrait(trait: PassiveTrait): void {
    const index = this.passiveTraits.indexOf(trait);
    if (index > -1) {
      this.passiveTraits.splice(index, 1);
    }
  }

  /**
   * Clear all abilities and traits
   */
  clear(): void {
    this.abilities = [];
    this.passiveTraits = [];
  }
}
