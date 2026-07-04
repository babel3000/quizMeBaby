<template>
  <div class="host-view">
    <!-- Setup screen -->
    <div v-if="game.status === 'idle'" class="page-center">
      <div class="card setup-card">
        <RouterLink to="/" class="back-link">← Back</RouterLink>
        <div class="logo">Host a Game</div>

        <div class="field">
          <label>Your Name</label>
          <input v-model="hostName" type="text" placeholder="e.g. Quiz Master" maxlength="20" />
        </div>

        <p v-if="error" class="error">{{ error }}</p>

        <button class="btn btn-primary btn-lg" style="width:100%;margin-top:8px" @click="createSession" :disabled="loading">
          {{ loading ? 'Creating...' : 'Create Room 🎙️' }}
        </button>
      </div>
    </div>

    <!-- Lobby screen -->
    <div v-else-if="game.status === 'lobby'" class="lobby">
      <div class="lobby-header">
        <div class="logo">PubQuiz</div>
        <div class="room-code-block">
          <span class="room-label">ROOM CODE</span>
          <span class="room-code">{{ game.code }}</span>
          <span class="room-hint">Teams join at <strong>{{ joinUrl }}</strong></span>
        </div>
      </div>

      <PlayerList :players="nonHostPlayers" />

      <div class="lobby-actions">
        <button
          class="btn btn-primary btn-lg"
          :disabled="nonHostPlayers.length === 0"
          @click="startGame"
        >
          Start Game ({{ nonHostPlayers.length }} team{{ nonHostPlayers.length !== 1 ? 's' : '' }})
        </button>
        <RouterLink :to="`/screen/${game.code}`" target="_blank" class="btn btn-secondary">
          📺 Open Screen View
        </RouterLink>
      </div>
    </div>

    <!-- Active game - host control panel -->
    <div v-else-if="['starting','question','results'].includes(game.status)" class="host-game">
      <div class="host-header">
        <span class="badge badge-primary">{{ game.questionIndex + 1 }} / {{ game.totalQuestions }}</span>
        <span class="rt-pill" :class="`rt-${game.roundType}`">{{ roundTypeLabel }}</span>
        <span class="room-code-small">{{ game.code }}</span>
      </div>

      <!-- Countdown before first question -->
      <div v-if="game.status === 'starting'" class="countdown-panel card">
        <p>Get ready!</p>
        <div class="countdown-number">{{ countdown }}</div>
      </div>

      <!-- Question in progress -->
      <div v-else-if="game.status === 'question'" class="question-panel">
        <QuestionCard :question="game.currentQuestion" :show-answer="false" />
        <div class="answer-progress">
          <span>{{ answeredCount }} / {{ nonHostPlayers.length }} answered</span>
          <Timer :seconds="game.timeLimit" :key="game.questionIndex" @expired="revealResults" />
        </div>
        <button class="btn btn-secondary" @click="revealResults">Reveal Answer</button>
      </div>

      <!-- Results for this question -->
      <div v-else-if="game.status === 'results'" class="results-panel">
        <QuestionCard :question="game.currentQuestion" :correct-answer="game.lastResult?.correctAnswer" :show-answer="true" />

        <!-- Round type selector -->
        <div class="round-type-section">
          <p class="section-label">Round type for next question</p>
          <div class="rt-selector">
            <button
              v-for="rt in roundTypes"
              :key="rt.value"
              class="rt-btn"
              :class="{ active: game.roundType === rt.value }"
              @click="setRoundType(rt.value)"
            >{{ rt.label }}</button>
          </div>
        </div>

        <Scoreboard :players="game.scoreboard" />

        <div class="results-actions">
          <button class="btn btn-secondary" @click="showScoreboard">📊 Show Scoreboard</button>
          <button v-if="!game.lastResult?.isLastQuestion" class="btn btn-primary btn-lg" @click="nextQuestion">
            Next Question →
          </button>
          <button v-else class="btn btn-primary btn-lg" @click="endGame">
            End Game 🏆
          </button>
        </div>
      </div>
    </div>

    <!-- End screen -->
    <div v-else-if="game.status === 'ended'" class="page-center">
      <div class="card end-card">
        <div class="logo">🏆 Game Over!</div>
        <Scoreboard :players="game.scoreboard" :show-podium="true" />
        <button class="btn btn-primary btn-lg" style="width:100%;margin-top:24px" @click="resetGame">
          New Game
        </button>
      </div>
    </div>

    <!-- Scoreboard overlay -->
    <ScoreTable
      :visible="game.scoreboardVisible"
      :scoreboard="game.scoreboard"
      :round-type="game.roundType"
      :is-host="true"
      :is-last-question="game.lastResult?.isLastQuestion ?? false"
      @hide="hideScoreboard"
      @next-question="nextQuestionFromOverlay"
      @end-game="endGame"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useGameStore } from '../stores/game.js'
