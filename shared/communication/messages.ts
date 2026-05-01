/**
 * Structured game message system for localizable server → client notifications.
 *
 * Instead of emitting raw English strings, the server emits `GameMessage` objects
 * containing a key and optional interpolation params. Clients resolve these to
 * display strings using a locale dictionary, enabling easy localisation without
 * any server changes.
 *
 * Chat messages (ReceiveChatMessage / ReceiveWhisperMessage) carry player-authored
 * text and remain plain strings — only system notifications use this system.
 */

/** All keys for system-generated messages emitted via ServerEvent.ReceiveMessage. */
export enum MessageKey {
  // ── Generic ──────────────────────────────────────────────────────────────
  InvalidChoice = "invalid_choice",
  CannotSpeakAtNight = "cannot_speak_at_night",
  SilencedCannotTalk = "silenced_cannot_talk",
  NoDayAction = "no_day_action",
  NoNightAction = "no_night_action",
  NoNightVote = "no_night_vote",
  CancelledDayAction = "cancelled_day_action",
  CancelledNightAction = "cancelled_night_action",
  YouHaveDied = "you_have_died",
  /** params: playerName, roleName */
  PlayerHasDied = "player_has_died",
  AttackedButSurvived = "attacked_but_survived",
  CannotSpeakYouAreDead = "cannot_speak_you_are_dead",
  CannotSpeakDeadOrError = "cannot_speak_dead_or_error",
  YouWereRoleblocked = "you_were_roleblocked",
  RoleblockedCannotCommand = "roleblocked_cannot_command",

  // ── Room / Lobby ──────────────────────────────────────────────────────────
  /** params: playerName */
  PlayerJoinedRoom = "player_joined_room",
  RoomFullStartingGame = "room_full_starting_game",
  /** params: playerName */
  PlayerLeftRoom = "player_left_room",
  /** params: playerName */
  PlayerAbandonedGame = "player_abandoned_game",

  // ── Game flow ─────────────────────────────────────────────────────────────
  Day1Started = "day_1_started",
  Night1Started = "night_1_started",
  /** params: dayNumber */
  DayNStarted = "day_n_started",
  /** params: dayNumber */
  NightNStarted = "night_n_started",
  /** params: count */
  VotesRequired = "votes_required",
  /** params: voterName, targetName */
  VoteCastSingleVote = "vote_cast_single",
  /** params: voterName, targetName, count */
  VoteCastMultipleVotes = "vote_cast_multiple",
  /** params: playerName */
  PlayerVotedOutByTown = "player_voted_out",
  YouHaveBeenVotedOut = "you_have_been_voted_out",
  /** params: playerName */
  ConfeserVotedOut = "confeser_voted_out",
  DrawWarnOneDay = "draw_warn_one_day",
  GameEndedNobodyDied = "game_ended_nobody_died",
  CannotChangeVote = "cannot_change_vote",
  CannotVoteForYourself = "cannot_vote_yourself",
  CannotVoteAtNight = "cannot_vote_at_night",
  VotingDisabledConfeser = "voting_disabled_confeser",
  VoteInvalid = "vote_invalid",
  CannotWhisperAtNight = "cannot_whisper_at_night",
  WhispersOverheardBySender = "whispers_overheard",
  /** params: senderName, message, recipientName */
  WhisperOverheardBroadcast = "whisper_overheard_broadcast",
  InvalidWhisperRecipient = "invalid_whisper_recipient",

  // ── End game ──────────────────────────────────────────────────────────────
  GameEndedDraw = "game_ended_draw",
  NeutralPlayersWon = "neutral_players_won",
  /** params: factionName */
  FactionWon = "faction_won",
  ClosingRoom = "closing_room",
  PeacemakerWon = "peacemaker_won",
  FramerTargetVotedOut = "framer_target_voted_out",

