# Voice and account XP architecture

## Voice

Channel voice uses LiveKit as the media authority and `voice_states` as a short-lived application-side presence projection. LiveKit webhooks update joins, leaves and published media, while the client sends a heartbeat every 45 seconds. Presence responses reconcile the projection against LiveKit and expire stale rows.

Screen share is intentionally opt-in for viewers: microphone and camera tracks subscribe automatically, but `ScreenShare` and `ScreenShareAudio` subscribe only after the viewer selects **Смотреть стрим**. When a screen-share track is unpublished, the focused stream closes and the participant grid recalculates.

Direct calls use `direct_call_sessions` for a 40-second ringing lifecycle (`ringing → accepted/declined/cancelled/missed/ended`). The incoming endpoint is polled every 2 seconds only while the tab is visible. This replaces dependence on the slower general notification poll.

## Personal XP

`user_progress` is the single account-progress row per user:

- `user_id` — primary key and cascading FK to `users`;
- `total_xp` — non-negative accumulated account XP;
- `level` — always derived from `levelFromXp(total_xp)`, capped at 100;
- `xp_updated_at`, `last_level_up_at` — ordering and presentation timestamps.

`xp_events` is the append-only ledger. New awards must go through `awardXp()` / `awardXpInTransaction()` in `lib/xp.ts`. The uniqueness key is `(user_id, source, dedupe_key)`; retries with the same logical event therefore do not award twice.

Voice XP remains 3 XP per confirmed minute. Its key is `voice:{userId}:{channelId}:{minuteBucket}`, so two tabs/devices cannot double-award the same confirmed minute.

Clan XP (`contributionXp` and clan progression) remains separate from account XP. Leaving a clan does not change `user_progress`.

## Production rollout for XP migration 0030

Do **not** run `drizzle/0030_user_progress_ledger.sql` automatically from a deployment build.

1. Take a database backup/snapshot and record the restore point.
2. Run `pnpm xp:audit` against the target database. Save the JSON report.
3. Review duplicate events, orphan rows, negative values and level mismatches.
4. Run `pnpm xp:reconcile` without `--apply`. This is dry-run only.
5. During a maintenance window run `pnpm xp:reconcile -- --apply`.
6. Run `pnpm xp:audit` again. Confirm:
   - one `user_progress` row per user;
   - no level mismatch with the formula;
   - no negative XP;
   - no orphan progress/events;
   - ledger totals match progress totals.
7. Smoke-test two different accounts in profile/popover/ranking APIs to confirm XP isolation.
8. Keep the backup until production metrics and logs are stable.

The application keeps legacy `users.global_xp/global_level` mirrored during the rollout window for old readers. New account-XP writes are guarded so they flow through `lib/xp.ts`.

## Later: WebSocket gateway + Redis

A future external gateway (not Vercel Functions) can remove polling without changing the media plane:

- keep LiveKit for WebRTC media;
- publish LiveKit webhooks and application chat events into Redis Streams/PubSub;
- run a long-lived WebSocket gateway that subscribes to Redis and fans out `voice.presence`, `call.ringing`, `chat.message`, typing and notification events;
- authenticate socket sessions with short-lived signed app tokens and authorize subscriptions server-side;
- retain REST endpoints as snapshot/recovery paths and for mutations;
- use monotonically increasing event IDs so reconnecting clients can resume or request a fresh snapshot after a gap;
- shard Redis channels by space/conversation/user, not by global broadcast.

This is intentionally not implemented in the current change set.