import { usePlayerStore } from '../stores/player.js'
import { useSocket } from '../composables/useSocket.js'
import QuestionCard from '../components/QuestionCard.vue'
import Scoreboard from '../components/Scoreboard.vue'
import ScoreTable from '../components/ScoreTable.vue'
import Timer from '../components/Timer.vue'
import PlayerList from '../components/PlayerList.vue'

const game = useGameStore()
const player = usePlayerStore()
const socket = useSocket()

const hostName = ref('Quiz Master')
const error = ref('')
const loading = ref(false)
const countdown = ref(3)
const answeredCount = ref(0)

const roundTypes = [
  { value: 'normal',      label: 'Normal' },
  { value: 'hot_streak',  label: '🔥 Hot Streak' },
  { value: 'safety_net',  label: '🛡️ Safety Net' },
  { value: 'lone_wolf',   label: '🐺 Lone Wolf' },
  { value: 'double_down', label: '⚡ Double Down' },
]

const ROUND_TYPE_LABELS = {
  normal:      'Normal',
  hot_streak:  '🔥 Hot Streak',
  safety_net:  '🛡️ Safety Net',
  lone_wolf:   '🐺 Lone Wolf',
  double_down: '⚡ Double Down',
}

const joinUrl = computed(() => window.location.origin + '/join')
const nonHostPlayers = computed(() => game.players.filter(p => !p.isHost))
const roundTypeLabel = computed(() => ROUND_TYPE_LABELS[game.roundType] ?? game.roundType)

const onSessionCreated = ({ code, player: me, players }) => {
  player.setPlayer(me)
  game.setCode(code)
  game.setPlayers(players)
  game.setStatus('lobby')
  loading.value = false
}
const onPlayerJoined = ({ players }) => game.setPlayers(players)
const onPlayerLeft = ({ players }) => game.setPlayers(players)
const onGameStarted = ({ totalQuestions }) => {
  game.totalQuestions = totalQuestions
  game.setStatus('starting')
  let c = 3
  const t = setInterval(() => { c--; countdown.value = c; if (c <= 0) clearInterval(t) }, 1000)
}
const onQuestion = data => { answeredCount.value = 0; game.setQuestion(data) }
const onPlayerAnswered = ({ totalAnswered }) => { answeredCount.value = totalAnswered }
const onResultsRevealed = data => game.setResults(data)
const onGameEnded = data => game.endGame(data)
const onRoundTypeChanged = ({ roundType }) => { game.roundType = roundType }
const onShowScoreboard = ({ scoreboard, roundType }) => {
  game.scoreboard = scoreboard
  game.roundType = roundType
  game.scoreboardVisible = true
}
const onHideScoreboard = () => { game.scoreboardVisible = false }

onMounted(() => {
  socket.on('session_created', onSessionCreated)
  socket.on('player_joined', onPlayerJoined)
  socket.on('player_left', onPlayerLeft)
  socket.on('game_started', onGameStarted)
  socket.on('question', onQuestion)
  socket.on('player_answered', onPlayerAnswered)
  socket.on('results_revealed', onResultsRevealed)
  socket.on('game_ended', onGameEnded)
  socket.on('round_type_changed', onRoundTypeChanged)
  socket.on('show_scoreboard', onShowScoreboard)
  socket.on('hide_scoreboard', onHideScoreboard)
})

onUnmounted(() => {
  socket.off('session_created', onSessionCreated)
  socket.off('player_joined', onPlayerJoined)
  socket.off('player_left', onPlayerLeft)
  socket.off('game_started', onGameStarted)
  socket.off('question', onQuestion)
  socket.off('player_answered', onPlayerAnswered)
  socket.off('results_revealed', onResultsRevealed)
  socket.off('game_ended', onGameEnded)
  socket.off('round_type_changed', onRoundTypeChanged)
  socket.off('show_scoreboard', onShowScoreboard)
  socket.off('hide_scoreboard', onHideScoreboard)
})

