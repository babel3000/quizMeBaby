<template>
  <div class="host-view">
    <!-- Setup screen -->
    <div v-if="game.status === 'idle'" class="page-center">
      <div class="card setup-card">
        <RouterLink to="/home" class="back-link">{{ $t('back') }}</RouterLink>
        <div class="logo">{{ $t('host.title') }}</div>

        <div class="field">
          <label>{{ $t('host.yourName') }}</label>
          <input v-model="hostName" type="text" :placeholder="$t('host.yourNamePlaceholder')" maxlength="20" />
        </div>

        <div class="play-as-team-toggle" @click="hostPlaysAsTeam = !hostPlaysAsTeam">
          <div class="toggle-track" :class="{ active: hostPlaysAsTeam }">
            <div class="toggle-thumb" />
          </div>
          <span class="toggle-label">{{ $t('host.playAsTeam') }}</span>
        </div>

        <div v-if="hostPlaysAsTeam" class="field" style="margin-top:12px">
          <label>{{ $t('host.teamNameLabel') }}</label>
          <input v-model="teamName" type="text" :placeholder="$t('host.teamNamePlaceholder')" maxlength="20" />
        </div>

        <p v-if="error" class="error">{{ error }}</p>

        <button class="btn btn-primary btn-lg" style="width:100%;margin-top:8px" @click="createSession" :disabled="loading">
          {{ loading ? $t('host.creating') : $t('host.create') }}
        </button>
      </div>
    </div>

    <!-- Lobby screen -->
    <div v-else-if="game.status === 'lobby'" class="lobby">
      <div class="lobby-header">
        <div class="logo">PubQuiz</div>
        <div class="room-code-block">
          <span class="room-label">{{ $t('host.roomCode') }}</span>
          <span class="room-code">{{ game.code }}</span>
          <span class="room-hint">{{ $t('host.teamsJoinAt') }} <strong>{{ joinUrl }}</strong></span>
        </div>
      </div>

      <PlayerList :players="nonHostPlayers" />

      <!-- Round Setup -->
      <div class="setup-section">
        <span class="setup-heading">{{ $t('host.roundSetup') }}</span>

        <div class="setup-row">
          <span class="setup-row-label">{{ $t('host.numQuestions') }}</span>
          <div class="count-pills">
            <button
              v-for="n in [5, 10, 15, 20]"
              :key="n"
              class="count-pill"
              :class="{ active: roundConfig.numQuestions === n }"
              @click="roundConfig.numQuestions = n"
            >{{ n }}</button>
            <input
              type="number"
              v-model.number="roundConfig.numQuestions"
              min="1"
              max="99"
              class="count-custom-input"
              placeholder="…"
            />
          </div>
        </div>

        <div class="setup-row">
          <span class="setup-row-label">{{ $t('host.category') }}</span>
          <select v-model="roundConfig.categoryId" class="category-select">
            <option :value="null">{{ $t('host.allCategories') }}</option>
            <option v-for="cat in categories" :key="cat.id" :value="cat.id">
              {{ cat.icon }} {{ cat.name }}
            </option>
          </select>
        </div>

        <div class="setup-row">
          <span class="setup-row-label">{{ $t('roundTypes.label') }}</span>
          <div class="rt-pills">
            <button
              v-for="rt in roundTypes"
              :key="rt.value"
              class="rt-pill"
              :class="{ active: roundConfig.roundType === rt.value }"
              @click="roundConfig.roundType = rt.value"
            >
              <span class="rt-pill-label">{{ rt.label }}</span>
              <span class="rt-pill-desc">{{ rt.desc }}</span>
            </button>
          </div>
        </div>

        <div class="setup-row">
          <span class="setup-row-label">{{ $t('host.language') }}</span>
          <div class="lang-pills">
            <button
              v-for="lang in LANGUAGES"
              :key="lang.code"
              class="lang-pill"
              :class="{ active: game.language === lang.code }"
              @click="changeLanguage(lang.code)"
            >{{ lang.label }}</button>
          </div>
        </div>
      </div>

      <div class="lobby-actions">
        <button
          class="btn btn-primary btn-lg"
          :disabled="nonHostPlayers.length === 0 && !game.hostPlaysAsTeam"
          @click="startGame"
        >
          {{ $t('host.startGame') }} ({{ nonHostPlayers.length + (game.hostPlaysAsTeam ? 1 : 0) }} {{ (nonHostPlayers.length + (game.hostPlaysAsTeam ? 1 : 0)) !== 1 ? $t('host.teams') : $t('host.team') }})
        </button>
        <RouterLink :to="`/screen/${game.code}`" target="_blank" class="btn btn-secondary">
          {{ $t('host.openScreen') }}
        </RouterLink>
      </div>
    </div>

    <!-- Active game - host control panel -->
    <div v-else-if="['starting','question','results'].includes(game.status)" class="host-game">
      <div class="host-header">
        <span class="badge badge-primary">{{ game.questionIndex + 1 }} / {{ game.totalQuestions }}</span>
        <span class="rt-pill-sm" :class="`rt-${game.roundType}`">{{ roundTypeLabel }}</span>
        <span class="room-code-small">{{ game.code }}</span>
      </div>

      <!-- Countdown before first question -->
      <div v-if="game.status === 'starting'" class="countdown-panel card">
        <p>{{ $t('game.getReady') }}</p>
        <div class="countdown-number">{{ countdown }}</div>
      </div>

      <!-- Question in progress -->
      <div v-else-if="game.status === 'question'" class="question-panel">
        <QuestionCard :question="hostQuestion" :show-answer="false" />

        <!-- Host answer area (only when playing as team) -->
        <div v-if="game.hostPlaysAsTeam" class="host-answer-area">
          <div v-if="!hostAnswer">
            <div v-if="hostQuestion?.type === 'multiple_choice'" class="host-options-grid">
              <button
                v-for="(opt, i) in hostQuestion.options"
                :key="opt"
                class="host-option-btn"
                :class="`color-${i}`"
                @click="submitHostAnswer(opt)"
              >{{ opt }}</button>
            </div>
            <div v-else class="host-text-answer">
              <input
                v-model="hostTextAnswer"
                type="text"
                placeholder="Type your answer…"
                @keyup.enter="submitHostAnswer(hostTextAnswer)"
              />
              <button class="btn btn-primary" @click="submitHostAnswer(hostTextAnswer)" :disabled="!hostTextAnswer.trim()">
                Submit
              </button>
            </div>
          </div>
          <div v-else class="host-answered-badge" :class="hostAnswer.isCorrect ? 'correct' : 'incorrect'">
            {{ hostAnswer.isCorrect ? '✓' : '✗' }}
            {{ hostAnswer.isCorrect ? $t('game.correct') : $t('game.wrong') }}
            <span v-if="hostAnswer.pointsAwarded > 0" class="host-pts">+{{ hostAnswer.pointsAwarded.toLocaleString() }}</span>
            <span v-else-if="hostAnswer.pointsAwarded < 0" class="host-pts penalty">{{ hostAnswer.pointsAwarded.toLocaleString() }}</span>
          </div>
        </div>

        <div class="answer-progress">
          <span>{{ $t('game.answered', { n: answeredCount, total: totalPlayers }) }}</span>
          <Timer :seconds="game.timeLimit" :key="game.questionIndex" @expired="revealResults" />
        </div>
        <button class="btn btn-secondary" @click="revealResults">{{ $t('results.revealAnswer') }}</button>
      </div>

      <!-- Results for this question -->
      <div v-else-if="game.status === 'results'" class="results-panel">
        <QuestionCard :question="hostQuestion" :correct-answer="hostCorrectAnswer" :show-answer="true" />

        <Scoreboard :players="game.scoreboard" :show-delta="true" />

        <!-- New round config (shown after last question) -->
        <div v-if="game.lastResult?.isLastQuestion && configuringNewRound" class="new-round-panel">
          <p class="setup-heading">{{ $t('host.roundSetup') }}</p>

          <div class="setup-row">
            <span class="setup-row-label">{{ $t('host.numQuestions') }}</span>
            <div class="count-pills">
              <button
                v-for="n in [5, 10, 15, 20]"
                :key="n"
                class="count-pill"
                :class="{ active: roundConfig.numQuestions === n }"
                @click="roundConfig.numQuestions = n"
              >{{ n }}</button>
              <input
                type="number"
                v-model.number="roundConfig.numQuestions"
                min="1"
                max="99"
                class="count-custom-input"
                placeholder="…"
              />
            </div>
          </div>

          <div class="setup-row">
            <span class="setup-row-label">{{ $t('host.category') }}</span>
            <select v-model="roundConfig.categoryId" class="category-select">
              <option :value="null">{{ $t('host.allCategories') }}</option>
              <option v-for="cat in categories" :key="cat.id" :value="cat.id">
                {{ cat.icon }} {{ cat.name }}
              </option>
            </select>
          </div>

          <div class="setup-row">
            <span class="setup-row-label">{{ $t('roundTypes.label') }}</span>
            <div class="rt-pills">
              <button
                v-for="rt in roundTypes"
                :key="rt.value"
                class="rt-pill"
                :class="{ active: roundConfig.roundType === rt.value }"
                @click="roundConfig.roundType = rt.value"
              >
                <span class="rt-pill-label">{{ rt.label }}</span>
                <span class="rt-pill-desc">{{ rt.desc }}</span>
              </button>
            </div>
          </div>
        </div>

        <div class="results-actions">
          <button class="btn btn-secondary" @click="showScoreboard">{{ $t('results.showScoreboard') }}</button>

          <template v-if="!game.lastResult?.isLastQuestion">
            <button class="btn btn-primary btn-lg" @click="nextQuestion">{{ $t('results.nextQuestion') }}</button>
          </template>
          <template v-else-if="!configuringNewRound">
            <button class="btn btn-secondary" @click="configuringNewRound = true">{{ $t('host.newRound') }}</button>
            <button class="btn btn-primary btn-lg" @click="endGame">{{ $t('results.endGame') }}</button>
          </template>
          <template v-else>
            <button class="btn btn-secondary" @click="configuringNewRound = false">{{ $t('host.cancelNewRound') }}</button>
            <button class="btn btn-primary btn-lg" @click="startGame">{{ $t('host.startRound') }}</button>
          </template>
        </div>
      </div>
    </div>

    <!-- End screen -->
    <div v-else-if="game.status === 'ended'" class="page-center">
      <div class="card end-card">
        <div class="logo">{{ $t('game.gameOver') }}</div>
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
      @new-round="startNewRoundFromOverlay"
      @end-game="endGame"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, reactive } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { setLocale } from '../i18n/index.js'
