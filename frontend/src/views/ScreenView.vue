<template>
  <div class="screen-view">
    <div class="screen-header">
      <div class="logo">PubQuiz</div>
      <span class="room-code">{{ code }}</span>
    </div>

    <!-- Waiting for game -->
    <div v-if="game.status === 'lobby'" class="screen-lobby">
      <h1>{{ $t('screen.joinAt') }} <span class="join-url">{{ joinUrl }}</span></h1>
      <div class="big-code">{{ code }}</div>
      <PlayerList :players="game.players.filter(p => !p.isHost)" :large="true" />
    </div>

    <!-- Question screen -->
    <div v-else-if="game.status === 'question'" class="screen-question">
      <div class="q-counter">{{ $t('screen.question', { n: game.questionIndex + 1, total: game.totalQuestions }) }}</div>
      <div v-if="game.roundType === 'chaos' && game.questionModifier" class="chaos-mod-banner">
        {{ $t('roundTypes.chaosMod', { mod: $t(`roundTypes.${game.questionModifier}`) }) }}
      </div>
      <div v-if="screenQuestion?.type === 'music'" class="music-player-bar" :class="{ playing: musicPlaying }">
        <div class="music-note-icon">🎵</div>
        <div class="music-status">{{ musicPlaying ? $t('game.musicPlaying') : $t('game.musicWaiting') }}</div>
        <div v-if="musicPlaying" class="music-bars"><span /><span /><span /><span /></div>
      </div>
      <QuestionCard :question="screenQuestion" :show-answer="false" :large="true" />
      <Timer :seconds="game.timeLimit" :key="game.questionIndex" :large="true" />
    </div>

    <!-- Results screen -->
    <div v-else-if="game.status === 'results'" class="screen-results">
      <QuestionCard :question="screenQuestion" :correct-answer="screenCorrectAnswer" :show-answer="true" :large="true" />
      <div v-if="isLoneWolfRound" class="lone-wolf-banner">
        {{ game.lastResult?.loneWolfWinner
          ? $t('roundTypes.loneWolfWon', { nickname: game.lastResult.loneWolfWinner.nickname })
          : $t('roundTypes.loneWolfNobody') }}
      </div>
      <div class="results-row">
        <Scoreboard :players="game.scoreboard" :compact="false" />
        <div v-if="answerTimes.length" class="answer-times">
          <div class="at-header">⏱ {{ $t('results.answerTimes') }}</div>
          <div v-for="(r, i) in answerTimes" :key="r.id" class="at-row" :class="{ correct: r.isCorrect, skipped: r.skipped }">
            <span class="at-rank">#{{ i + 1 }}</span>
            <span class="at-name">{{ r.nickname }}</span>
            <span class="at-time">{{ r.skipped ? '—' : r.timeTaken !== null ? r.timeTaken.toFixed(1) + 's' : '—' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- End screen -->
    <div v-else-if="game.status === 'ended'" class="screen-end">
      <h1>{{ $t('game.finalScores') }}</h1>
      <Scoreboard :players="game.scoreboard" :show-podium="true" />
    </div>

    <!-- Scoreboard overlay (host-triggered) -->
    <ScoreTable
      :visible="game.scoreboardVisible"
      :scoreboard="game.scoreboard"
      :round-type="game.roundType"
      :is-host="false"
    />

    <!-- Reveal countdown overlay (fixed, outside v-if chain) -->
    <Transition name="countdown">
      <div v-if="revealCountdown" class="reveal-overlay">
        <span class="reveal-number">{{ revealCountdown }}</span>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useGameStore } from '../stores/game.js'
import { useSocket } from '../composables/useSocket.js'
import { setLocale } from '../i18n/index.js'
import QuestionCard from '../components/QuestionCard.vue'
import Scoreboard from '../components/Scoreboard.vue'
import ScoreTable from '../components/ScoreTable.vue'
import Timer from '../components/Timer.vue'
import PlayerList from '../components/PlayerList.vue'

const route = useRoute()
const game = useGameStore()
const socket = useSocket()

const code = computed(() => route.params.code?.toUpperCase())
const joinUrl = computed(() => window.location.origin + '/join')

function applyLang(question, lang) {
  if (!question || lang === 'en') return question
  const tr = question.translations?.[lang]
  return tr ? { ...question, text: tr.text, options: tr.options, correct_answer: tr.correct_answer } : question
}

const screenQuestion = computed(() => applyLang(game.currentQuestion, game.language))

const isLoneWolfRound = computed(() => {
  const effective = game.roundType === 'chaos' ? game.questionModifier : game.roundType
  return effective === 'lone_wolf'
})

const answerTimes = computed(() => {
  const results = game.lastResult?.playerResults
  if (!results?.length) return []
  return [...results]
    .filter(r => !r.skipped && r.timeTaken !== null)
    .sort((a, b) => a.timeTaken - b.timeTaken)
    .concat(results.filter(r => r.skipped || r.timeTaken === null))
})
const screenCorrectAnswer = computed(() => {
  const ca = game.lastResult?.correctAnswer
  const q = game.currentQuestion
  if (!ca || !q || game.language === 'en') return ca
  const tr = q.translations?.[game.language]
  if (!tr) return ca
  const idx = q.options?.indexOf(ca) ?? -1
  return idx >= 0 ? (tr.options[idx] ?? ca) : ca
})

const revealCountdown = ref(null)
let countdownTimer = null

const musicPlaying = ref(false)
let audioEl = null
const onMusicPlay = () => {
  const url = game.currentQuestion?.media_url
  if (!url) return
  if (!audioEl) audioEl = new Audio()
  audioEl.src = url
  audioEl.currentTime = 0
  audioEl.play().catch(() => {})
  musicPlaying.value = true
}
const onMusicStop = () => {
  if (audioEl) { audioEl.pause(); audioEl.currentTime = 0 }
  musicPlaying.value = false
}

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
const onQuestion = data => {
  revealCountdown.value = null
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null }
  musicPlaying.value = false
  game.setQuestion(data)
}

