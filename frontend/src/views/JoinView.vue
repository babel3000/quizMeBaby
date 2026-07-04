<template>
  <div class="page-center">
    <div class="join-card card">
      <RouterLink to="/" class="back-link">← Back</RouterLink>
      <div class="logo">Join Game</div>

      <form @submit.prevent="join">
        <div class="field">
          <label>Room Code</label>
          <input
            v-model="code"
            type="text"
            placeholder="e.g. ABC123"
            maxlength="6"
            autocomplete="off"
            style="text-transform: uppercase; letter-spacing: 4px; font-size: 1.4rem; text-align: center;"
          />
        </div>
        <div class="field">
          <label>Your Nickname</label>
          <input v-model="nickname" type="text" placeholder="e.g. QuizKing" maxlength="20" />
        </div>

        <p v-if="error" class="error">{{ error }}</p>

        <button class="btn btn-primary btn-lg" style="width:100%;margin-top:8px" :disabled="loading">
          {{ loading ? 'Joining...' : 'Join Game 🎮' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useSocket } from '../composables/useSocket.js'
import { useGameStore } from '../stores/game.js'
import { usePlayerStore } from '../stores/player.js'

const router = useRouter()
const game = useGameStore()
const player = usePlayerStore()
const socket = useSocket()

const code = ref('')
const nickname = ref('')
const error = ref('')
const loading = ref(false)

const onJoined = ({ code: roomCode, player: me, players }) => {
  player.setPlayer(me)
  game.setCode(roomCode)
  game.setPlayers(players)
  game.setStatus('lobby')
  router.push('/play')
}
const onJoinError = ({ message }) => { error.value = message; loading.value = false }

onMounted(() => {
  socket.on('joined_session', onJoined)
  socket.on('join_error', onJoinError)
})

onUnmounted(() => {
  socket.off('joined_session', onJoined)
  socket.off('join_error', onJoinError)
})

function join() {
  error.value = ''
  if (!code.value.trim() || !nickname.value.trim()) {
    error.value = 'Both fields are required.'
    return
  }
  loading.value = true
  socket.emit('join_session', { code: code.value.toUpperCase(), nickname: nickname.value.trim() })
}
</script>

<style scoped>
.join-card {
  width: 100%;
  max-width: 400px;
}

.back-link {
  display: inline-block;
  color: var(--text-muted);
  font-size: 0.9rem;
  margin-bottom: 20px;
}

.back-link:hover { color: var(--text); }

.logo { margin-bottom: 28px; font-size: 1.8rem; }

.field {
  margin-bottom: 16px;
}

.field label {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.error {
  color: var(--danger);
  font-size: 0.9rem;
  margin-bottom: 8px;
}
</style>