import { useGameStore } from '../stores/game.js'
import { usePlayerStore } from '../stores/player.js'
import { useSocket } from '../composables/useSocket.js'
import QuestionCard from '../components/QuestionCard.vue'
import Scoreboard from '../components/Scoreboard.vue'
import ScoreTable from '../components/ScoreTable.vue'
import Timer from '../components/Timer.vue'
import PlayerList from '../components/PlayerList.vue'

const { t } = useI18n()
const game = useGameStore()
const player = usePlayerStore()
const socket = useSocket()

const hostName = ref('Quiz Master')
const teamName = ref('')
const hostPlaysAsTeam = ref(false)
const hostAnswer = ref(null)
const hostTextAnswer = ref('')
const error = ref('')
const loading = ref(false)
const countdown = ref(3)
const answeredCount = ref(0)
const totalPlayers = ref(0)
const categories = ref([])
const configuringNewRound = ref(false)

const roundConfig = reactive({
  numQuestions: 10,
  categoryId: null,
  roundType: 'normal',
})

const LANGUAGES = [
  { code: 'en',    label: '🇬🇧 English' },
  { code: 'pt-PT', label: '🇵🇹 Português' },
]

const roundTypes = computed(() => [
  { value: 'normal',      label: t('roundTypes.normal'),      desc: t('roundTypes.normalDesc') },
  { value: 'hot_streak',  label: t('roundTypes.hot_streak'),  desc: t('roundTypes.hot_streakDesc') },
  { value: 'safety_net',  label: t('roundTypes.safety_net'),  desc: t('roundTypes.safety_netDesc') },
  { value: 'lone_wolf',   label: t('roundTypes.lone_wolf'),   desc: t('roundTypes.lone_wolfDesc') },
  { value: 'double_down', label: t('roundTypes.double_down'), desc: t('roundTypes.double_downDesc') },
])

