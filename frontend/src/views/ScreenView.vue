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
      <QuestionCard :question="game.currentQuestion" :show-answer="false" :large="true" />
      <Timer :seconds="game.timeLimit" :key="game.questionIndex" :large="true" />
    </div>

    <!-- Results screen -->
    <div v-else-if="game.status === 'results'" class="screen-results">
      <QuestionCard :question="game.currentQuestion" :correct-answer="game.lastResult?.correctAnswer" :show-answer="true" :large="true" />
      <Scoreboard :players="game.scoreboard" :compact="false" />
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
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
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

const onJoined = ({ players, language }) => {
  game.setPlayers(players)
  game.setStatus('lobby')
  if (language) { game.setLanguage(language); setLocale(language) }
}
const onPlayerJoined = ({ players }) => game.setPlayers(players)
const onPlayerLeft = ({ players }) => game.setPlayers(players)
const onGameStarted = ({ totalQuestions }) => { game.totalQuestions = totalQuestions }
const onQuestion = data => game.setQuestion(data)
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
  socket.emit('join_session', { code: code.value, nickname: '__screen__' })
  socket.on('joined_session', onJoined)
  socket.on('player_joined', onPlayerJoined)
  socket.on('player_left', onPlayerLeft)
  socket.on('game_started', onGameStarted)
  socket.on('question', onQuestion)
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
  socket.off('results_revealed', onResultsRevealed)
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
</style>
