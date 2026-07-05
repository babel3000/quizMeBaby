<template>
  <div class="play-view">

    <!-- Waiting in lobby -->
    <div v-if="game.status === 'lobby'" class="page-center">
      <div class="card lobby-card">
        <div class="player-avatar">{{ initials }}</div>
        <h2 class="team-name">{{ player.nickname }}</h2>
        <span class="badge badge-success">{{ $t('lobby.joined') }}</span>
        <div class="room-info">
          {{ $t('lobby.room') }} <strong class="room-code">{{ game.code }}</strong>
        </div>
        <p class="waiting">{{ $t('lobby.waiting') }}</p>
        <div class="dots"><span /><span /><span /></div>
      </div>
    </div>

    <!-- Starting countdown -->
    <div v-else-if="game.status === 'starting'" class="fullscreen-center">
      <p class="get-ready">{{ $t('game.getReady') }}</p>
      <div class="countdown">{{ countdown }}</div>
    </div>

    <!-- Answer question -->
    <div v-else-if="game.status === 'question'" class="question-screen">

      <!-- Sticky top bar -->
      <div class="q-topbar">
        <span class="badge badge-primary">{{ $t('game.questionOf', { n: game.questionIndex + 1, total: game.totalQuestions }) }}</span>
        <span v-if="myStreak >= 2" class="streak-chip" :class="{ 'streak-hot': game.roundType === 'hot_streak' }">
          🔥 {{ $t('game.streakCount', { n: myStreak }) }}
        </span>
        <span v-if="myConsecutiveSkips > 0" class="skip-count-chip" :class="{ danger: myConsecutiveSkips >= 4 }">
          ↷ {{ $t('game.skipCount', { n: myConsecutiveSkips }) }}
        </span>
        <Timer :seconds="game.timeLimit" :key="game.questionIndex" class="q-timer" />
      </div>

      <!-- Answer area -->
      <div v-if="!game.myAnswer" class="answer-area">
        <h2 class="question-text">{{ game.currentQuestion?.text }}</h2>

        <!-- Multiple choice -->
        <div v-if="game.currentQuestion?.type === 'multiple_choice'" class="options-grid">
          <button
            v-for="(opt, i) in game.currentQuestion.options"
            :key="opt"
            class="option-btn"
            :class="`color-${i}`"
            @click="submitAnswer(opt)"
          >{{ opt }}</button>
        </div>

        <!-- Text answer -->
        <div v-else class="text-answer">
          <input
            v-model="textAnswer"
            type="text"
            placeholder="Type your answer…"
            @keyup.enter="submitAnswer(textAnswer)"
          />
          <button class="btn btn-primary btn-lg" @click="submitAnswer(textAnswer)" :disabled="!textAnswer.trim()">
            Submit
          </button>
        </div>

        <!-- Skip -->
        <button class="skip-btn" :class="{ 'skip-blocked': myConsecutiveSkips >= 4 }" :disabled="myConsecutiveSkips >= 4" @click="skipQuestion">
          <span v-if="myConsecutiveSkips >= 4" class="skip-label skip-must">{{ $t('game.skipMustAnswer') }}</span>
          <template v-else>
            <span class="skip-label">{{ $t('game.skip') }}</span>
            <span v-if="myConsecutiveSkips > 0" class="skip-detail skip-danger">
              {{ $t('game.skipPenaltyWarning', { mult: nextSkipPenaltyMult }) }}
            </span>
          </template>
        </button>
      </div>

      <!-- Post-answer feedback -->
      <div
        v-else
        class="feedback-screen"
        :class="game.myAnswer.skipped ? 'skipped' : game.myAnswer.isCorrect ? 'correct' : 'incorrect'"
      >
        <div class="feedback-icon">
          {{ game.myAnswer.skipped ? '↷' : game.myAnswer.isCorrect ? '✓' : '✗' }}
        </div>
        <p class="feedback-label">
          {{ game.myAnswer.skipped ? $t('game.skipped') : game.myAnswer.isCorrect ? $t('game.correct') : $t('game.wrong') }}
        </p>

        <!-- After skip: warn about pending penalty -->
        <p v-if="game.myAnswer.skipped && myConsecutiveSkips > 0" class="feedback-sub skip-danger-text">
          {{ $t('game.skipPenaltyActive', { n: myConsecutiveSkips, s: myConsecutiveSkips === 1 ? '' : 's', mult: nextSkipPenaltyMult }) }}
        </p>
        <p v-if="game.myAnswer.skipped && myConsecutiveSkips >= 4" class="feedback-sub skip-must-text">
          {{ $t('game.skipMustAnswer') }}
        </p>

        <!-- After answer / forced penalty -->
        <p v-if="game.myAnswer.forcedPenalty" class="feedback-sub skip-danger-text">
          {{ $t('game.skipForcedPenalty') }}
        </p>
        <p v-else-if="game.myAnswer.pointsAwarded > 0" class="feedback-pts">
          +{{ game.myAnswer.pointsAwarded.toLocaleString() }}
        </p>
        <p v-if="game.myAnswer.isCorrect && myStreak >= 2" class="feedback-streak">
          {{ $t('game.streakLabel', { n: myStreak }) }}
        </p>
        <p v-else-if="game.myAnswer.pointsAwarded < 0" class="feedback-pts penalty">
          {{ game.myAnswer.pointsAwarded.toLocaleString() }}
        </p>

        <div v-if="!game.myAnswer.isCorrect && !game.myAnswer.skipped && game.myAnswer.correctAnswer" class="correct-answer-reveal">
          <span class="ca-label">{{ $t('results.correctAnswer') }}</span>
          <span class="ca-value">{{ game.myAnswer.correctAnswer }}</span>
        </div>
        <p class="feedback-waiting">{{ $t('game.waitingForResults') }}</p>
      </div>
    </div>

    <!-- Results for this question -->
    <div v-else-if="game.status === 'results'" class="page-center">
      <div class="card results-card">
        <div class="results-answer">
          <span class="results-label">{{ $t('results.correctAnswer') }}</span>
          <span class="results-value">{{ game.lastResult?.correctAnswer }}</span>
        </div>
        <div class="my-result" :class="game.myAnswer?.skipped ? 'skipped' : game.myAnswer?.isCorrect ? 'correct' : 'incorrect'">
          <span>{{ game.myAnswer?.skipped ? $t('results.skipped') : game.myAnswer?.isCorrect ? $t('results.correct') : $t('results.wrong') }}</span>
          <span v-if="game.myAnswer?.pointsAwarded > 0">+{{ game.myAnswer.pointsAwarded.toLocaleString() }} {{ $t('results.pts') }}</span>
          <span v-else-if="game.myAnswer?.pointsAwarded < 0" class="penalty-text">{{ game.myAnswer.pointsAwarded.toLocaleString() }} {{ $t('results.pts') }}</span>
        </div>
        <Scoreboard :players="game.scoreboard" :highlight-id="player.id" :show-delta="true" />

        <div v-if="game.lastResult?.isLastQuestion" class="round-complete-notice">
          <p class="rc-title">{{ $t('results.roundComplete') }}</p>
          <p class="rc-sub">{{ $t('results.waitingForNextRound') }}</p>
        </div>
      </div>
    </div>

    <!-- Game over -->
    <div v-else-if="game.status === 'ended'" class="page-center">
      <div class="card end-card">
        <div class="logo">{{ $t('game.gameOver') }}</div>
        <Scoreboard :players="game.scoreboard" :highlight-id="player.id" :show-podium="true" />
        <RouterLink to="/home" class="btn btn-primary btn-lg end-btn">{{ $t('game.playAgain') }}</RouterLink>
      </div>
    </div>

    <!-- Scoreboard overlay (host-triggered) -->
    <ScoreTable
      :visible="game.scoreboardVisible"
      :scoreboard="game.scoreboard"
      :round-type="game.roundType"
      :is-host="false"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { setLocale } from '../i18n/index.js'