const roundTypeLabel = computed(() => t(`roundTypes.${game.roundType}`) ?? game.roundType)
const joinUrl = computed(() => window.location.origin + '/join')
const nonHostPlayers = computed(() => game.players.filter(p => !p.isHost))

function applyLang(question, lang) {
  if (!question || lang === 'en') return question
  const tr = question.translations?.[lang]
  return tr ? { ...question, text: tr.text, options: tr.options, correct_answer: tr.correct_answer } : question
}

const hostQuestion = computed(() => applyLang(game.currentQuestion, game.language))
const hostCorrectAnswer = computed(() => {
  const ca = game.lastResult?.correctAnswer
  const q = game.currentQuestion
  if (!ca || !q || game.language === 'en') return ca
  const tr = q.translations?.[game.language]
  if (!tr) return ca
  const idx = q.options?.indexOf(ca) ?? -1
  return idx >= 0 ? (tr.options[idx] ?? ca) : ca
})

const onSessionCreated = ({ code, player: me, players, language, hostPlaysAsTeam: hpt }) => {
  player.setPlayer(me)
  game.setCode(code)
  game.setPlayers(players)
  game.setLanguage(language ?? 'en')
  game.setHostPlaysAsTeam(hpt ?? false)
  game.setStatus('lobby')
  loading.value = false
}
const onPlayerJoined = ({ players }) => game.setPlayers(players)
const onPlayerLeft = ({ players }) => game.setPlayers(players)
const onGameStarted = ({ totalQuestions, roundType }) => {
  if (roundType) game.roundType = roundType
  game.totalQuestions = totalQuestions
  game.setStatus('starting')
  configuringNewRound.value = false
  let c = 3
  const timer = setInterval(() => { c--; countdown.value = c; if (c <= 0) clearInterval(timer) }, 1000)
}
const onQuestion = data => {
  answeredCount.value = 0
  hostAnswer.value = null
  hostTextAnswer.value = ''
  totalPlayers.value = nonHostPlayers.value.length + (game.hostPlaysAsTeam ? 1 : 0)
  game.setQuestion(data)
}
const onPlayerAnswered = ({ totalAnswered, totalPlayers: tp }) => {
  answeredCount.value = totalAnswered
  if (tp !== undefined) totalPlayers.value = tp
}
const onAnswerReceived = result => { hostAnswer.value = result }
const onResultsRevealed = data => game.setResults(data)
const onGameEnded = data => game.endGame(data)
const onRoundTypeChanged = ({ roundType }) => { game.roundType = roundType }
const onLanguageChanged = ({ language }) => { game.setLanguage(language); setLocale(language) }
const onShowScoreboard = ({ scoreboard, roundType }) => {
  game.scoreboard = scoreboard
  game.roundType = roundType
  game.scoreboardVisible = true
}
const onHideScoreboard = () => { game.scoreboardVisible = false }

