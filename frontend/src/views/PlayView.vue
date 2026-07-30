<template>
  <div class="play-view">

    <!-- Reveal countdown overlay -->
    <Transition name="countdown">
      <div v-if="revealCountdown" class="reveal-overlay">
        <span class="reveal-number">{{ revealCountdown }}</span>
      </div>
    </Transition>

    <!-- Reconnecting overlay -->
    <div v-if="reconnecting" class="reconnect-overlay">
      <div class="reconnect-box">
        <div class="spinner" />
        <p>{{ $t('game.reconnecting') }}</p>
      </div>
    </div>

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
        <div class="lang-switcher">
          <button class="lang-btn" :class="{ active: displayedLang === 'en' }" @click="switchLang('en')">🇬🇧</button>
          <button class="lang-btn" :class="{ active: displayedLang === 'pt-PT' }" @click="switchLang('pt-PT')">🇵🇹</button>
        </div>
      </div>
    </div>

    <!-- Starting countdown -->
    <div v-else-if="game.status === 'starting'" class="fullscreen-center">
      <p class="get-ready">{{ $t('game.getReady') }}</p>
      <div class="countdown">{{ countdown }}</div>
    </div>

    <!-- Host is previewing the next question -->
    <div v-else-if="game.status === 'waiting'" class="fullscreen-center waiting-screen">
      <span class="badge badge-primary">{{ $t('game.questionOf', { n: game.questionIndex + 1, total: game.totalQuestions }) }}</span>
      <p class="get-ready">{{ $t('game.waitingForQuestion') }}</p>
      <p class="waiting-sub">{{ $t('game.waitingForQuestionSub') }}</p>
      <div class="dots"><span /><span /><span /></div>
    </div>

    <!-- Answer question -->
    <div v-else-if="game.status === 'question'" class="question-screen">

      <!-- Sticky top bar -->
      <div class="q-topbar">
        <span class="badge badge-primary">{{ $t('game.questionOf', { n: game.questionIndex + 1, total: game.totalQuestions }) }}</span>
        <span v-if="myStreak >= 2" class="streak-chip" :class="{ 'streak-hot': isHotStreakRound }">
          🔥 {{ $t('game.streakCount', { n: myStreak }) }}
          <span v-if="isHotStreakRound" class="streak-mult">×{{ streakMult }}</span>
        </span>
        <span v-if="myConsecutiveSkips > 0" class="skip-count-chip" :class="{ danger: myConsecutiveSkips >= 4 }">
          ↷ {{ $t('game.skipCount', { n: myConsecutiveSkips }) }}
        </span>
        <Timer :seconds="game.timeLimit" :key="game.questionIndex" class="q-timer" />
      </div>

      <div v-if="game.roundType === 'chaos' && game.questionModifier" class="chaos-mod-banner">
        {{ $t('roundTypes.chaosMod', { mod: $t(`roundTypes.${game.questionModifier}`) }) }}
      </div>

      <!-- Music player bar -->
      <div v-if="displayedQuestion?.type === 'music'" class="music-player-bar" :class="{ playing: musicPlaying }">
        <div class="music-note-icon">🎵</div>
        <div class="music-status">{{ musicPlaying ? $t('game.musicPlaying') : $t('game.musicWaiting') }}</div>
        <div v-if="musicPlaying" class="music-bars">
          <span /><span /><span /><span />
        </div>
      </div>

      <!-- Answer area -->
      <div v-if="!game.myAnswer" class="answer-area">
        <h2 class="question-text">{{ displayedQuestion?.text }}</h2>

        <!-- Multiple choice (also used for music questions) -->
        <div v-if="displayedQuestion?.type === 'multiple_choice' || displayedQuestion?.type === 'music'" class="options-grid">
          <button
            v-for="(opt, i) in displayedQuestion.options"
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
          <span v-if="isHotStreakRound" class="feedback-streak-mult">×{{ streakMult }}</span>
        </p>
        <p v-else-if="!game.myAnswer.isCorrect && !game.myAnswer.skipped && prevStreak >= 2" class="feedback-streak-broken">
          {{ $t('game.streakBroken', { n: prevStreak }) }}
        </p>
        <p v-else-if="game.myAnswer.pointsAwarded < 0" class="feedback-pts penalty">
          {{ game.myAnswer.pointsAwarded.toLocaleString() }}
        </p>

        <div v-if="!game.myAnswer.isCorrect && !game.myAnswer.skipped && game.myAnswer.correctAnswer" class="correct-answer-reveal">
          <span class="ca-label">{{ $t('results.correctAnswer') }}</span>
          <span class="ca-value">{{ translateAnswer(game.myAnswer.correctAnswer) }}</span>
        </div>
        <p class="feedback-waiting">{{ $t('game.waitingForResults') }}</p>
      </div>
    </div>

    <!-- Results for this question -->
    <div v-else-if="game.status === 'results'" class="page-center">
      <div class="card results-card">
        <div class="results-answer">
          <span class="results-label">{{ $t('results.correctAnswer') }}</span>
          <span class="results-value">{{ translateAnswer(game.lastResult?.correctAnswer) }}</span>
        </div>
        <div class="my-result" :class="game.myAnswer?.skipped ? 'skipped' : game.myAnswer?.isCorrect ? 'correct' : 'incorrect'">
          <span>{{ game.myAnswer?.skipped ? $t('results.skipped') : game.myAnswer?.isCorrect ? $t('results.correct') : $t('results.wrong') }}</span>
          <span v-if="game.myAnswer?.pointsAwarded > 0">+{{ game.myAnswer.pointsAwarded.toLocaleString() }} {{ $t('results.pts') }}</span>
          <span v-else-if="game.myAnswer?.pointsAwarded < 0" class="penalty-text">{{ game.myAnswer.pointsAwarded.toLocaleString() }} {{ $t('results.pts') }}</span>
        </div>
        <p v-if="myStreak >= 2" class="results-streak">
          🔥 {{ $t('game.streakLabel', { n: myStreak }) }}
          <span v-if="isHotStreakRound" class="results-streak-mult">×{{ streakMult }}</span>
        </p>
        <div v-if="isLoneWolfRound" class="lone-wolf-banner" :class="{ winner: isLoneWolfWinner }">
          {{ isLoneWolfWinner
            ? $t('roundTypes.loneWolfYouWon')
            : game.lastResult?.loneWolfWinner
              ? $t('roundTypes.loneWolfWon', { nickname: game.lastResult.loneWolfWinner.nickname })
              : $t('roundTypes.loneWolfNobody') }}
        </div>
        <Scoreboard :players="game.scoreboard" :highlight-id="player.id" :show-delta="true" />

        <div v-if="!game.lastResult?.isLastQuestion && game.moderationMode === 'players'" class="ready-next-card">
          <button class="btn btn-primary btn-lg" :disabled="game.isReadyForNext" @click="readyForNextQuestion">
            {{ game.isReadyForNext ? $t('results.readyMarked') : $t('results.readyForNext') }}
          </button>
          <p class="ready-progress">
            {{ $t('results.readyCount', { ready: game.readyForNext.readyCount, total: game.readyForNext.total }) }}
          </p>
        </div>

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
const prevStreak = ref(0)
const reconnecting = ref(false)
const revealCountdown = ref(null)