import { useGameStore } from '../stores/game.js'
import { usePlayerStore } from '../stores/player.js'
import { useSocket } from '../composables/useSocket.js'
import Timer from '../components/Timer.vue'
import Scoreboard from '../components/Scoreboard.vue'
import ScoreTable from '../components/ScoreTable.vue'

const { t } = useI18n()
const game = useGameStore()
const player = usePlayerStore()
const socket = useSocket()

const textAnswer = ref('')
const countdown = ref(3)
const myConsecutiveSkips = ref(0)
const myStreak = ref(0)

const initials = computed(() =>
  player.nickname.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
)

// Penalty multiplier if a wrong answer is given after current skip streak
const nextSkipPenaltyMult = computed(() => {
  const mult = 1 + 0.25 * myConsecutiveSkips.value
  return mult.toFixed(2).replace(/\.?0+$/, '')
})

const onGameStarted = ({ totalQuestions }) => {
  game.totalQuestions = totalQuestions
  game.setStatus('starting')
  let c = 3
  const t = setInterval(() => { c--; countdown.value = c; if (c <= 0) clearInterval(t) }, 1000)
}
const onQuestion = data => { textAnswer.value = ''; game.setQuestion(data) }
const onAnswerReceived = result => {
  game.setMyAnswer(result)
  player.addScore(result.pointsAwarded)
  myConsecutiveSkips.value = result.consecutiveSkips
  myStreak.value = result.correctStreak
}
const onSkipConfirmed = ({ consecutiveSkips }) => {
  myConsecutiveSkips.value = consecutiveSkips
  game.setMyAnswer({ skipped: true, isCorrect: false, pointsAwarded: 0, forcedPenalty: false })
}
const onResultsRevealed = data => game.setResults(data)
const onGameEnded = data => game.endGame(data)
const onPlayerJoined = ({ players }) => game.setPlayers(players)
const onPlayerLeft = ({ players }) => game.setPlayers(players)
const onShowScoreboard = ({ scoreboard, roundType }) => {
  game.scoreboard = scoreboard
  game.roundType = roundType
  game.scoreboardVisible = true
}
const onHideScoreboard = () => { game.scoreboardVisible = false }
const onRoundTypeChanged = ({ roundType }) => { game.roundType = roundType }
const onLanguageChanged = ({ language }) => { game.setLanguage(language); setLocale(language) }

