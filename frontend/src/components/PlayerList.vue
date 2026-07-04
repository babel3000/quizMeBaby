<template>
  <div class="player-list" :class="{ large }">
    <div v-if="!players.length" class="empty">Waiting for players to join…</div>
    <TransitionGroup name="player" tag="div" class="grid">
      <div v-for="p in players" :key="p.id || p.socketId" class="player-chip">
        <div class="avatar">{{ initials(p.nickname) }}</div>
        <span class="name">{{ p.nickname }}</span>
      </div>
    </TransitionGroup>
    <div v-if="players.length" class="count">{{ players.length }} player{{ players.length !== 1 ? 's' : '' }} ready</div>
  </div>
</template>

<script setup>
defineProps({
  players: { type: Array, default: () => [] },
  large: { type: Boolean, default: false },
})

function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}
</script>

<style scoped>
.player-list { width: 100%; }
.empty { text-align: center; color: var(--text-muted); padding: 40px 0; }
.grid { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-bottom: 12px; }
.count { text-align: center; color: var(--text-muted); font-size: 0.9rem; }

.player-chip {
  display: flex; align-items: center; gap: 8px;
  background: var(--surface-2); border-radius: 999px;
  padding: 6px 14px 6px 6px;
}
.large .player-chip { padding: 10px 20px 10px 10px; }
.avatar {
  width: 32px; height: 32px; border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  display: flex; align-items: center; justify-content: center;
  font-size: 0.8rem; font-weight: 700;
}
.large .avatar { width: 48px; height: 48px; font-size: 1.1rem; }
.name { font-weight: 600; font-size: 0.9rem; }
.large .name { font-size: 1.1rem; }

.player-enter-active, .player-leave-active { transition: all 0.3s ease; }
.player-enter-from { opacity: 0; transform: scale(0.8); }
.player-leave-to { opacity: 0; transform: scale(0.8); }
</style>
