# Privacy

## Modes (`User.privacyMode`)

| Mode                    | Discovery queries                                           | Social presence                                      |
| ----------------------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| `precise`               | Exact coordinates sent to API                               | Friends see you're on an event (check-in context)    |
| `approximate` (default) | Coordinates snapped to ~5 km grid                           | Friends see obfuscated presence                      |
| `hidden`                | Coordinates still used for nearby search (server-side only) | Hidden from friend notifications & presence surfaces |

## Data minimization

- **Live location** is not stored in Postgres beyond active check-in records.
- **Check-in coordinates** are stored for fraud pipeline; not exposed to other users in API responses.
- **Heat radar** aggregates events into grid cells — never individual user pins.

## User controls

Mini App → **Profile → Настройки** → `PATCH /users/me/settings`.

## Implementation

- Web: `obfuscateCoordinates()` in `@game-is-game/shared` before nearby API calls.
- API: `VisibilityService` gates friend push notifications for `hidden` users.

## GDPR / export (beta+)

Account deletion sets `deletedAt`; ledger retained for audit. Full export endpoint planned pre-GA.