const onJoined = ({ players, language }) => {
  game.setPlayers(players)
  game.setStatus('lobby')
  if (language) { game.setLanguage(language); setLocale(language) }
}
const onPlayerJoined = ({ players }) => game.setPlayers(players)
const onPlayerLeft = ({ players }) => game.setPlayers(players)
const onGameStarted = ({ totalQuestions }) => { game.totalQuestions = totalQuestions }
// onQuestion defined above
const onResultsRevealed = data => game.setResults(data)
const onGameEnded = data => game.endGame(data)
const onShowScoreboard = ({ scoreboard, roundType }) => {
  game.scoreboard = scoreboard
  game.roundType = roundType
  game.scoreboardVisible = true
}
const onHideScoreboard = () => { game.scoreboardVisible = false }
const onRoundTypeChanged = ({ roundType }) => { game.roundType = roundType }
const onLanguageChanged = ({ language }) => { game.setLanguage(language); setLocale(language) }

onMounted(() => {
  socket.emit('join_screen', { code: code.value })
  socket.on('joined_session', onJoined)
  socket.on('player_joined', onPlayerJoined)
  socket.on('player_left', onPlayerLeft)
  socket.on('game_started', onGameStarted)
  socket.on('question', onQuestion)
  socket.on('preparing_reveal', onPreparingReveal)
  socket.on('music_play', onMusicPlay)
  socket.on('music_stop', onMusicStop)
  socket.on('results_revealed', onResultsRevealed)
  socket.on('game_ended', onGameEnded)
  socket.on('show_scoreboard', onShowScoreboard)
  socket.on('hide_scoreboard', onHideScoreboard)
  socket.on('round_type_changed', onRoundTypeChanged)
  socket.on('language_changed', onLanguageChanged)
})

onUnmounted(() => {
  socket.off('joined_session', onJoined)
  socket.off('player_joined', onPlayerJoined)
  socket.off('player_left', onPlayerLeft)
  socket.off('game_started', onGameStarted)
  socket.off('question', onQuestion)
  socket.off('preparing_reveal', onPreparingReveal)
  socket.off('music_play', onMusicPlay)
  socket.off('music_stop', onMusicStop)
  socket.off('results_revealed', onResultsRevealed)
  onMusicStop()
  socket.off('game_ended', onGameEnded)
  socket.off('show_scoreboard', onShowScoreboard)
  socket.off('hide_scoreboard', onHideScoreboard)
  socket.off('round_type_changed', onRoundTypeChanged)
  socket.off('language_changed', onLanguageChanged)
})
</script>

