<template>
  <div class="play-view">

    <!-- Waiting in lobby -->
    <div v-if="game.status === 'lobby'" class="page-center">
      <div class="card lobby-card">
        <div class="player-avatar">{{ initials }}</div>
        <h2>{{ player.nickname }}</h2>
        <span class="badge badge-success">Joined ✓</span>
        <div class="room-info">
          Room <strong class="room-code">{{ game.code }}</strong>
        </div>
        <p class="waiting">Waiting for host to start the game…</p>
        <div class="dots"><span /><span /><span /></div>
      </div>
    </div>

    <!-- Starting countdown -->
    <div v-else-if="game.status === 'starting'" class="page-center">
      <div class="card countdown-card">
        <p>Get ready!</p>
        <div class="countdown">{{ countdown }}</div>
      </div>
    </div>

    <!-- Answer question -->
    <div v-else-if="game.status === 'question'" class="question-view">
      <div class="q-header">
        <span class="badge badge-primary">Q{{ game.questionIndex + 1 }} / {{ game.totalQuestions }}</span>
        <span v-if="myConsecutiveSkips > 0" class="skip-mult-badge">
          ⚡ ×{{ nextSkipMultiplier }} on next correct
        </span>
        <Timer :seconds="game.timeLimit" :key="game.questionIndex" />
      </div>

      <div v-if="!game.myAnswer" class="answer-section">
        <h2 class="question-text">{{ game.currentQuestion?.text }}</h2>

        <!-- Multiple choice options -->
        <div v-if="game.currentQuestion?.type === 'multiple_choice'" class="options-grid">
          <button
            v-for="opt in game.currentQuestion.options"
            :key="opt"
            class="option-btn"
            @click="submitAnswer(opt)"
          >{{ opt }}</button>
        </div>

        <!-- Text answer fallback -->
        <div v-else class="text-answer">
          <input v-model="textAnswer" type="text" placeholder="Type your answer…" @keyup.enter="submitAnswer(textAnswer)" />
          <button class="btn btn-primary" @click="submitAnswer(textAnswer)" :disabled="!textAnswer.trim()">Submit</button>
        </div>

        <button class="skip-btn" @click="skipQuestion">
          Skip this question ↷
          <span v-if="myConsecutiveSkips > 0" class="skip-next">
            → ×{{ (1 + 0.25 * Math.min(myConsecutiveSkips + 1, 4)).toFixed(2).replace(/\.?0+$/, '') }} next
          </span>
          <span v-if="myConsecutiveSkips >= 4" class="skip-locked"> (multiplier maxed)</span>
        </button>
      </div>

      <!-- Waiting after answering / skipping -->
      <div
        v-else
        class="answered-feedback"
        :class="game.myAnswer.skipped ? 'skipped' : game.myAnswer.isCorrect ? 'correct' : 'incorrect'"
      >
        <div class="feedback-icon">
          {{ game.myAnswer.skipped ? '↷' : game.myAnswer.isCorrect ? '✓' : '✗' }}
        </div>
        <p class="feedback-label">
          {{ game.myAnswer.skipped ? 'Skipped' : game.myAnswer.isCorrect ? 'Correct!' : 'Wrong!' }}
        </p>
        <p v-if="game.myAnswer.skipped && myConsecutiveSkips > 0" class="points skip-info">
          ×{{ nextSkipMultiplier }} on next correct
        </p>
        <p v-else-if="game.myAnswer.pointsAwarded > 0" class="points">+{{ game.myAnswer.pointsAwarded }} pts</p>
        <p v-else-if="game.myAnswer.pointsAwarded < 0" class="points penalty">{{ game.myAnswer.pointsAwarded }} pts</p>
        <p class="waiting-text">Waiting for results…</p>
      </div>
    </div>

    <!-- Results for this question -->
    <div v-else-if="game.status === 'results'" class="page-center">
      <div class="card results-card">
        <h3>Answer: <span class="correct-answer">{{ game.lastResult?.correctAnswer }}</span></h3>
        <div class="my-result" :class="game.myAnswer?.skipped ? 'skipped' : game.myAnswer?.isCorrect ? 'correct' : 'incorrect'">
          <span>{{ game.myAnswer?.skipped ? '↷ Skipped' : game.myAnswer?.isCorrect ? '✓ Correct' : '✗ Wrong' }}</span>
          <span v-if="game.myAnswer?.pointsAwarded > 0">+{{ game.myAnswer.pointsAwarded }} pts</span>
          <span v-else-if="game.myAnswer?.pointsAwarded < 0" class="penalty-text">{{ game.myAnswer.pointsAwarded }} pts</span>
        </div>
        <Scoreboard :players="game.scoreboard" :highlight-id="player.id" />
      </div>
    </div>

    <!-- Game over -->
    <div v-else-if="game.status === 'ended'" class="page-center">
      <div class="card end-card">
        <div class="logo">🏆 Game Over!</div>
        <Scoreboard :players="game.scoreboard" :highlight-id="player.id" :show-podium="true" />
        <RouterLink to="/" class="btn btn-primary btn-lg" style="width:100%;margin-top:24px;display:block;text-align:center">
          Play Again
        </RouterLink>
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
import { useGameStore } from '../stores/game.js'
import { usePlayerStore } from '../stores/player.js'
import { useSocket } from '../composables/useSocket.js'
import Timer from '../components/Timer.vue'
import Scoreboard from '../components/Scoreboard.vue'
import ScoreTable from '../components/ScoreTable.vue'

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