onMounted(() => {
  socket.on('game_started', onGameStarted)
  socket.on('question', onQuestion)
  socket.on('answer_received', onAnswerReceived)
  socket.on('skip_confirmed', onSkipConfirmed)
  socket.on('results_revealed', onResultsRevealed)
  socket.on('game_ended', onGameEnded)
  socket.on('player_joined', onPlayerJoined)
  socket.on('player_left', onPlayerLeft)
  socket.on('show_scoreboard', onShowScoreboard)
  socket.on('hide_scoreboard', onHideScoreboard)
  socket.on('round_type_changed', onRoundTypeChanged)
  socket.on('language_changed', onLanguageChanged)
})

onUnmounted(() => {
  socket.off('game_started', onGameStarted)
  socket.off('question', onQuestion)
  socket.off('answer_received', onAnswerReceived)
  socket.off('skip_confirmed', onSkipConfirmed)
  socket.off('results_revealed', onResultsRevealed)
  socket.off('game_ended', onGameEnded)
  socket.off('player_joined', onPlayerJoined)
  socket.off('player_left', onPlayerLeft)
  socket.off('show_scoreboard', onShowScoreboard)
  socket.off('hide_scoreboard', onHideScoreboard)
  socket.off('round_type_changed', onRoundTypeChanged)
  socket.off('language_changed', onLanguageChanged)
})

function submitAnswer(answer) {
  if (!answer?.trim() || game.myAnswer) return
  socket.emit('submit_answer', { code: game.code, answer: answer.trim() })
}