const initials = computed(() =>
  player.nickname.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
)

const isHotStreakRound = computed(() => {
  const effective = game.roundType === 'chaos' ? game.questionModifier : game.roundType
  return effective === 'hot_streak'
})
const isLoneWolfRound = computed(() => {
  const effective = game.roundType === 'chaos' ? game.questionModifier : game.roundType
  return effective === 'lone_wolf'
})
const streakMult = computed(() => {
  const m = 1 + 0.25 * Math.min(myStreak.value, 4)
  return Number.isInteger(m) ? m : m.toFixed(2)
})
const isLoneWolfWinner = computed(() =>
  game.lastResult?.loneWolfWinner?.id === player.id
)

const musicPlaying = ref(false)
let audioEl = null

function getAudio() {
  if (!audioEl) audioEl = new Audio()
  return audioEl
}

const onMusicPlay = () => {
  const url = game.currentQuestion?.media_url
  if (!url) return
  const audio = getAudio()
  audio.src = url
  audio.currentTime = 0
  audio.play().catch(() => {})
  musicPlaying.value = true
}

const onMusicStop = () => {
  if (audioEl) { audioEl.pause(); audioEl.currentTime = 0 }
  musicPlaying.value = false
}

// Per-player language preference — independent of room language
const displayedLang = computed(() => game.playerLanguage || game.language)

