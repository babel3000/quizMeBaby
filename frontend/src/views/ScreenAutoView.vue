<template>
  <div class="screen-auto">
    <div class="logo">PubQuiz</div>

    <div v-if="sessions.length === 0" class="state-box">
      <div class="spinner" />
      <p>{{ $t('screen.lookingForGame') }}</p>
    </div>

    <div v-else-if="sessions.length === 1" class="state-box">
      <div class="spinner" />
      <p>{{ $t('screen.connecting') }}</p>
    </div>

    <div v-else class="session-list">
      <p class="pick-label">{{ $t('screen.multipleGames') }}</p>
      <button
        v-for="s in sessions"
        :key="s.code"
        class="session-btn"
        @click="goTo(s.code)"
      >
        <span class="session-code">{{ s.code }}</span>
        <span class="session-meta">{{ s.playerCount }} {{ $t('screen.players') }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const sessions = ref([])
let pollTimer = null

async function poll() {
  try {
    const res = await fetch('/api/session/active')
    const data = await res.json()
    sessions.value = data.sessions ?? []

    if (sessions.value.length === 1) {
      goTo(sessions.value[0].code)
    }
  } catch {
    // backend not reachable yet — keep polling
  }
}

function goTo(code) {
  clearInterval(pollTimer)
  router.replace(`/screen/${code}`)
}

onMounted(() => {
  poll()
  pollTimer = setInterval(poll, 2000)
})

onUnmounted(() => clearInterval(pollTimer))
</script>

<style scoped>
.screen-auto {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 32px;
  background: var(--bg);
}

.logo {
  font-size: 3rem;
  font-weight: 900;
  background: linear-gradient(135deg, var(--primary), #a855f7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.state-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: var(--text-muted);
  font-size: 1.1rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255,255,255,0.1);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.pick-label {
  color: var(--text-muted);
  font-size: 1rem;
  margin-bottom: 8px;
  text-align: center;
}

.session-list {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.session-btn {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 32px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  cursor: pointer;
  color: var(--text);
  transition: border-color 0.15s;
  min-width: 220px;
}

.session-btn:hover { border-color: var(--primary); }

.session-code {
  font-size: 1.4rem;
  font-weight: 900;
  letter-spacing: 3px;
  color: var(--primary);
}

.session-meta {
  font-size: 0.9rem;
  color: var(--text-muted);
}
</style>