function skipQuestion() {
  if (game.myAnswer) return
  socket.emit('skip_question', { code: game.code })
}
</script>

<style scoped>
.play-view { min-height: 100vh; }

/* ── Lobby ──────────────────────────────── */
.lobby-card { text-align: center; max-width: 400px; width: 100%; }
.player-avatar {
  width: 88px; height: 88px; border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  display: flex; align-items: center; justify-content: center;
  font-size: 2rem; font-weight: 900; margin: 0 auto 20px;
}
.team-name { font-size: 1.6rem; font-weight: 800; margin-bottom: 10px; }
.room-info { margin: 18px 0; color: var(--text-muted); font-size: 0.95rem; }
.room-code { color: var(--primary); letter-spacing: 3px; font-size: 1.1rem; }
.waiting { color: var(--text-muted); margin-top: 28px; font-size: 0.95rem; line-height: 1.5; }
.dots { display: flex; gap: 8px; justify-content: center; margin-top: 16px; }
.dots span {
  width: 9px; height: 9px; border-radius: 50%;
  background: var(--primary); animation: bounce 1.2s infinite;
}
.dots span:nth-child(2) { animation-delay: 0.2s; }
.dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }

/* ── Countdown ──────────────────────────── */
.fullscreen-center {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; min-height: 100dvh; gap: 16px;
}
.get-ready { font-size: 1.4rem; color: var(--text-muted); font-weight: 600; }
.countdown { font-size: 6rem; font-weight: 900; color: var(--primary); line-height: 1; }

/* ── Question screen ────────────────────── */
.question-screen {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  padding-top: var(--safe-top);
  padding-bottom: var(--safe-bottom);
}

.q-topbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 20px 12px;
  flex-shrink: 0;
}

.streak-chip {
  font-size: 0.78rem; font-weight: 700; color: #ff9f43;
  background: rgba(255,159,67,0.12); padding: 3px 10px; border-radius: 999px;
}
.streak-chip.streak-hot {
  color: #ff6b35; background: rgba(255,107,53,0.18);
  box-shadow: 0 0 0 1px rgba(255,107,53,0.3);
}
.skip-count-chip {
  font-size: 0.78rem; font-weight: 700; color: #ffc832;
  background: rgba(255,200,50,0.12); padding: 3px 10px; border-radius: 999px;
}
.skip-count-chip.danger {
  color: var(--danger); background: rgba(233,69,96,0.15);
}
.feedback-streak {
  font-size: 1rem; font-weight: 700; color: #ff9f43; margin-top: -4px;
}

.q-timer { margin-left: auto; }

.answer-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 8px 20px 20px;
  overflow-y: auto;
}

.question-text {
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1.4;
  margin-bottom: 24px;
  flex-shrink: 0;
}

/* ── Options grid ───────────────────────── */
.options-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  flex: 1;
  align-content: stretch;
  margin-bottom: 12px;
}

.option-btn {
  padding: 16px 12px;
  min-height: 80px;
  border-radius: var(--radius);
  font-size: 0.95rem;
  font-weight: 700;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.1s, filter 0.1s;
  border: none;
  line-height: 1.3;
  -webkit-tap-highlight-color: transparent;
}

.option-btn:active { transform: scale(0.96); filter: brightness(0.9); }

