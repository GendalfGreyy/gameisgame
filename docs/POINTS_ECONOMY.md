# Points Economy

All point changes go through `PointsService.award` — never update `User.totalPoints` directly.

| Reason             | Amount | Trigger                                                        |
| ------------------ | ------ | -------------------------------------------------------------- |
| `check_in`         | 50     | Confirmed check-in (GPS dwell or QR)                           |
| `event_host`       | 100    | Host publishes a new event                                     |
| `streak_bonus`     | 25     | Weekly streak extended                                         |
| `invite_friend`    | 75     | New user signs up via inviter's `start_param` (`ref_<userId>`) |
| `boost_refund`     | varies | Admin/bot refund for failed boost (phase 8+)                   |
| `admin_adjustment` | varies | Manual admin correction                                        |

## Invite flow

1. Inviter copies link from **Profile → Пригласи друга** (`GET /auth/invite-link`).
2. Link encodes `startapp=ref_<inviterUserId>` (Mini App) or bot `/start ref_<id>`.
3. On first Telegram auth, API stores `referredById` and awards inviter once (idempotent ledger key).

## Leaderboard

`GET /leaderboard` — global ranking by `totalPoints`, includes caller's rank even if outside top N.