onMounted(async () => {
  socket.on('session_created', onSessionCreated)
  socket.on('player_joined', onPlayerJoined)
  socket.on('player_left', onPlayerLeft)
  socket.on('game_started', onGameStarted)
  socket.on('question', onQuestion)
  socket.on('player_answered', onPlayerAnswered)
  socket.on('answer_received', onAnswerReceived)
  socket.on('results_revealed', onResultsRevealed)
  socket.on('game_ended', onGameEnded)
  socket.on('round_type_changed', onRoundTypeChanged)
  socket.on('show_scoreboard', onShowScoreboard)
  socket.on('hide_scoreboard', onHideScoreboard)
  socket.on('language_changed', onLanguageChanged)

  try {
    const res = await fetch('/api/questions/categories')
    categories.value = await res.json()
  } catch { /* silently ignore — select will just show "All categories" */ }
})

onUnmounted(() => {
  socket.off('session_created', onSessionCreated)
  socket.off('player_joined', onPlayerJoined)
  socket.off('player_left', onPlayerLeft)
  socket.off('game_started', onGameStarted)
  socket.off('question', onQuestion)
  socket.off('player_answered', onPlayerAnswered)
  socket.off('answer_received', onAnswerReceived)
  socket.off('results_revealed', onResultsRevealed)
  socket.off('game_ended', onGameEnded)
  socket.off('round_type_changed', onRoundTypeChanged)
  socket.off('show_scoreboard', onShowScoreboard)
  socket.off('hide_scoreboard', onHideScoreboard)
  socket.off('language_changed', onLanguageChanged)
})