const nextSkipMultiplier = computed(() =>
  (1 + 0.25 * Math.min(myConsecutiveSkips.value, 4)).toFixed(2).replace(/\.?0+$/, '')
)

const onGameStarted = ({ totalQuestions }) => {
  game.totalQuestions = totalQuestions
  game.setStatus('starting')
  let c = 3
  const t = setInterval(() => { c--; countdown.value = c; if (c <= 0) clearInterval(t) }, 1000)
}
const onQuestion = data => {
  textAnswer.value = ''
  game.setQuestion(data)
}
const onAnswerReceived = result => {
  game.setMyAnswer(result)
  player.addScore(result.pointsAwarded)
  myConsecutiveSkips.value = result.consecutiveSkips
  myStreak.value = result.correctStreak
}
const onSkipConfirmed = ({ consecutiveSkips, nextMultiplier }) => {
  myConsecutiveSkips.value = consecutiveSkips
  game.setMyAnswer({ skipped: true, isCorrect: false, pointsAwarded: 0 })
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

.lobby-card { text-align: center; max-width: 380px; width: 100%; }
.player-avatar {
  width: 80px; height: 80px; border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  display: flex; align-items: center; justify-content: center;
  font-size: 1.8rem; font-weight: 900; margin: 0 auto 16px;
}
.lobby-card h2 { font-size: 1.5rem; margin-bottom: 8px; }
.room-info { margin: 16px 0; color: var(--text-muted); }
.room-code { color: var(--primary); letter-spacing: 3px; }
.waiting { color: var(--text-muted); margin-top: 24px; font-size: 0.95rem; }
.dots { display: flex; gap: 8px; justify-content: center; margin-top: 12px; }
.dots span {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--primary); animation: bounce 1.2s infinite;
}
.dots span:nth-child(2) { animation-delay: 0.2s; }
.dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }

.countdown-card { text-align: center; padding: 60px; }
.countdown { font-size: 5rem; font-weight: 900; color: var(--primary); }

.question-view { padding: 24px; max-width: 700px; margin: 0 auto; }
.q-header { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; flex-wrap: wrap; }
.q-header .badge { flex-shrink: 0; }
.skip-mult-badge {
  flex: 1; text-align: center;
  font-size: 0.8rem; font-weight: 700; color: #ffc832;
  background: rgba(255,200,50,0.1); padding: 4px 10px; border-radius: 999px;
}
.question-text { font-size: 1.5rem; font-weight: 700; margin-bottom: 28px; line-height: 1.4; }
.options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.option-btn {
  padding: 20px 16px; background: var(--surface); border: 2px solid var(--surface-2);
  border-radius: var(--radius); color: var(--text); font-size: 1rem; font-weight: 600;
  text-align: left; cursor: pointer; transition: all 0.15s;
}
.option-btn:hover { border-color: var(--primary); background: rgba(233,69,96,0.1); }
.text-answer { display: flex; gap: 12px; }
.text-answer input { flex: 1; }

.skip-btn {
  display: block; width: 100%; margin-top: 16px;
  padding: 12px; background: none; border: 2px dashed var(--surface-2);
  border-radius: var(--radius); color: var(--text-muted); font-size: 0.9rem;
  font-weight: 600; cursor: pointer; transition: all 0.15s; text-align: center;
}
.skip-btn:hover { border-color: #ffc832; color: #ffc832; }
.skip-next { color: #ffc832; }
.skip-locked { color: var(--danger); }

.answered-feedback {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; min-height: 60vh; gap: 8px;
}
.answered-feedback.correct { color: var(--success); }
.answered-feedback.incorrect { color: var(--danger); }
.answered-feedback.skipped { color: #ffc832; }
.feedback-icon { font-size: 5rem; }
.feedback-label { font-size: 1.8rem; font-weight: 700; }
.points { font-size: 2.5rem !important; color: var(--gold) !important; font-weight: 700; }
.points.penalty { color: var(--danger) !important; }
.skip-info { font-size: 1rem !important; color: #ffc832 !important; font-weight: 600; }
.waiting-text { font-size: 0.9rem !important; color: var(--text-muted) !important; font-weight: 400 !important; margin-top: 16px; }

.results-card { max-width: 600px; width: 100%; }
.correct-answer { color: var(--success); }
.my-result {
  display: flex; justify-content: space-between;
  padding: 12px 16px; border-radius: var(--radius); margin: 12px 0;
  font-weight: 700;
}
.my-result.correct { background: rgba(44,182,125,0.15); color: var(--success); }
.my-result.incorrect { background: rgba(233,69,96,0.15); color: var(--danger); }
.my-result.skipped { background: rgba(255,200,50,0.1); color: #ffc832; }
.penalty-text { color: var(--danger); }

.end-card { max-width: 600px; width: 100%; }
</style>