  // ── Shared role actions (identical text across multiple roles) ────────────
  /** params: targetName — Bodyguard + Sacrificer */
  CannotProtectSelf = "cannot_protect_self",
  /** params: targetName — Bodyguard + Sacrificer */
  ChoseToProtect = "chose_to_protect",
  /** params: targetName — Roleblocker + MafiaRoleblocker + Peacemaker */
  CannotBlockSelf = "cannot_block_self",
  /** params: targetName — Roleblocker + MafiaRoleblocker + Peacemaker */
  ChoseToBlock = "chose_to_block",
  /** Investigator + MafiaInvestigator (Judge has a different self-inspect message) */
  CannotInspectSelf = "cannot_inspect_self",
  /** params: targetName — Investigator + MafiaInvestigator + Judge */
  ChoseToInspect = "chose_to_inspect",
  /** params: targetName — Lawman + Maniac */
  ChoseToAttack = "chose_to_attack",

  // ── Mafia ─────────────────────────────────────────────────────────────────
  /** params: playerName, targetName */
  MafiaVotedToAttack = "mafia_voted_to_attack",
  MafiaInvalidVote = "mafia_invalid_vote",
  MafiaChosenAttacker = "mafia_chosen_attacker",

  // ── MafiaSilencer ─────────────────────────────────────────────────────────
  CannotSilenceSelf = "cannot_silence_self",
  /** params: targetName */
  ChoseToSilence = "chose_to_silence",

  // ── Doctor ────────────────────────────────────────────────────────────────
  DoctorCannotHealSelf = "doctor_cannot_heal_self",
  /** params: targetName */
  DoctorChoseToHeal = "doctor_chose_to_heal",

  // ── Watchman ──────────────────────────────────────────────────────────────
  WatchmanCannotWatchSelf = "watchman_cannot_watch_self",
  /** params: targetName */
  WatchmanChoseToWatch = "watchman_chose_to_watch",
  WatchmanNobodyVisited = "watchman_nobody_visited",
  /** params: targetName */
  WatchmanTargetVisitedBy = "watchman_visited_by",
  /** params: name1, name2 */
  WatchmanTargetVisitedByTwo = "watchman_visited_by_two",
  /** params: list — server pre-formats the comma-separated list */
  WatchmanVisitorList = "watchman_visitor_list",

  // ── Judge ─────────────────────────────────────────────────────────────────
  JudgeCannotInspectSelf = "judge_cannot_inspect_self",
  /** params: targetName, factionName */
  JudgeAlignmentResult = "judge_alignment_result",

  // ── Investigator (Town) ───────────────────────────────────────────────────
  /** params: targetName, role1, role2, role3 */
  InvestigatorResult = "investigator_result",

  // ── MafiaInvestigator ─────────────────────────────────────────────────────
  /** params: targetName, roleName */
  MafiaInvestigatorResult = "mafia_investigator_result",

  // ── Lawman ────────────────────────────────────────────────────────────────
  LawmanInsane = "lawman_insane",
  LawmanInsaneShooting = "lawman_insane_shooting",
  LawmanShotTownMember = "lawman_shot_town",
  LawmanCannotShootSelf = "lawman_cannot_shoot_self",

  // ── Vetter ────────────────────────────────────────────────────────────────
  VetterNoSessions = "vetter_no_sessions",
  VetterDecidedToResearch = "vetter_decided_to_research",
  VetterDecidedNotToResearch = "vetter_decided_not_to_research",
  /** params: name1, name2, roleName */
  VetterResearchResult = "vetter_research_result",
  /** params: count */
  VetterSessionsLeft = "vetter_sessions_left",

  // ── Tracker ───────────────────────────────────────────────────────────────
  TrackerCannotTrackSelf = "tracker_cannot_track_self",
  /** params: targetName */
  TrackerChoseToTrack = "tracker_chose_to_track",
  /** params: targetName */
  TrackerTargetVisited = "tracker_target_visited",
  TrackerTargetDidNotVisit = "tracker_no_visit",

  // ── Sacrificer ────────────────────────────────────────────────────────────
  SacrificerDied = "sacrificer_died",
  TargetSavedBySacricer = "target_saved_by_sacrificer",
  /** params: playerName, roleName */
  AttackedByWithRole = "attacked_by_with_role",

  // ── Nimby ─────────────────────────────────────────────────────────────────
  NimbyNoAlerts = "nimby_no_alerts",
  NimbyDecidedAlert = "nimby_decided_alert",
  NimbyDecidedNotAlert = "nimby_decided_not_alert",

