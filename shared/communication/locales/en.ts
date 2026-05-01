import { MessageKey } from "../messages";
import type { Translations } from "../messages";

/**
 * English locale translations for all game messages.
 * Template placeholders use `{{paramName}}` syntax.
 * Add a new locale by creating a similar `Record<MessageKey, string>` and
 * passing it to `createTranslator(yourLocale)` — no server changes required.
 */
export const en: Translations = {
  // ── Generic ────────────────────────────────────────────────────────────────
  [MessageKey.InvalidChoice]: "Invalid choice.",
  [MessageKey.CannotSpeakAtNight]: "You cannot speak at night.",
  [MessageKey.SilencedCannotTalk]: "You have been silenced and cannot talk.",
  [MessageKey.NoDayAction]: "Your class has no daytime action.",
  [MessageKey.NoNightAction]: "Your class has no nighttime action.",
  [MessageKey.NoNightVote]: "Your class has no nighttime factional voting.",
  [MessageKey.CancelledDayAction]:
    "You have cancelled your class' daytime action.",
  [MessageKey.CancelledNightAction]:
    "You have cancelled your class' nighttime action.",
  [MessageKey.YouHaveDied]: "You have died!",
  [MessageKey.PlayerHasDied]:
    "{{playerName}} has died. Their role was {{roleName}}.",
  [MessageKey.AttackedButSurvived]: "You were attacked, but you survived!",
  [MessageKey.CannotSpeakYouAreDead]: "You cannot speak, as you are dead.",
  [MessageKey.CannotSpeakDeadOrError]:
    "You cannot speak, as you are dead. Or an error occured.",
  [MessageKey.YouWereRoleblocked]: "You were roleblocked!",
  [MessageKey.RoleblockedCannotCommand]:
    "You are roleblocked, and cannot call commands.",

  // ── Room / Lobby ───────────────────────────────────────────────────────────
  [MessageKey.PlayerJoinedRoom]: "{{playerName}} has joined the room!",
  [MessageKey.RoomFullStartingGame]: "The room is full! Starting the game!",
  [MessageKey.PlayerLeftRoom]: "{{playerName}} has left the room!",
  [MessageKey.PlayerAbandonedGame]: "{{playerName}} has abandoned the game!",

  // ── Game flow ──────────────────────────────────────────────────────────────
  [MessageKey.Day1Started]: "Day 1 has started.",
  [MessageKey.Night1Started]: "Night 1 has started.",
  [MessageKey.DayNStarted]: "Day {{dayNumber}} has started.",
  [MessageKey.NightNStarted]: "Night {{dayNumber}} has started.",
  [MessageKey.VotesRequired]:
    "It takes {{count}} votes for the town to kill a player.",
  [MessageKey.VoteCastSingleVote]:
    "{{voterName}} has voted for {{targetName}} to be executed! There is 1 vote for {{targetName}} to be killed.",
  [MessageKey.VoteCastMultipleVotes]:
    "{{voterName}} has voted for {{targetName}} to be executed! There are {{count}} votes for {{targetName}} to be killed.",
  [MessageKey.PlayerVotedOutByTown]:
    "{{playerName}} has been voted out by the town.",
  [MessageKey.YouHaveBeenVotedOut]: "You have been voted out of the town.",
  [MessageKey.ConfeserVotedOut]:
    "{{playerName}} was a confesser! Voting has been disabled for the remainder of the game.",
  [MessageKey.DrawWarnOneDay]:
    "The game will end in a draw if nobody dies today or tonight.",
  [MessageKey.GameEndedNobodyDied]:
    "Nobody has died in three consecutive days, so the game has ended.",
  [MessageKey.CannotChangeVote]: "You cannot change your vote.",
  [MessageKey.CannotVoteForYourself]: "You cannot vote for yourself.",
  [MessageKey.CannotVoteAtNight]: "You cannot vote at night.",
  [MessageKey.VotingDisabledConfeser]:
    "The town voted out a confessor, disabling voting.",
  [MessageKey.VoteInvalid]: "Your vote was invalid.",
  [MessageKey.CannotWhisperAtNight]: "You cannot whisper at night.",
  [MessageKey.WhispersOverheardBySender]:
    "Your whispers were overheard by the town!",
  [MessageKey.WhisperOverheardBroadcast]:
    '{{senderName}} tried to whisper "{{message}}" to {{recipientName}}, but was overheard by the town!',
  [MessageKey.InvalidWhisperRecipient]:
    "You didn't whisper to a valid recipient, or they are dead.",

  // ── End game ───────────────────────────────────────────────────────────────
  [MessageKey.GameEndedDraw]: "The game has ended with a draw!",
  [MessageKey.NeutralPlayersWon]: "The neutral players have won!",
  [MessageKey.FactionWon]: "The {{factionName}} won!",
  [MessageKey.ClosingRoom]: "Closing the room!",
  [MessageKey.PeacemakerWon]: "You have won the game by causing a tie!",
  [MessageKey.FramerTargetVotedOut]:
    "You have successfully gotten your target voted out!",

  // ── Shared role actions ───────────────────────────────────────────────────
  [MessageKey.CannotProtectSelf]: "You cannot protect yourself.",
  [MessageKey.ChoseToProtect]: "You have chosen to protect {{targetName}}.",
  [MessageKey.CannotBlockSelf]: "You cannot block yourself.",
  [MessageKey.ChoseToBlock]: "You have chosen to block {{targetName}}.",
  [MessageKey.CannotInspectSelf]: "You cannot inspect yourself.",
  [MessageKey.ChoseToInspect]: "You have chosen to inspect {{targetName}}.",
  [MessageKey.ChoseToAttack]: "You have chosen to attack {{targetName}}.",

  // ── Mafia ──────────────────────────────────────────────────────────────────
  [MessageKey.MafiaVotedToAttack]:
    "{{playerName}} has voted to attack {{targetName}}.",
  [MessageKey.MafiaInvalidVote]: "Invalid Vote.",
  [MessageKey.MafiaChosenAttacker]:
    "You have been chosen to do the mafia's dirty work.",

  // ── MafiaSilencer ──────────────────────────────────────────────────────────
  [MessageKey.CannotSilenceSelf]: "You cannot silence yourself.",
  [MessageKey.ChoseToSilence]: "You have chosen to silence {{targetName}}.",

  // ── Doctor ─────────────────────────────────────────────────────────────────
  [MessageKey.DoctorCannotHealSelf]: "You cannot heal yourself.",
  [MessageKey.DoctorChoseToHeal]: "You have chosen to heal {{targetName}}.",

  // ── Watchman ───────────────────────────────────────────────────────────────
  [MessageKey.WatchmanCannotWatchSelf]: "You cannot watch yourself.",
  [MessageKey.WatchmanChoseToWatch]: "You have chosen to watch {{targetName}}.",
  [MessageKey.WatchmanNobodyVisited]: "Nobody visited your target.",
  [MessageKey.WatchmanTargetVisitedBy]:
    "Your target was visited by {{targetName}}.",
  [MessageKey.WatchmanTargetVisitedByTwo]:
    "Your target was visited by {{name1}} or {{name2}}.",
  [MessageKey.WatchmanVisitorList]: "The list of visitors is: {{list}}.",

  // ── Judge ──────────────────────────────────────────────────────────────────
  [MessageKey.JudgeCannotInspectSelf]: "You cannot inspect your own alignment.",
  [MessageKey.JudgeAlignmentResult]:
    "{{targetName}}'s alignment is for the {{factionName}} faction.",

  // ── Investigator (Town) ────────────────────────────────────────────────────
  [MessageKey.InvestigatorResult]:
    "{{targetName}}'s role might be {{role1}}, {{role2}}, or {{role3}}.",

  // ── MafiaInvestigator ──────────────────────────────────────────────────────
  [MessageKey.MafiaInvestigatorResult]:
    "{{targetName}}'s role is {{roleName}}.",

  // ── Lawman ─────────────────────────────────────────────────────────────────
  [MessageKey.LawmanInsane]:
    "You have gone insane, and have no control over who you shoot.",
  [MessageKey.LawmanInsaneShooting]:
    "You have gone insane, and are shooting someone randomly!",
  [MessageKey.LawmanShotTownMember]:
    "You just shot a member of the town, and have been driven insane by the guilt!",
  [MessageKey.LawmanCannotShootSelf]: "You cannot shoot yourself.",

  // ── Vetter ─────────────────────────────────────────────────────────────────
  [MessageKey.VetterNoSessions]: "You have no research sessions left!",
  [MessageKey.VetterDecidedToResearch]:
    "You have decided to stay home and research into people's history.",
  [MessageKey.VetterDecidedNotToResearch]:
    "You have decided not to research into people's history.",
  [MessageKey.VetterResearchResult]:
    "You researched into {{name1}} and {{name2}}, finding that at least one of them is a {{roleName}}.",
  [MessageKey.VetterSessionsLeft]: "You have {{count}} research sessions left.",

  // ── Tracker ────────────────────────────────────────────────────────────────
  [MessageKey.TrackerCannotTrackSelf]: "You cannot track yourself.",
  [MessageKey.TrackerChoseToTrack]: "You have chosen to track {{targetName}}.",
  [MessageKey.TrackerTargetVisited]: "Your target visited {{targetName}}.",
  [MessageKey.TrackerTargetDidNotVisit]: "Your target didn't visit anyone.",

  // ── Sacrificer ─────────────────────────────────────────────────────────────
  [MessageKey.SacrificerDied]: "You have died protecting your target.",
  [MessageKey.TargetSavedBySacricer]:
    "You were attacked, but were saved by a sacrificer!",
  [MessageKey.AttackedByWithRole]:
    "You were attacked by {{playerName}}, whose role is: {{roleName}}.",

  // ── Nimby ──────────────────────────────────────────────────────────────────
  [MessageKey.NimbyNoAlerts]: "You have no alerts left!",
  [MessageKey.NimbyDecidedAlert]: "You have decided to go on alert.",
  [MessageKey.NimbyDecidedNotAlert]: "You have decided not to go on alert.",

  // ── Fortifier ──────────────────────────────────────────────────────────────
  [MessageKey.FortifierCannotFortifySelf]: "You cannot fortify your own house.",
  [MessageKey.FortifierChoseToFortify]:
    "You have chosen to fortify {{targetName}}'s house.",
  [MessageKey.FortifierChoseToRemove]:
    "You have chosen to try and remove {{targetName}}'s fortifications.",
  [MessageKey.FortifierCannotRemoveDead]:
    "You cannot remove the fortifications from a dead player's house.",
  [MessageKey.FortifierHouseFortified]: "Your house has been fortified!",
  [MessageKey.FortifierDiedStripping]:
    "You died stripping the house of your fortifications.",
  [MessageKey.FortifierOwnerDiedStripping]:
    "{{playerName}} died stripping your house of its fortifications.",
  [MessageKey.FortifierStrippedKilledOwner]:
    "You stripped the house of its fortifications, and killed the owner.",
  [MessageKey.FortifierTargetDied]:
    "You died trying to stop your house from being stripped of its fortifications.",

  // ── Tapper ─────────────────────────────────────────────────────────────────
  [MessageKey.CannotTapSelf]: "You cannot tap yourself.",
  [MessageKey.ChoseToTap]: "You have chosen to tap {{targetName}}.",
  [MessageKey.YouHaveBeenWiretapped]:
    "You have been wiretapped! Any message you send can be heard by a tapper.",

  // ── Jailor ─────────────────────────────────────────────────────────────────
  [MessageKey.JailorCannotJailSelf]: "You cannot jail yourself.",
  [MessageKey.JailorChoseToJail]: "You have chosen to jail {{targetName}}.",
  [MessageKey.JailorNoJailed]:
    "You haven't jailed anyone, so you cannot do anything.",
  [MessageKey.JailorDecidedToExecute]:
    "You have decided to execute the prisoner.",
  [MessageKey.JailedWillBeExecuted]: "The jailor has decided to execute you.",
  [MessageKey.JailorDecidedNotToExecute]:
    "You have decided not to execute the prisoner.",
  [MessageKey.JailedWillNotBeExecuted]:
    "The jailor has decided not to execute you.",
  [MessageKey.YouHaveBeenJailed]: "You have been jailed!",
  [MessageKey.JailorJailedTarget]: "You have jailed your target.",

  // ── Sniper ─────────────────────────────────────────────────────────────────
  [MessageKey.SniperCannotSnipeSelf]: "You cannot snipe yourself.",
  [MessageKey.SniperChoseToSnipe]: "You have chosen to snipe {{targetName}}.",

  // ── Framer ─────────────────────────────────────────────────────────────────
  [MessageKey.FramerTarget]:
    "Your target is {{targetName}}. You will win the game if you get them voted out. If your target dies before day 5, they will be replaced.",
  [MessageKey.FramerNewTarget]:
    "Your new target is {{targetName}}. You will win the game if you get them voted out. If your target dies before day 5, they will be replaced.",

  // ── Maniac ─────────────────────────────────────────────────────────────────
  [MessageKey.ManiacCannotAttackSelf]: "You cannot attack yourself.",
};