<style scoped>
.screen-view { min-height: 100vh; display: flex; flex-direction: column; padding: 32px 48px; background: var(--bg); }
.screen-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 48px; }
.room-code { font-size: 1.5rem; font-weight: 900; letter-spacing: 4px; color: var(--primary); }

.screen-lobby { text-align: center; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 32px; }
.screen-lobby h1 { font-size: 2rem; color: var(--text-muted); }
.join-url { color: var(--text); }
.big-code { font-size: 7rem; font-weight: 900; letter-spacing: 16px; color: var(--primary); line-height: 1; }

.screen-question { flex: 1; display: flex; flex-direction: column; gap: 24px; }
.q-counter { font-size: 1.2rem; color: var(--text-muted); font-weight: 600; }

.screen-results, .screen-end { flex: 1; display: flex; flex-direction: column; gap: 24px; }
.screen-end h1 { text-align: center; font-size: 3rem; }

.reveal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 900;
  pointer-events: none;
}
.reveal-number {
  font-size: 20rem;
  font-weight: 900;
  color: #fff;
  line-height: 1;
  text-shadow: 0 0 120px var(--primary);
}
.countdown-enter-active, .countdown-leave-active { transition: opacity 0.3s, transform 0.3s; }
.countdown-enter-from, .countdown-leave-to { opacity: 0; transform: scale(1.5); }

.results-row { display: flex; gap: 24px; align-items: flex-start; }
.results-row > * { flex: 1; }

.answer-times { background: var(--surface); border-radius: 12px; overflow: hidden; }
.at-header { padding: 12px 16px; font-weight: 700; font-size: 0.9rem; color: var(--text-muted); border-bottom: 1px solid var(--border); }
.at-row { display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-bottom: 1px solid var(--border); }
.at-row:last-child { border-bottom: none; }
.at-row.correct .at-time { color: var(--success); }
.at-row.skipped { opacity: 0.5; }
.at-rank { font-size: 0.8rem; color: var(--text-muted); width: 28px; flex-shrink: 0; }
.at-name { flex: 1; font-weight: 600; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.at-time { font-size: 0.95rem; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--text-muted); flex-shrink: 0; }

.chaos-mod-banner {
  text-align: center;
  font-size: 1.1rem;
  font-weight: 700;
  padding: 10px 20px;
  border-radius: 10px;
  background: rgba(99,102,241,0.15);
  color: #a5b4fc;
}
.lone-wolf-banner {
  text-align: center; padding: 16px 24px; border-radius: 12px;
  font-size: 1.4rem; font-weight: 700;
  background: rgba(250,204,21,0.12); color: #eab308;
  border: 1px solid rgba(250,204,21,0.3);
}

.music-player-bar {
  display: flex; align-items: center; gap: 16px;
  padding: 20px 24px; border-radius: 14px; margin-bottom: 16px;
  background: rgba(30,215,96,0.08); border: 1px solid rgba(30,215,96,0.2);
  color: var(--text-muted);
}
.music-player-bar.playing { color: #1ed760; border-color: rgba(30,215,96,0.4); background: rgba(30,215,96,0.12); }
.music-note-icon { font-size: 2rem; flex-shrink: 0; }
.music-status { flex: 1; font-weight: 700; font-size: 1.1rem; }
.music-bars { display: flex; align-items: flex-end; gap: 4px; height: 28px; }
.music-bars span {
  width: 6px; border-radius: 3px; background: #1ed760;
  animation: music-bar 0.8s ease-in-out infinite alternate;
}
.music-bars span:nth-child(1) { animation-delay: 0s; }
.music-bars span:nth-child(2) { animation-delay: 0.15s; }
.music-bars span:nth-child(3) { animation-delay: 0.3s; }
.music-bars span:nth-child(4) { animation-delay: 0.45s; }
@keyframes music-bar {
  from { height: 4px; }
  to   { height: 26px; }
}
</style>