  // ── Fortifier ────────────────────────────────────────────────────────────
  FortifierCannotFortifySelf = "fortifier_cannot_fortify_self",
  /** params: targetName */
  FortifierChoseToFortify = "fortifier_chose_to_fortify",
  /** params: targetName */
  FortifierChoseToRemove = "fortifier_chose_to_remove",
  FortifierCannotRemoveDead = "fortifier_cannot_remove_dead",
  FortifierHouseFortified = "fortifier_house_fortified",
  FortifierDiedStripping = "fortifier_died_stripping",
  /** params: playerName */
  FortifierOwnerDiedStripping = "fortifier_owner_died_stripping",
  FortifierStrippedKilledOwner = "fortifier_stripped_killed_owner",
  FortifierTargetDied = "fortifier_target_died",

  // ── Tapper ────────────────────────────────────────────────────────────────
  CannotTapSelf = "cannot_tap_self",
  /** params: targetName */
  ChoseToTap = "chose_to_tap",
  YouHaveBeenWiretapped = "you_have_been_wiretapped",

  // ── Jailor ────────────────────────────────────────────────────────────────
  JailorCannotJailSelf = "jailor_cannot_jail_self",
  /** params: targetName */
  JailorChoseToJail = "jailor_chose_to_jail",
  JailorNoJailed = "jailor_no_jailed",
  JailorDecidedToExecute = "jailor_decided_to_execute",
  JailedWillBeExecuted = "jailed_will_be_executed",
  JailorDecidedNotToExecute = "jailor_decided_not_to_execute",
  JailedWillNotBeExecuted = "jailed_will_not_be_executed",
  YouHaveBeenJailed = "you_have_been_jailed",
  JailorJailedTarget = "jailor_jailed_target",

  // ── Sniper ────────────────────────────────────────────────────────────────
  SniperCannotSnipeSelf = "sniper_cannot_snipe_self",
  /** params: targetName */
  SniperChoseToSnipe = "sniper_chose_to_snipe",

  // ── Framer ────────────────────────────────────────────────────────────────
  /** params: targetName */
  FramerTarget = "framer_target",
  /** params: targetName */
  FramerNewTarget = "framer_new_target",

  // ── Maniac ────────────────────────────────────────────────────────────────
  ManiacCannotAttackSelf = "maniac_cannot_attack_self",
}

/**
 * Named interpolation slots available in message templates.
 * Templates use `{{paramName}}` syntax.
 */
export type MessageParams = {
  readonly playerName?: string;
  readonly targetName?: string;
  readonly roleName?: string;
  readonly voterName?: string;
  readonly count?: number;
  readonly dayNumber?: number;
  readonly list?: string;
  readonly role1?: string;
  readonly role2?: string;
  readonly role3?: string;
  readonly factionName?: string;
  readonly senderName?: string;
  readonly recipientName?: string;
  readonly message?: string;
  readonly name1?: string;
  readonly name2?: string;
};

/** A structured, localisable game notification message. */
export type GameMessage = {
  readonly key: MessageKey;
  readonly params?: MessageParams;
};

/** A complete translation dictionary mapping every message key to a template string. */
export type Translations = Record<MessageKey, string>;

/**
 * Resolves a `GameMessage` to a display string using the given translations.
 * Template placeholders use `{{paramName}}` syntax.
 */
export function translate(
  msg: GameMessage,
  translations: Translations,
): string {
  const template = translations[msg.key];
  if (!msg.params) return template;
  const params = msg.params;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = params[key as keyof MessageParams];
    return value !== undefined ? String(value) : "";
  });
}

/**
 * Creates a translator bound to a specific locale dictionary.
 *
 * @example
 * import { createTranslator } from "@mernmafia/shared/communication/messages.js";
 * import { en } from "@mernmafia/shared/communication/locales/en.js";
 * const t = createTranslator(en);
 * socket.on(ServerEvent.ReceiveMessage, (msg) => display(t(msg)));
 */
export function createTranslator(
  translations: Translations,
): (msg: GameMessage) => string {
  return (msg: GameMessage) => translate(msg, translations);
}
