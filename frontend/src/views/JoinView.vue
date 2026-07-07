<template>
  <div class="page-center">
    <div class="join-card card">
      <RouterLink to="/home" class="back-link">{{ $t('back') }}</RouterLink>
      <div class="logo">{{ $t('join.title') }}</div>

      <form @submit.prevent="join">
        <div class="field">
          <label>{{ $t('join.roomCode') }}</label>
          <input
            v-model="code"
            type="text"
            :placeholder="$t('join.roomCodePlaceholder')"
            maxlength="6"
            autocomplete="off"
            inputmode="text"
            class="code-input"
          />
        </div>
        <div class="field">
          <label>{{ $t('join.teamName') }}</label>
          <input
            v-model="nickname"
            type="text"
            :placeholder="$t('join.teamNamePlaceholder')"
            maxlength="20"
          />
        </div>

        <p v-if="error" class="error">{{ error }}</p>

        <button class="btn btn-primary btn-lg" style="width:100%;margin-top:16px" :disabled="loading">
          {{ loading ? $t('join.submitting') : $t('join.submit') }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { setLocale } from '../i18n/index.js'
import { useSocket } from '../composables/useSocket.js'
import { useGameStore } from '../stores/game.js'
import { usePlayerStore } from '../stores/player.js'

const router = useRouter()
const { t } = useI18n()
const game = useGameStore()
const player = usePlayerStore()
const socket = useSocket()

const code = ref('')
const nickname = ref('')
const error = ref('')
const loading = ref(false)

const onJoined = ({ code: roomCode, player: me, players, language }) => {
  player.setPlayer(me)
  game.setCode(roomCode)
  game.setPlayers(players)
  game.setLanguage(language ?? 'en')
  setLocale(language ?? 'en')
  game.setStatus('lobby')
  localStorage.setItem('reconnect', JSON.stringify({ code: roomCode, playerId: me.id }))
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
    error.value = t('join.required')
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
  min-height: 44px;
  line-height: 44px;
}

.back-link:hover { color: var(--text); }

.logo { margin-bottom: 32px; }

.field { margin-bottom: 18px; }

.field label {
  display: block;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-muted);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.code-input {
  text-transform: uppercase;
  letter-spacing: 6px;
  font-size: 1.5rem !important;
  text-align: center;
  font-weight: 700;
}

.error {
  color: var(--danger);
  font-size: 0.9rem;
  margin-top: 4px;
}

/* Mobile: push form toward top, extra spacing feels roomier */
@media (max-width: 480px) {
  .logo { margin-bottom: 40px; }
  .field { margin-bottom: 24px; }
  .back-link { margin-bottom: 28px; }
}
</style>