/* Colourful option tiles — Kahoot-style */
.option-btn.color-0 { background: #e84060; color: #fff; }
.option-btn.color-1 { background: #1368ce; color: #fff; }
.option-btn.color-2 { background: #d89e00; color: #fff; }
.option-btn.color-3 { background: #26890c; color: #fff; }

/* ── Text answer ────────────────────────── */
.text-answer { display: flex; flex-direction: column; gap: 12px; flex: 1; }

/* ── Skip button ────────────────────────── */
.skip-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  padding: 14px 16px;
  background: none;
  border: 2px dashed var(--surface-2);
  border-radius: var(--radius);
  color: var(--text-muted);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
  flex-shrink: 0;
  min-height: 54px;
  -webkit-tap-highlight-color: transparent;
}
.skip-btn:not(:disabled):hover,
.skip-btn:not(:disabled):active { border-color: #ffc832; color: #ffc832; }
.skip-btn.skip-blocked {
  border-color: var(--danger); color: var(--danger); opacity: 0.9; cursor: not-allowed;
}
.skip-label { font-size: 0.9rem; font-weight: 700; }
.skip-detail { font-size: 0.75rem; }
.skip-danger { color: var(--danger); }
.skip-must { font-size: 0.85rem; font-weight: 700; }

/* ── Post-answer feedback ───────────────── */
.feedback-screen {
  flex: 1;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 40px 24px;
  gap: 12px;
  min-height: 70dvh;
}
.feedback-screen.correct  { color: var(--success); }
.feedback-screen.incorrect { color: var(--danger); }
.feedback-screen.skipped  { color: #ffc832; }

.feedback-icon   { font-size: 5rem; line-height: 1; }
.feedback-label  { font-size: 2rem; font-weight: 900; }
.feedback-pts    { font-size: 2.6rem; font-weight: 900; color: var(--gold); }
.feedback-pts.penalty { color: var(--danger); }
.feedback-sub       { font-size: 1rem; font-weight: 600; }
.skip-danger-text   { color: var(--danger); }
.skip-must-text     { font-size: 0.95rem; font-weight: 700; color: var(--danger); }
.feedback-waiting { font-size: 0.9rem; color: var(--text-muted); margin-top: 8px; }

.correct-answer-reveal {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  background: rgba(44,182,125,0.1); border: 1px solid rgba(44,182,125,0.3);
  border-radius: var(--radius); padding: 12px 20px; margin-top: 4px;
}
.ca-label { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--success); }
.ca-value { font-size: 1.1rem; font-weight: 700; color: var(--text); }

/* ── Results ────────────────────────────── */
.results-card { max-width: 600px; width: 100%; }
.results-answer {
  display: flex; align-items: center; gap: 12px;
  margin-bottom: 16px;
}
.results-label {
  font-size: 0.75rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.08em; color: var(--text-muted); flex-shrink: 0;
}
.results-value { font-size: 1.1rem; font-weight: 700; color: var(--success); }
.my-result {
  display: flex; justify-content: space-between;
  padding: 14px 16px; border-radius: var(--radius); margin-bottom: 20px;
  font-weight: 700; font-size: 1rem;
}
.my-result.correct  { background: rgba(44,182,125,0.15); color: var(--success); }
.my-result.incorrect{ background: rgba(233,69,96,0.15);  color: var(--danger); }
.my-result.skipped  { background: rgba(255,200,50,0.1);  color: #ffc832; }
.penalty-text { color: var(--danger); }

/* ── Round complete notice ──────────────────── */
.round-complete-notice {
  text-align: center; padding: 20px 16px;
  background: rgba(233,69,96,0.08); border-radius: var(--radius);
  border: 1px solid rgba(233,69,96,0.2);
}
.rc-title { font-size: 1.2rem; font-weight: 800; color: var(--primary); margin-bottom: 6px; }
.rc-sub { font-size: 0.9rem; color: var(--text-muted); }

/* ── End screen ─────────────────────────── */
.end-card { max-width: 600px; width: 100%; }
.end-btn { width: 100%; margin-top: 24px; display: block; text-align: center; }

/* ── Mobile overrides ───────────────────── */
@media (max-width: 480px) {
  /* Lobby card fills screen */
  .lobby-card { max-width: 100%; }

  /* Bigger question text on mobile */
  .question-text { font-size: 1.25rem; }

  /* Options fill remaining space nicely */
  .options-grid { flex: 1; }
  .option-btn { min-height: 0; flex: 1; font-size: 0.9rem; }

  /* Results card full bleed */
  .results-card, .end-card { max-width: 100%; }
}
</style>
