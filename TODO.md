# PubQuiz — Project TODO

## In progress
_Nothing active right now._

## Done
- [x] Host question preview — host sees Q + answer before players; `begin_question` starts the timer
- [x] Scoring system rewrite (base + speed + first-answer bonus + wrong penalty)
- [x] Skip mechanic (skip button, 4-skip limit, multiplier tracking per team)
- [x] Round types: Normal / Hot Streak / Safety Net / Lone Wolf / Double Down
- [x] ScoreTable component (full-screen overlay, rank medals, delta, badges)
- [x] Host "Show Scoreboard" button + overlay triggered via socket
- [x] Round type selector on host results panel
- [x] Rename "players" → "teams" in lobby UI
- [x] ScoreTable overlay on ScreenView and PlayView (host-triggered)
- [x] Mobile-first design — full-screen layouts, Kahoot-style option tiles, safe-area insets, iOS zoom fix
- [x] "Team Name" label on join screen (renamed from "Your Nickname")

## Up next
- [ ] Streak tracking display refinement (show streak count on player screen)

## Done (recent)
- [x] Music round — Deezer search in question manager, host play/stop controls, 30s preview audio on player + screen views
- [x] Lone Wolf: notify first-correct team they won the round
- [x] Screen view: show active round type banner during question
- [x] Chaos round type (random scoring rule per question)
- [x] Screen auto-discovery at /screen (no room code needed)
- [x] Reconnect handling — team rejoins mid-game and keeps score
- [x] Answer times per team (with decimal) on results screens
- [x] Dramatic 3-2-1 countdown before revealing correct answer
- [x] Results only shown when everyone has answered
- [x] Host can customize next question time from results screen

## Backlog — features
- [ ] Music round: play two songs simultaneously (Web Audio API mixing)
- [ ] Music round: play a song in reverse (AudioBuffer channel reversal)
- [ ] Music round: play a song at 3× speed (AudioBufferSourceNode.playbackRate)
- [ ] YouTube integration — video round questions with embedded clip
- [ ] Question manager: bulk import via CSV
- [ ] Question manager: search/filter by keyword
- [ ] Question manager: preview media (audio/video) inside the form
- [ ] Host view: pick specific questions or categories before starting
- [ ] Animations between game states (question → results → next)
- [ ] Sound effects (countdown tick, correct/wrong answer, scoreboard reveal)
- [ ] Mobile polish for host view (lobby + game panel)

## Backlog — polish & UX
- [ ] ScoreTable: rank movement arrows (↑↓ vs previous round)
- [ ] Team avatar / colour picker on join screen
- [x] Reconnect handling — team rejoins mid-game and keeps score
- [ ] Host can kick a team from the lobby
- [ ] Configurable time limits and points per question from host UI

## Backlog — infrastructure
- [ ] Deploy frontend to Vercel
- [ ] Deploy backend to Railway or Render
- [ ] Environment config for production (CORS, socket URL)
- [ ] Supabase Row Level Security rules
- [ ] Game session persistence to DB (currently in-memory only)
