export const townRoles = [
  {
    name: "Doctor",
    faction: "town",
    category: "Town Protective",
    summary: "Protect a player from attacks.",
    description:
      "You can choose a person to heal every night, protecting them from attacks. At night, visit a player to heal them.",
  },
  {
    name: "Judge",
    faction: "town",
    category: "Town Investigative",
    summary: "Investigate alignments with uncertainty.",
    description:
      "You can visit a player each night to check for their factional alignment. However, there is a 30% chance that you'll be told the alignment of a random player instead. At night, visit a player to inspect them.",
  },
  {
    name: "Watchman",
    faction: "town",
    category: "Town Investigative",
    summary: "See visitors to your target.",
    description:
      "Choose a player to watch, and see who visits them. If only one person visits, your guess has a 50% chance of being a random player. At night, visit who you want to watch.",
  },
  {
    name: "Investigator",
    faction: "town",
    category: "Town Investigative",
    summary: "Inspect faction clues at night.",
    description:
      "You can visit a player each night to check make three guesses as to their role. Each guess has a 30% chance of being correct, otherwise it will be the role of a random player. At night, visit a player to inspect them.",
  },
  {
    name: "Lawman",
    faction: "town",
    category: "Town Support",
    summary: "Coordinate with Lawman faction members.",
    description:
      "You can choose a person to shoot every night. If you shoot a town member, you will go insane, and shoot a living player at random every night - including yourself! At night, visit a player to shoot them.",
  },
  {
    name: "Vetter",
    faction: "town",
    category: "Town Investigative",
    summary: "Vet two players to compare identities.",
    description:
      "You can research into people's history. Three times a game, you can visit yourself to stay home and research into two random players, dead or alive. Then, you will uncover a role that at least one of them has. At night, visit yourself to stay home and research.",
  },
  {
    name: "Tapper",
    faction: "town",
    category: "Town Support",
    summary: "Tap players to expose whispers/actions.",
    description:
      "At night, you can select a player to overhear their whispers the following day. At day, you can do the same to overhear any messages they send, but they will be warned. At day and night, visit who to tap during the next period.",
  },
  {
    name: "Tracker",
    faction: "town",
    category: "Town Investigative",
    summary: "Track who a target visits.",
    description:
      "Choose a player to track, and see who they visit. At night, visit who you want to track.",
  },
  {
    name: "Bodyguard",
    faction: "town",
    category: "Town Protective",
    summary: "Guard a player and counter attackers.",
    description:
      "You can choose a person to protect every night. You will protect them, and kill everybody who visited them. Excluding yourself. At night, visit a player to protect them.",
  },
  {
    name: "Nimby",
    faction: "town",
    category: "Town Utility",
    summary: "Punish hostile visits to your target area.",
    description:
      "Development in your neighbour's backyard was bad enough, but now your own property is under threat! Three times per game, you can go on alert and murder any visitors, defending yourself! At night, visit yourself to go on alert.",
  },
  {
    name: "Sacrificer",
    faction: "town",
    category: "Town Protective",
    summary: "Absorb damage for allies.",
    description:
      "You can choose a person to protect every night. You will protect them, but will sacrifice yourself if they were attacked. The protected player will witness the names and roles of everybody who attacked them. At night, visit who want to protect.",
  },
  {
    name: "Fortifier",
    faction: "town",
    category: "Town Protective",
    summary: "Increase a target's defense.",
    description:
      "Once per game, you can choose to fortify someone's house. They will survive most attacks, and if you're alive, you can kill the attackers. If you regret your decision, you can try to take their defences down, but a brawl will ensue, killing one of you at random. At night, visit a player to fortify their defences. Visit them again to try and remove their defences.",
  },
  {
    name: "Roleblocker",
    faction: "town",
    category: "Town Support",
    summary: "Prevent a player from acting.",
    description:
      "Every night, you are able to select a person, and stop them from performing their action. If they're not a member of the town, you have a 50% chance of success. At night, visit who you want to roleblock.",
  },
  {
    name: "Jailor",
    faction: "town",
    category: "Town Control",
    summary: "Jail and execute key suspects.",
    description:
      "At day, you can choose to jail a player, blocking their abilities. You can then interrogate them, and choose to execute them. At day and night, visit a player to jail them, and visit yourself at night to execute who you have jailed.",
  },
];

export const mafiaRoles = [
  {
    name: "Mafia",
    faction: "mafia",
    category: "Mafia Killing",
    summary: "Perform faction attacks at night.",
    description:
      "You are a member of the mafia. Vote for who you want your group to kill at night.",
  },
  {
    name: "Mafia Roleblocker",
    faction: "mafia",
    category: "Mafia Support",
    summary: "Roleblock priority targets.",
    description:
      "A Mafia role with roleblocker abilities. Can block a player's action during the night phase, preventing them from using their night ability.",
  },
  {
    name: "Mafia Investigator",
    faction: "mafia",
    category: "Mafia Investigative",
    summary: "Discover threat roles.",
    description:
      "A Mafia role with investigation abilities. Can inspect other players to reveal their role during the night phase instead of attacking.",
  },
];

export const neutralRoles = [
  {
    name: "Maniac",
    faction: "neutral",
    category: "Neutral Killing",
    summary: "Eliminate players for solo victory.",
    description:
      "You are maniac, and wish to kill everybody. Visit who you wish to kill at night.",
  },
  {
    name: "Sniper",
    faction: "neutral",
    category: "Neutral Killing",
    summary: "Take precision shots with constraints.",
    description:
      "You are a sniper, who wishes to snipe everybody else. Visit who you wish to snipe, and if they stay home, you can unleash a powerful attack. If they don't, visiting them two days in a row will guarantee a kill, but with a less powerful attack.",
  },
  {
    name: "Framer",
    faction: "neutral",
    category: "Neutral Evil",
    summary: "Manipulate voting outcomes around targets.",
    description:
      "You are assigned a random member of the town, who you must get voted out. If they die at night, they will be replaced until day 6.",
  },
  {
    name: "Confesser",
    faction: "neutral",
    category: "Neutral Chaos",
    summary: "Win by being voted out.",
    description:
      "Your goal is to make a mockery of the judicial system by being voted out for a crime you didn't commit. If successful, you will win, and votes will be disabled for the rest of the game.",
  },
  {
    name: "Peacemaker",
    faction: "neutral",
    category: "Neutral Benign",
    summary: "Force a draw by prolonged peace.",
    description:
      "Your goal is to create peace by causing a tie, as a result of nobody dying for three consecutive days. Every night, you are able to select a person, and stop them from performing their action.",
  },
];

export const allRoles = [...townRoles, ...mafiaRoles, ...neutralRoles];

export const roleSections = [
  { title: "Town", faction: "town", roles: townRoles },
  { title: "Mafia", faction: "mafia", roles: mafiaRoles },
  { title: "Neutral", faction: "neutral", roles: neutralRoles },
];

export const roleFactionsByName = new Map(
  [...townRoles, ...mafiaRoles].map((role) => [role.name, role.faction]),
);
