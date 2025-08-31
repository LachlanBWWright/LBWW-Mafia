import { describe, it, expect, beforeEach } from 'vitest'

/**
 * Unit tests for individual role mechanics and special interactions
 */
describe('Role Mechanics and Interactions', () => {
  
  // Base role class for testing
  class TestRole {
    name: string
    group: 'town' | 'mafia' | 'neutral'
    damage: number = 0
    defence: number = 0
    baseDefence: number = 0
    
    // Ability flags
    dayVisitSelf: boolean = false
    dayVisitOthers: boolean = false
    nightVisitSelf: boolean = false
    nightVisitOthers: boolean = false
    nightVote: boolean = false
    
    // State tracking
    visiting: TestRole | null = null
    visitors: TestRole[] = []
    roleblocked: boolean = false
    isAlive: boolean = true

    constructor(name: string, group: 'town' | 'mafia' | 'neutral') {
      this.name = name
      this.group = group
    }
  }

  // Specific role implementations
  class Doctor extends TestRole {
    constructor() {
      super('Doctor', 'town')
      this.nightVisitOthers = true
      this.defence = 0
    }
    
    heal(target: TestRole): void {
      if (this.nightVisitOthers && !this.roleblocked) {
        target.defence = 1 // Basic defense
        this.visiting = target
        target.visitors.push(this)
      }
    }
  }

  class Mafia extends TestRole {
    constructor() {
      super('Mafia', 'mafia')
      this.nightVote = true
      this.damage = 1
    }
    
    attack(target: TestRole): boolean {
      if (!this.roleblocked && target.isAlive) {
        this.visiting = target
        target.visitors.push(this)
        
        // Attack succeeds if damage > defense
        if (this.damage > target.defence) {
          target.isAlive = false
          return true
        }
      }
      return false
    }
  }

  class Investigator extends TestRole {
    investigationResults: string[] = []
    
    constructor() {
      super('Investigator', 'town')
      this.nightVisitOthers = true
    }
    
    investigate(target: TestRole): string {
      if (this.nightVisitOthers && !this.roleblocked) {
        this.visiting = target
        target.visitors.push(this)
        
        // Simple investigation result
        const result = `${target.name} is a member of ${target.group}`
        this.investigationResults.push(result)
        return result
      }
      return 'Investigation failed'
    }
  }

  class Bodyguard extends TestRole {
    constructor() {
      super('Bodyguard', 'town')
      this.nightVisitOthers = true
      this.damage = 1
    }
    
    protect(target: TestRole): void {
      if (this.nightVisitOthers && !this.roleblocked) {
        this.visiting = target
        target.visitors.push(this)
        target.defence = Math.max(target.defence, 1)
      }
    }
    
    counterAttack(attackers: TestRole[]): void {
      // Bodyguard kills attackers when protecting
      attackers.forEach(attacker => {
        if (attacker !== this && this.damage > attacker.defence) {
          attacker.isAlive = false
        }
      })
    }
  }

  class Maniac extends TestRole {
    constructor() {
      super('Maniac', 'neutral')
      this.nightVisitOthers = true
      this.damage = 1
    }
    
    kill(target: TestRole): boolean {
      if (this.nightVisitOthers && !this.roleblocked) {
        this.visiting = target
        target.visitors.push(this)
        
        if (this.damage > target.defence && target.isAlive) {
          target.isAlive = false
          return true
        }
      }
      return false
    }
  }

  class Roleblocker extends TestRole {
    constructor() {
      super('Roleblocker', 'town')
      this.nightVisitOthers = true
    }
    
    roleblock(target: TestRole): void {
      if (this.nightVisitOthers && !this.roleblocked) {
        this.visiting = target
        target.visitors.push(this)
        target.roleblocked = true
      }
    }
  }

  describe('Basic Role Properties', () => {
    it('should create roles with correct basic properties', () => {
      const doctor = new Doctor()
      const mafia = new Mafia()
      const investigator = new Investigator()
      
      expect(doctor.name).toBe('Doctor')
      expect(doctor.group).toBe('town')
      expect(doctor.nightVisitOthers).toBe(true)
      
      expect(mafia.name).toBe('Mafia')
      expect(mafia.group).toBe('mafia')
      expect(mafia.nightVote).toBe(true)
      expect(mafia.damage).toBe(1)
      
      expect(investigator.name).toBe('Investigator')
      expect(investigator.group).toBe('town')
      expect(investigator.nightVisitOthers).toBe(true)
    })

    it('should initialize roles as alive', () => {
      const roles = [
        new Doctor(),
        new Mafia(),
        new Investigator(),
        new Bodyguard(),
        new Maniac(),
        new Roleblocker()
      ]
      
      roles.forEach(role => {
        expect(role.isAlive).toBe(true)
        expect(role.roleblocked).toBe(false)
        expect(role.visitors).toEqual([])
        expect(role.visiting).toBeNull()
      })
    })
  })

  describe('Doctor Mechanics', () => {
    it('should heal target and grant defense', () => {
      const doctor = new Doctor()
      const target = new TestRole('Civilian', 'town')
      
      expect(target.defence).toBe(0)
      
      doctor.heal(target)
      
      expect(target.defence).toBe(1)
      expect(doctor.visiting).toBe(target)
      expect(target.visitors).toContain(doctor)
    })

    it('should not heal when roleblocked', () => {
      const doctor = new Doctor()
      const target = new TestRole('Civilian', 'town')
      
      doctor.roleblocked = true
      doctor.heal(target)
      
      expect(target.defence).toBe(0)
      expect(doctor.visiting).toBeNull()
    })
  })

  describe('Mafia Attack Mechanics', () => {
    it('should successfully attack undefended target', () => {
      const mafia = new Mafia()
      const target = new TestRole('Civilian', 'town')
      
      expect(target.isAlive).toBe(true)
      
      const success = mafia.attack(target)
      
      expect(success).toBe(true)
      expect(target.isAlive).toBe(false)
      expect(mafia.visiting).toBe(target)
      expect(target.visitors).toContain(mafia)
    })

    it('should fail to attack defended target', () => {
      const mafia = new Mafia()
      const target = new TestRole('Civilian', 'town')
      target.defence = 1 // Basic defense
      
      const success = mafia.attack(target)
      
      expect(success).toBe(false)
      expect(target.isAlive).toBe(true)
      expect(mafia.visiting).toBe(target) // Still visits
    })

    it('should not attack when roleblocked', () => {
      const mafia = new Mafia()
      const target = new TestRole('Civilian', 'town')
      
      mafia.roleblocked = true
      const success = mafia.attack(target)
      
      expect(success).toBe(false)
      expect(target.isAlive).toBe(true)
      expect(mafia.visiting).toBeNull()
    })
  })

  describe('Investigator Mechanics', () => {
    it('should investigate target and get results', () => {
      const investigator = new Investigator()
      const target = new Mafia()
      
      const result = investigator.investigate(target)
      
      expect(result).toBe('Mafia is a member of mafia')
      expect(investigator.investigationResults).toContain(result)
      expect(investigator.visiting).toBe(target)
      expect(target.visitors).toContain(investigator)
    })

    it('should fail to investigate when roleblocked', () => {
      const investigator = new Investigator()
      const target = new Mafia()
      
      investigator.roleblocked = true
      const result = investigator.investigate(target)
      
      expect(result).toBe('Investigation failed')
      expect(investigator.investigationResults).not.toContain('Mafia is a member of mafia')
      expect(investigator.visiting).toBeNull()
    })

    it('should track multiple investigation results', () => {
      const investigator = new Investigator()
      const target1 = new Mafia()
      const target2 = new Doctor()
      
      investigator.investigate(target1)
      investigator.roleblocked = false // Reset for second investigation
      investigator.investigate(target2)
      
      expect(investigator.investigationResults).toHaveLength(2)
      expect(investigator.investigationResults[0]).toContain('mafia')
      expect(investigator.investigationResults[1]).toContain('town')
    })
  })

  describe('Bodyguard Mechanics', () => {
    it('should protect target and provide defense', () => {
      const bodyguard = new Bodyguard()
      const target = new TestRole('Civilian', 'town')
      
      bodyguard.protect(target)
      
      expect(target.defence).toBe(1)
      expect(bodyguard.visiting).toBe(target)
      expect(target.visitors).toContain(bodyguard)
    })

    it('should kill attackers when protecting', () => {
      const bodyguard = new Bodyguard()
      const target = new TestRole('Civilian', 'town')
      const attacker1 = new Mafia()
      const attacker2 = new Maniac()
      
      bodyguard.protect(target)
      
      // Simulate attackers visiting the protected target
      const attackers = [attacker1, attacker2]
      bodyguard.counterAttack(attackers)
      
      expect(attacker1.isAlive).toBe(false)
      expect(attacker2.isAlive).toBe(false)
      expect(bodyguard.isAlive).toBe(true) // Bodyguard survives
    })

    it('should not counterattack itself', () => {
      const bodyguard = new Bodyguard()
      const target = new TestRole('Civilian', 'town')
      const attacker = new Mafia()
      
      bodyguard.protect(target)
      
      // Include bodyguard in attackers list (shouldn't kill itself)
      const attackers = [bodyguard, attacker]
      bodyguard.counterAttack(attackers)
      
      expect(bodyguard.isAlive).toBe(true)
      expect(attacker.isAlive).toBe(false)
    })
  })

  describe('Neutral Role Mechanics', () => {
    it('should allow maniac to kill anyone', () => {
      const maniac = new Maniac()
      const townTarget = new Doctor()
      const mafiaTarget = new Mafia()
      
      const killTown = maniac.kill(townTarget)
      expect(killTown).toBe(true)
      expect(townTarget.isAlive).toBe(false)
      
      // Reset maniac state for second kill
      maniac.roleblocked = false
      const killMafia = maniac.kill(mafiaTarget)
      expect(killMafia).toBe(true)
      expect(mafiaTarget.isAlive).toBe(false)
    })

    it('should prevent maniac from killing when roleblocked', () => {
      const maniac = new Maniac()
      const target = new TestRole('Civilian', 'town')
      
      maniac.roleblocked = true
      const success = maniac.kill(target)
      
      expect(success).toBe(false)
      expect(target.isAlive).toBe(true)
      expect(maniac.visiting).toBeNull()
    })
  })

  describe('Roleblocker Mechanics', () => {
    it('should roleblock target successfully', () => {
      const roleblocker = new Roleblocker()
      const target = new Doctor()
      
      expect(target.roleblocked).toBe(false)
      
      roleblocker.roleblock(target)
      
      expect(target.roleblocked).toBe(true)
      expect(roleblocker.visiting).toBe(target)
      expect(target.visitors).toContain(roleblocker)
    })

    it('should prevent roleblocked players from using abilities', () => {
      const roleblocker = new Roleblocker()
      const doctor = new Doctor()
      const target = new TestRole('Civilian', 'town')
      
      // Roleblock the doctor
      roleblocker.roleblock(doctor)
      
      // Doctor should fail to heal
      doctor.heal(target)
      expect(target.defence).toBe(0)
      expect(doctor.visiting).toBeNull()
    })

    it('should not roleblock when roleblocked itself', () => {
      const roleblocker = new Roleblocker()
      const target = new Doctor()
      
      roleblocker.roleblocked = true
      roleblocker.roleblock(target)
      
      expect(target.roleblocked).toBe(false)
      expect(roleblocker.visiting).toBeNull()
    })
  })

  describe('Complex Role Interactions', () => {
    it('should handle doctor vs mafia interaction', () => {
      const doctor = new Doctor()
      const mafia = new Mafia()
      const target = new TestRole('Civilian', 'town')
      
      // Doctor heals target
      doctor.heal(target)
      expect(target.defence).toBe(1)
      
      // Mafia attacks same target
      const success = mafia.attack(target)
      
      // Attack should fail due to defense
      expect(success).toBe(false)
      expect(target.isAlive).toBe(true)
      expect(target.visitors).toContain(doctor)
      expect(target.visitors).toContain(mafia)
    })

    it('should handle investigator finding mafia', () => {
      const investigator = new Investigator()
      const mafia = new Mafia()
      
      const result = investigator.investigate(mafia)
      
      expect(result).toContain('mafia')
      expect(investigator.investigationResults).toHaveLength(1)
    })

    it('should handle bodyguard vs multiple attackers', () => {
      const bodyguard = new Bodyguard()
      const target = new TestRole('Civilian', 'town')
      const mafia = new Mafia()
      const maniac = new Maniac()
      
      // Bodyguard protects target
      bodyguard.protect(target)
      
      // Multiple attackers
      const attackers = [mafia, maniac]
      bodyguard.counterAttack(attackers)
      
      expect(mafia.isAlive).toBe(false)
      expect(maniac.isAlive).toBe(false)
      expect(bodyguard.isAlive).toBe(true)
      expect(target.defence).toBe(1) // Still protected
    })

    it('should handle roleblocker disrupting abilities', () => {
      const roleblocker = new Roleblocker()
      const doctor = new Doctor()
      const mafia = new Mafia()
      const target = new TestRole('Civilian', 'town')
      
      // Roleblock doctor
      roleblocker.roleblock(doctor)
      
      // Doctor tries to heal (should fail)
      doctor.heal(target)
      expect(target.defence).toBe(0)
      
      // Mafia attacks (should succeed)
      const success = mafia.attack(target)
      expect(success).toBe(true)
      expect(target.isAlive).toBe(false)
    })
  })

  describe('Advanced Scenarios', () => {
    it('should handle multi-night game progression', () => {
      const doctor = new Doctor()
      const mafia = new Mafia()
      const investigator = new Investigator()
      const target1 = new TestRole('Civilian1', 'town')
      const target2 = new TestRole('Civilian2', 'town')
      
      // Night 1: Doctor heals target1, Mafia attacks target1, Investigator checks Mafia
      doctor.heal(target1)
      mafia.attack(target1) // Should fail due to doctor
      investigator.investigate(mafia)
      
      expect(target1.isAlive).toBe(true)
      expect(investigator.investigationResults).toHaveLength(1)
      expect(investigator.investigationResults[0]).toContain('mafia')
      
      // Reset for Night 2
      target1.defence = 0
      target1.visitors = []
      target2.visitors = []
      doctor.visiting = null
      mafia.visiting = null
      investigator.visiting = null
      doctor.roleblocked = false
      mafia.roleblocked = false
      investigator.roleblocked = false
      
      // Night 2: Doctor heals target2, Mafia attacks target1 (undefended)
      doctor.heal(target2)
      mafia.attack(target1) // Should succeed now
      
      expect(target1.isAlive).toBe(false)
      expect(target2.isAlive).toBe(true)
      expect(target2.defence).toBe(1)
    })

    it('should handle role conflicts and priorities', () => {
      const doctor = new Doctor()
      const bodyguard = new Bodyguard()
      const mafia = new Mafia()
      const target = new TestRole('VIP', 'town')
      
      // Both doctor and bodyguard protect same target
      doctor.heal(target)
      bodyguard.protect(target)
      
      // Target should have maximum defense
      expect(target.defence).toBe(1)
      expect(target.visitors).toContain(doctor)
      expect(target.visitors).toContain(bodyguard)
      
      // Mafia attacks
      const attackers = [mafia]
      mafia.attack(target) // Should fail
      bodyguard.counterAttack(attackers) // Bodyguard kills mafia
      
      expect(target.isAlive).toBe(true)
      expect(mafia.isAlive).toBe(false)
    })

    it('should handle edge case with no targets', () => {
      const doctor = new Doctor()
      const investigator = new Investigator()
      
      // Abilities should handle null targets gracefully
      expect(() => {
        doctor.heal(doctor) // Self-target
        investigator.investigate(investigator) // Self-investigate
      }).not.toThrow()
    })
  })

  describe('Game Balance Validation', () => {
    it('should ensure roles have balanced power levels', () => {
      const townRoles = [new Doctor(), new Investigator(), new Bodyguard(), new Roleblocker()]
      const mafiaRoles = [new Mafia()]
      const neutralRoles = [new Maniac()]
      
      // Town roles should generally have utility without direct killing power
      townRoles.forEach(role => {
        if (role.name !== 'Bodyguard') { // Bodyguard can kill in defense
          expect(role.damage).toBeLessThanOrEqual(1)
        }
        expect(role.group).toBe('town')
      })
      
      // Mafia roles should have killing power
      mafiaRoles.forEach(role => {
        expect(role.damage).toBeGreaterThan(0)
        expect(role.group).toBe('mafia')
      })
      
      // Neutral roles should have independent win conditions
      neutralRoles.forEach(role => {
        expect(role.group).toBe('neutral')
      })
    })

    it('should validate role ability flags are consistent', () => {
      const roles = [
        new Doctor(),
        new Mafia(),
        new Investigator(),
        new Bodyguard(),
        new Maniac(),
        new Roleblocker()
      ]
      
      roles.forEach(role => {
        // Night visit roles should have appropriate abilities
        if (role.nightVisitOthers) {
          expect(role.name).toMatch(/Doctor|Investigator|Bodyguard|Maniac|Roleblocker/)
        }
        
        // Mafia should have night vote
        if (role.group === 'mafia') {
          expect(role.nightVote).toBe(true)
        }
        
        // All roles should have defined damage and defense
        expect(typeof role.damage).toBe('number')
        expect(typeof role.defence).toBe('number')
        expect(role.damage).toBeGreaterThanOrEqual(0)
        expect(role.defence).toBeGreaterThanOrEqual(0)
      })
    })
  })
})