function changeLanguage(lang) {
  socket.emit('set_language', { code: game.code, language: lang })
}

function createSession() {
  error.value = ''
  if (!hostName.value.trim()) { error.value = t('host.nameRequired'); return }
  loading.value = true
  socket.emit('create_session', {
    nickname: hostName.value.trim(),
    teamName: hostPlaysAsTeam.value ? (teamName.value.trim() || hostName.value.trim()) : undefined,
  })
  const timeout = setTimeout(() => {
    if (loading.value) {
      loading.value = false
      error.value = 'Could not connect to server. Make sure you are on the same Wi-Fi network.'
    }
  }, 8000)
  socket.once('session_created', () => clearTimeout(timeout))
}

function submitHostAnswer(displayedOpt) {
  if (!displayedOpt?.trim() || hostAnswer.value) return
  const q = game.currentQuestion
  const dispOpts = hostQuestion.value?.options ?? q?.options ?? []
  const idx = dispOpts.indexOf(displayedOpt)
  const englishAnswer = idx >= 0 ? (q?.options[idx] ?? displayedOpt) : displayedOpt
  socket.emit('submit_answer', { code: game.code, answer: englishAnswer.trim() })
}

function startGame() {
  configuringNewRound.value = false
  socket.emit('start_game', {
    code: game.code,
    numQuestions: roundConfig.numQuestions,
    roundType: roundConfig.roundType,
    categoryId: roundConfig.categoryId || undefined,
  })
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

function startNewRoundFromOverlay() {
  game.scoreboardVisible = false
  configuringNewRound.value = true
}

function endGame() {
  socket.emit('end_game', { code: game.code })
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

/* ── Lobby ──────────────────────────────────── */
.lobby { max-width: 700px; margin: 0 auto; padding: 40px 24px; }
.lobby-header { text-align: center; margin-bottom: 40px; }
.room-code-block { margin-top: 16px; }
.room-label { display: block; font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.1em; }
.room-code { display: block; font-size: 3.5rem; font-weight: 900; letter-spacing: 8px; color: var(--primary); line-height: 1.1; }
.room-hint { display: block; color: var(--text-muted); font-size: 0.9rem; margin-top: 8px; }

/* ── Setup section (lobby + new round panel) ── */
.setup-section, .new-round-panel {
  margin-top: 28px;
  background: var(--surface);
  border-radius: var(--radius);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.new-round-panel {
  border: 1px solid var(--surface-2);
  margin-top: 16px;
}

.section-label {
  font-size: 0.78rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.08em; color: var(--text-muted);
}

.setup-heading {
  display: block;
  font-size: 1rem; font-weight: 800;
  color: var(--primary);
  padding-left: 10px;
  border-left: 3px solid var(--primary);
  letter-spacing: 0.01em;
}

.setup-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.setup-row-label {
  font-size: 0.8rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;
}

.count-pills { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.count-pill {
  padding: 6px 16px; border-radius: 999px; font-size: 0.9rem; font-weight: 700;
  background: var(--surface-2); color: var(--text-muted);
  border: 2px solid transparent; cursor: pointer; transition: all 0.15s;
}
.count-pill:hover { border-color: var(--primary); color: var(--text); }
.count-pill.active { background: var(--primary); color: white; border-color: var(--primary); }

.count-custom-input {
  width: 64px; padding: 6px 10px; border-radius: 999px;
  font-size: 0.9rem; font-weight: 700; text-align: center;
  background: var(--surface-2); color: var(--text);
  border: 2px solid var(--surface-2); cursor: text; transition: border-color 0.15s;
}
.count-custom-input:focus { outline: none; border-color: var(--primary); }
.count-custom-input::-webkit-inner-spin-button,
.count-custom-input::-webkit-outer-spin-button { -webkit-appearance: none; }
.count-custom-input[type=number] { -moz-appearance: textfield; }

.category-select {
  background: var(--surface-2); color: var(--text);
  border: 2px solid transparent; border-radius: var(--radius);
  padding: 8px 12px; font-size: 0.9rem; font-weight: 600;
  cursor: pointer; transition: border-color 0.15s;
  max-width: 280px;
}
.category-select:focus { outline: none; border-color: var(--primary); }

.rt-pills { display: flex; flex-direction: column; gap: 8px; }
.rt-pill {
  width: 100%; padding: 10px 14px; border-radius: var(--radius);
  text-align: left; background: var(--surface-2); color: var(--text-muted);
  border: 2px solid transparent; cursor: pointer; transition: all 0.15s;
  display: flex; flex-direction: column; gap: 3px;
}
.rt-pill:hover { border-color: var(--primary); color: var(--text); }
.rt-pill.active { background: rgba(233,69,96,0.12); color: var(--text); border-color: var(--primary); }
.rt-pill-label { font-size: 0.88rem; font-weight: 700; }
.rt-pill-desc { font-size: 0.75rem; font-weight: 400; line-height: 1.3; opacity: 0.75; }
.rt-pill.active .rt-pill-desc { opacity: 0.9; }

.lang-pills { display: flex; gap: 8px; }
.lang-pill {
  flex: 1; padding: 8px 10px; border-radius: var(--radius); font-size: 0.85rem; font-weight: 600;
  text-align: center; background: var(--surface-2); color: var(--text-muted);
  border: 2px solid transparent; cursor: pointer; transition: all 0.15s;
}
.lang-pill:hover { border-color: var(--primary); color: var(--text); }
.lang-pill.active { background: var(--primary); color: white; border-color: var(--primary); }

.lobby-actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 32px; }

/* ── Active game ────────────────────────────── */
.host-game { max-width: 800px; margin: 0 auto; padding: 24px; }
.host-header { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; flex-wrap: wrap; }
.room-code-small { font-weight: 700; color: var(--text-muted); letter-spacing: 2px; margin-left: auto; }

.rt-pill-sm {
  padding: 4px 12px; border-radius: 999px;
  font-size: 0.78rem; font-weight: 700;
  background: var(--surface-2); color: var(--text-muted);
}
.rt-pill-sm.rt-hot_streak  { background: rgba(255,140,0,0.15); color: #ffaa33; }
.rt-pill-sm.rt-safety_net  { background: rgba(44,182,125,0.15); color: var(--success); }
.rt-pill-sm.rt-lone_wolf   { background: rgba(180,100,220,0.15); color: #c47de0; }
.rt-pill-sm.rt-double_down { background: rgba(233,69,96,0.15); color: var(--primary); }

.countdown-panel { text-align: center; padding: 60px; }
.countdown-number { font-size: 6rem; font-weight: 900; color: var(--primary); }

.answer-progress { display: flex; justify-content: space-between; align-items: center; margin: 16px 0; color: var(--text-muted); }

.results-panel { display: flex; flex-direction: column; gap: 20px; }
.results-actions { display: flex; justify-content: flex-end; gap: 10px; align-items: center; flex-wrap: wrap; }

.end-card { max-width: 600px; width: 100%; }

/* ── Play-as-team toggle ────────────────────── */
.play-as-team-toggle {
  display: flex; align-items: center; gap: 10px;
  cursor: pointer; user-select: none; margin-top: 4px;
}
.toggle-track {
  width: 42px; height: 24px; border-radius: 999px;
  background: var(--surface-2); border: 2px solid var(--surface-2);
  position: relative; transition: background 0.2s, border-color 0.2s; flex-shrink: 0;
}
.toggle-track.active { background: var(--primary); border-color: var(--primary); }
.toggle-thumb {
  width: 16px; height: 16px; border-radius: 50%;
  background: white; position: absolute; top: 2px; left: 2px;
  transition: transform 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}
.toggle-track.active .toggle-thumb { transform: translateX(18px); }
.toggle-label { font-size: 0.9rem; font-weight: 600; color: var(--text); }

/* ── Host answer area (in-game) ─────────────── */
.host-answer-area {
  margin: 16px 0;
  padding: 16px;
  background: var(--surface);
  border-radius: var(--radius);
  border: 2px solid var(--surface-2);
}

.host-options-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.host-option-btn {
  padding: 12px 16px;
  border-radius: var(--radius);
  font-size: 0.9rem; font-weight: 700;
  border: none; cursor: pointer;
  text-align: left;
  transition: filter 0.15s, transform 0.1s;
}
.host-option-btn:hover { filter: brightness(1.1); }
.host-option-btn:active { transform: scale(0.97); filter: brightness(0.9); }
.host-option-btn.color-0 { background: #e84060; color: #fff; }
.host-option-btn.color-1 { background: #1368ce; color: #fff; }
.host-option-btn.color-2 { background: #d89e00; color: #fff; }
.host-option-btn.color-3 { background: #26890c; color: #fff; }

.host-text-answer { display: flex; gap: 8px; }
.host-text-answer input {
  flex: 1; padding: 8px 12px; border-radius: var(--radius);
  background: var(--surface-2); color: var(--text);
  border: 2px solid var(--surface-2); font-size: 0.9rem;
}
.host-text-answer input:focus { outline: none; border-color: var(--primary); }

.host-answered-badge {
  display: flex; align-items: center; gap: 10px;
  font-weight: 700; font-size: 1rem; padding: 10px 14px;
  border-radius: var(--radius);
}
.host-answered-badge.correct { background: rgba(44,182,125,0.15); color: var(--success); }
.host-answered-badge.incorrect { background: rgba(233,69,96,0.15); color: var(--primary); }
.host-pts { margin-left: auto; font-size: 1.1rem; }
.host-pts.penalty { color: var(--danger); }

/* ── Mobile overrides ───────────────────────── */
@media (max-width: 480px) {
  /* Lobby — compact header */
  .lobby { padding: 20px 16px; }
  .lobby-header .logo { display: none; }
  .lobby-header { margin-bottom: 20px; }
  .room-code { font-size: 2.4rem; letter-spacing: 5px; }
  .room-hint { font-size: 0.82rem; }
  .setup-section { margin-top: 16px; padding: 16px; gap: 14px; }
  .lobby-actions { flex-direction: column; margin-top: 20px; }
  .lobby-actions .btn { width: 100%; text-align: center; }

  /* Active game — fill the viewport */
  .host-game { padding: 16px 16px 24px; }
  .host-header { margin-bottom: 16px; }

  /* Question panel — push controls to bottom */
  .question-panel {
    display: flex; flex-direction: column;
    min-height: calc(100dvh - 72px);
  }
  .answer-progress { margin-top: auto; padding-top: 16px; }

  /* Results panel — tighter spacing, full-width buttons */
  .results-panel { gap: 14px; }
  .results-actions { flex-direction: column-reverse; align-items: stretch; }
  .results-actions .btn { width: 100%; text-align: center; }
  .new-round-panel { padding: 14px; }
}
</style>