function applyLang(question, lang) {
  if (!question || lang === 'en') return question
  const tr = question.translations?.[lang]
  return tr ? { ...question, text: tr.text, options: tr.options } : question
}

const displayedQuestion = computed(() => applyLang(game.currentQuestion, displayedLang.value))

// Map a displayed (possibly translated) option back to the English answer the server validates
function submitAnswer(displayedOpt) {
  if (!displayedOpt?.trim() || game.myAnswer) return
  const q = game.currentQuestion
  const dispOpts = displayedQuestion.value?.options ?? q?.options ?? []
  const idx = dispOpts.indexOf(displayedOpt)
  const englishAnswer = idx >= 0 ? (q?.options[idx] ?? displayedOpt) : displayedOpt
  socket.emit('submit_answer', { code: game.code, answer: englishAnswer.trim() })
}

// Translate an English correct-answer string into the player's display language
function translateAnswer(englishAnswer) {
  if (!englishAnswer || displayedLang.value === 'en') return englishAnswer
  const q = game.currentQuestion
  if (!q) return englishAnswer
  const tr = q.translations?.[displayedLang.value]
  if (!tr) return englishAnswer
  const idx = q.options?.indexOf(englishAnswer) ?? -1
  return idx >= 0 ? (tr.options[idx] ?? englishAnswer) : englishAnswer
}

function switchLang(lang) {
  game.setPlayerLanguage(lang)
  setLocale(lang)
}

// Penalty multiplier if a wrong answer is given after current skip streak
const nextSkipPenaltyMult = computed(() => {
  const mult = 1 + 0.25 * myConsecutiveSkips.value
  return mult.toFixed(2).replace(/\.?0+$/, '')
})

let countdownTimer = null
const onPreparingReveal = ({ countdown }) => {
  revealCountdown.value = countdown
  countdownTimer = setInterval(() => {
    revealCountdown.value--
    if (revealCountdown.value <= 0) {
      clearInterval(countdownTimer)
      revealCountdown.value = null
    }
  }, 1000)
}

