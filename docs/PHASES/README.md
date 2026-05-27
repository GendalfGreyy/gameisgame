# Phases

Phase-by-phase implementation plan. Each phase is a separate Claude Code session — between phases run `/clear`, re-read the relevant `CLAUDE.md`, and skim `git log`.

| #   | Theme                                                                                          | Status |
| --- | ---------------------------------------------------------------------------------------------- | ------ |
| 0   | Bootstrap monorepo, tooling, docs scaffolding                                                  | ✅     |
| 1   | DB schema (Prisma + PostGIS) + migrations + seed                                               | ⏳     |
| 2   | Auth: Telegram `initData` → JWT                                                                | ⏳     |
| 3   | Events CRUD + nearby search + ranking                                                          | ⏳     |
| 4   | Check-in pipeline + fraud detection                                                            | ⏳     |
| 5   | Points ledger + leaderboards + streaks                                                         | ⏳     |
| 6   | Frontend Mini App MVP (onboarding, radar, feed, event, create, leaderboard, profile, settings) | ⏳     |
| 7   | Telegram bot + notification consumer                                                           | ⏳     |
| 8   | Telegram Stars payments (boosts)                                                               | ⏳     |
| 9   | Moderation + admin panel                                                                       | ⏳     |
| 10  | Privacy + security hardening                                                                   | ⏳     |
| 11  | Observability + production deploy                                                              | ⏳     |
| 12  | Beta soft launch                                                                               | ⏳     |

The full master prompt with phase-specific instructions lives outside the repo (in the user's notes). When starting a phase, paste only that phase's prompt — not the whole document.