function createSession() {
  error.value = ''
  if (!hostName.value.trim()) { error.value = 'Name required.'; return }
  loading.value = true
  socket.emit('create_session', { nickname: hostName.value.trim() })
}

function startGame() {
  socket.emit('start_game', { code: game.code })
}

function revealResults() {
  socket.emit('reveal_results', { code: game.code })
}

function nextQuestion() {
  socket.emit('next_question', { code: game.code })
}

function nextQuestionFromOverlay() {
  game.scoreboardVisible = false
  socket.emit('next_question', { code: game.code })
}

function endGame() {
  socket.emit('end_game', { code: game.code })
}

function setRoundType(type) {
  socket.emit('set_round_type', { code: game.code, roundType: type })
}

function showScoreboard() {
  socket.emit('show_scoreboard', { code: game.code })
}

function hideScoreboard() {
  socket.emit('hide_scoreboard', { code: game.code })
}

function resetGame() {
  game.reset()
  player.reset()
}
</script>

<style scoped>
.host-view { min-height: 100vh; }

.setup-card { max-width: 400px; width: 100%; }
.back-link { display: inline-block; color: var(--text-muted); font-size: 0.9rem; margin-bottom: 20px; }
.back-link:hover { color: var(--text); }
.logo { margin-bottom: 24px; }
.field { margin-bottom: 16px; }
.field label { display: block; font-size: 0.85rem; font-weight: 600; color: var(--text-muted); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em; }
.error { color: var(--danger); font-size: 0.9rem; margin-bottom: 8px; }

.lobby { max-width: 700px; margin: 0 auto; padding: 40px 24px; }
.lobby-header { text-align: center; margin-bottom: 40px; }
.room-code-block { margin-top: 16px; }
.room-label { display: block; font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.1em; }
.room-code { display: block; font-size: 3.5rem; font-weight: 900; letter-spacing: 8px; color: var(--primary); line-height: 1.1; }
.room-hint { display: block; color: var(--text-muted); font-size: 0.9rem; margin-top: 8px; }
.lobby-actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 32px; }

.host-game { max-width: 800px; margin: 0 auto; padding: 24px; }
.host-header { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; flex-wrap: wrap; }
.room-code-small { font-weight: 700; color: var(--text-muted); letter-spacing: 2px; margin-left: auto; }

.rt-pill {
  padding: 4px 12px; border-radius: 999px;
  font-size: 0.78rem; font-weight: 700;
  background: var(--surface-2); color: var(--text-muted);
}
.rt-pill.rt-hot_streak  { background: rgba(255,140,0,0.15); color: #ffaa33; }
.rt-pill.rt-safety_net  { background: rgba(44,182,125,0.15); color: var(--success); }
.rt-pill.rt-lone_wolf   { background: rgba(180,100,220,0.15); color: #c47de0; }
.rt-pill.rt-double_down { background: rgba(233,69,96,0.15); color: var(--primary); }

.countdown-panel { text-align: center; padding: 60px; }
.countdown-number { font-size: 6rem; font-weight: 900; color: var(--primary); }

.answer-progress { display: flex; justify-content: space-between; align-items: center; margin: 16px 0; color: var(--text-muted); }

.results-panel { display: flex; flex-direction: column; gap: 20px; }
.results-actions { display: flex; justify-content: flex-end; gap: 10px; align-items: center; flex-wrap: wrap; }

.round-type-section { }
.section-label {
  font-size: 0.78rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 8px;
}
.rt-selector { display: flex; gap: 6px; flex-wrap: wrap; }
.rt-btn {
  padding: 6px 14px; border-radius: 999px; font-size: 0.82rem; font-weight: 600;
  background: var(--surface-2); color: var(--text-muted);
  border: 2px solid transparent; cursor: pointer; transition: all 0.15s;
}
.rt-btn:hover { border-color: var(--primary); color: var(--text); }
.rt-btn.active { background: var(--primary); color: white; border-color: var(--primary); }

.end-card { max-width: 600px; width: 100%; }
</style>