const onGameStarted = ({ totalQuestions, moderationMode }) => {
  game.totalQuestions = totalQuestions
  game.moderationMode = moderationMode ?? 'host'
  game.isReadyForNext = false
  game.readyForNext = { readyCount: 0, total: 0 }
  game.setStatus('starting')
  let c = 3
  const t = setInterval(() => { c--; countdown.value = c; if (c <= 0) clearInterval(t) }, 1000)
}
const onQuestionPending = ({ index, total, roundType }) => {
  game.questionIndex = index
  game.totalQuestions = total
  if (roundType) game.roundType = roundType
  game.isReadyForNext = false
  game.readyForNext = { readyCount: 0, total: 0 }
  game.currentQuestion = null
  game.myAnswer = null
  game.setStatus('waiting')
}
const onQuestion = data => {
  textAnswer.value = ''
  revealCountdown.value = null
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null }
  musicPlaying.value = false
  game.setQuestion(data)
}
const onAnswerReceived = result => {
  prevStreak.value = myStreak.value
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
const onReadyUpdate = status => {
  game.readyForNext = status
}
const onGameEnded = data => {
  game.endGame(data)
  localStorage.removeItem('reconnect')
}

function tryRejoin() {
  const saved = localStorage.getItem('reconnect')
  if (!saved) return
  const { code, playerId } = JSON.parse(saved)
  reconnecting.value = true
  socket.emit('rejoin_session', { code, playerId })
}

const onRejoined = ({ code: roomCode, player: me, status, question, questionIndex,
  totalQuestions, scoreboard, players, language, roundType, questionModifier,
  moderationMode, isReadyForNext, myAnswer, lastResult }) => {
  reconnecting.value = false
  player.setPlayer(me)
  game.setCode(roomCode)
  game.setPlayers(players)
  game.setLanguage(language ?? 'en')
  setLocale(language ?? 'en')
  game.roundType = roundType ?? 'normal'
  game.questionModifier = questionModifier ?? null
  game.moderationMode = moderationMode ?? 'host'
  game.isReadyForNext = isReadyForNext ?? false
  game.scoreboard = scoreboard ?? []
  game.totalQuestions = totalQuestions

  if (status === 'active' && question) {
    game.currentQuestion = question
    game.questionIndex = questionIndex
    game.timeLimit = question.time_limit ?? 30
    game.myAnswer = myAnswer ?? null
    game.setStatus('question')
  } else if (status === 'preview') {
    game.questionIndex = questionIndex
    game.setStatus('waiting')
  } else if (status === 'results' && lastResult) {
    game.currentQuestion = question
    game.questionIndex = questionIndex
    game.setResults(lastResult)
    game.isReadyForNext = isReadyForNext ?? false
    if (myAnswer) game.myAnswer = myAnswer
  } else {
    game.setStatus(status === 'lobby' ? 'lobby' : 'idle')
  }
}

const onRejoinError = ({ message }) => {
  reconnecting.value = false
  localStorage.removeItem('reconnect')
  console.warn('Rejoin failed:', message)
}

const onSocketConnect = () => {
  // Only rejoin if we lost state (page reload) or just reconnected mid-game
  if (game.status !== 'idle' || !localStorage.getItem('reconnect')) return
  tryRejoin()
}

const onSocketDisconnect = () => {
  if (game.status !== 'idle') reconnecting.value = true
}
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
  socket.on('question_pending', onQuestionPending)
  socket.on('question', onQuestion)
  socket.on('answer_received', onAnswerReceived)
  socket.on('skip_confirmed', onSkipConfirmed)
  socket.on('results_revealed', onResultsRevealed)
  socket.on('next_question_ready_update', onReadyUpdate)
  socket.on('game_ended', onGameEnded)
  socket.on('player_joined', onPlayerJoined)
  socket.on('player_left', onPlayerLeft)
  socket.on('show_scoreboard', onShowScoreboard)
  socket.on('hide_scoreboard', onHideScoreboard)
  socket.on('round_type_changed', onRoundTypeChanged)
  socket.on('language_changed', onLanguageChanged)
  socket.on('preparing_reveal', onPreparingReveal)
  socket.on('music_play', onMusicPlay)
  socket.on('music_stop', onMusicStop)
  socket.on('rejoined_session', onRejoined)
  socket.on('rejoin_error', onRejoinError)
  socket.on('connect', onSocketConnect)
  socket.on('disconnect', onSocketDisconnect)

  // Auto-rejoin on page reload if we have stored session data
  if (game.status === 'idle' && localStorage.getItem('reconnect')) tryRejoin()
})

onUnmounted(() => {
  socket.off('game_started', onGameStarted)
  socket.off('question_pending', onQuestionPending)
  socket.off('question', onQuestion)
  socket.off('answer_received', onAnswerReceived)
  socket.off('skip_confirmed', onSkipConfirmed)
  socket.off('results_revealed', onResultsRevealed)
  socket.off('next_question_ready_update', onReadyUpdate)
  socket.off('game_ended', onGameEnded)
  socket.off('player_joined', onPlayerJoined)
  socket.off('player_left', onPlayerLeft)
  socket.off('show_scoreboard', onShowScoreboard)
  socket.off('hide_scoreboard', onHideScoreboard)
  socket.off('round_type_changed', onRoundTypeChanged)
  socket.off('language_changed', onLanguageChanged)
  socket.off('preparing_reveal', onPreparingReveal)
  socket.off('music_play', onMusicPlay)
  socket.off('music_stop', onMusicStop)
  socket.off('rejoined_session', onRejoined)
  socket.off('rejoin_error', onRejoinError)
  socket.off('connect', onSocketConnect)
  socket.off('disconnect', onSocketDisconnect)
  onMusicStop()
})

function skipQuestion() {
  if (game.myAnswer) return
  socket.emit('skip_question', { code: game.code })
}

function readyForNextQuestion() {
  if (game.isReadyForNext || game.lastResult?.isLastQuestion) return
  game.isReadyForNext = true
  socket.emit('ready_for_next_question', { code: game.code })
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
.lang-switcher { display: flex; gap: 8px; justify-content: center; margin-top: 20px; }
.lang-btn {
  font-size: 1.4rem; padding: 6px 12px; border-radius: 999px;
  background: var(--surface-2); border: 2px solid transparent;
  cursor: pointer; transition: all 0.15s; opacity: 0.5;
}
.lang-btn.active { border-color: var(--primary); opacity: 1; }
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
.waiting-sub { font-size: 1rem; color: var(--text-muted); opacity: 0.85; margin: 0; }
.waiting-screen .badge { margin-bottom: 4px; }
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
.streak-mult {
  font-size: 0.85em; opacity: 0.85; margin-left: 4px;
}
.feedback-streak {
  font-size: 1rem; font-weight: 700; color: #ff9f43; margin-top: -4px;
}
.feedback-streak-mult {
  font-size: 0.85em; opacity: 0.8; margin-left: 4px;
}
.feedback-streak-broken {
  font-size: 0.9rem; font-weight: 600; color: var(--text-muted); margin-top: -4px;
}
.results-streak {
  font-size: 0.95rem; font-weight: 700; color: #ff9f43;
  text-align: center; margin: 4px 0 8px;
}
.results-streak-mult {
  font-size: 0.85em; opacity: 0.8; margin-left: 4px;
}
.ready-next-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 8px 0 14px;
}
.ready-progress {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-muted);
  text-align: center;
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

.lone-wolf-banner {
  text-align: center; padding: 12px 16px; border-radius: var(--radius);
  font-size: 1rem; font-weight: 700;
  background: rgba(99,102,241,0.1); color: var(--text-muted);
  border: 1px solid rgba(99,102,241,0.2);
}
.lone-wolf-banner.winner {
  background: rgba(250,204,21,0.15); color: #eab308;
  border-color: rgba(250,204,21,0.35);
}

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

.reveal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 900;
  pointer-events: none;
}
.reveal-number {
  font-size: 10rem;
  font-weight: 900;
  color: #fff;
  line-height: 1;
  text-shadow: 0 0 60px var(--primary);
}
.countdown-enter-active, .countdown-leave-active { transition: opacity 0.3s, transform 0.3s; }
.countdown-enter-from, .countdown-leave-to { opacity: 0; transform: scale(1.5); }

.reconnect-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}
.reconnect-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: var(--text);
  font-size: 1.1rem;
  font-weight: 600;
}
.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255,255,255,0.15);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.chaos-mod-banner {
  text-align: center;
  font-size: 0.85rem;
  font-weight: 700;
  padding: 8px 16px;
  border-radius: 8px;
  background: rgba(99,102,241,0.15);
  color: #a5b4fc;
  margin-bottom: 12px;
}

.music-player-bar {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 18px; border-radius: 12px; margin-bottom: 12px;
  background: rgba(30,215,96,0.08); border: 1px solid rgba(30,215,96,0.2);
  color: var(--text-muted);
}
.music-player-bar.playing { color: #1ed760; border-color: rgba(30,215,96,0.4); background: rgba(30,215,96,0.12); }
.music-note-icon { font-size: 1.4rem; flex-shrink: 0; }
.music-status { flex: 1; font-weight: 600; font-size: 0.9rem; }
.music-bars { display: flex; align-items: flex-end; gap: 3px; height: 20px; }
.music-bars span {
  width: 4px; border-radius: 2px; background: #1ed760;
  animation: music-bar 0.8s ease-in-out infinite alternate;
}
.music-bars span:nth-child(1) { animation-delay: 0s; }
.music-bars span:nth-child(2) { animation-delay: 0.15s; }
.music-bars span:nth-child(3) { animation-delay: 0.3s; }
.music-bars span:nth-child(4) { animation-delay: 0.45s; }
@keyframes music-bar {
  from { height: 4px; }
  to   { height: 18px; }
}
</style>
