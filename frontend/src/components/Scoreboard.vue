<template>
  <div class="scoreboard">
    <h3 class="title">Scoreboard</h3>

    <!-- Podium for top 3 -->
    <div v-if="showPodium && players.length >= 3" class="podium">
      <div class="podium-place second">
        <div class="podium-avatar">{{ initials(players[1]?.nickname) }}</div>
        <div class="podium-name">{{ players[1]?.nickname }}</div>
        <div class="podium-score">{{ players[1]?.score }}</div>
        <div class="podium-block p2">2</div>
      </div>
      <div class="podium-place first">
        <div class="podium-crown">👑</div>
        <div class="podium-avatar gold">{{ initials(players[0]?.nickname) }}</div>
        <div class="podium-name">{{ players[0]?.nickname }}</div>
        <div class="podium-score">{{ players[0]?.score }}</div>
        <div class="podium-block p1">1</div>
      </div>
      <div class="podium-place third">
        <div class="podium-avatar">{{ initials(players[2]?.nickname) }}</div>
        <div class="podium-name">{{ players[2]?.nickname }}</div>
        <div class="podium-score">{{ players[2]?.score }}</div>
        <div class="podium-block p3">3</div>
      </div>
    </div>

    <!-- List -->
    <div class="player-list">
      <div
        v-for="(p, i) in displayPlayers"
        :key="p.id || p.socketId"
        class="player-row"
        :class="{ highlighted: highlightId && p.id === highlightId }"
      >
        <span class="rank" :class="rankClass(i)">{{ i + 1 }}</span>
        <span class="name">
          {{ p.nickname }}
          <span v-if="p.correctStreak >= 2" class="streak-badge">
            🔥{{ p.correctStreak }}
          </span>
          <span v-if="p.consecutiveSkips > 0" class="skip-badge" :class="{ 'skip-badge-danger': p.consecutiveSkips >= 4 }">
            ↷{{ p.consecutiveSkips }}/4
          </span>
        </span>
        <span v-if="showDelta && p.delta !== undefined" class="delta" :class="deltaClass(p)">{{ deltaLabel(p) }}</span>
        <span class="score">{{ p.score.toLocaleString() }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  players: { type: Array, default: () => [] },
  showPodium: { type: Boolean, default: false },
  highlightId: { type: String, default: null },
  compact: { type: Boolean, default: true },
  showDelta: { type: Boolean, default: false },
})

function deltaClass(p) {
  if (p.skippedThisQuestion) return 'delta-skip'
  if (p.delta > 0) return 'delta-pos'
  if (p.delta < 0) return 'delta-neg'
  return 'delta-zero'
}

function deltaLabel(p) {
  if (p.skippedThisQuestion) return '—'
  if (p.delta > 0) return `+${p.delta.toLocaleString()}`
  if (p.delta < 0) return p.delta.toLocaleString()
  return '—'
}

const displayPlayers = computed(() => props.showPodium ? props.players.slice(3) : props.players)

function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function rankClass(i) {
  if (i === 0) return 'rank-gold'
  if (i === 1) return 'rank-silver'
  if (i === 2) return 'rank-bronze'
  return ''
}
</script>

<style scoped>
.scoreboard { width: 100%; }
.title { font-size: 1rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 16px; }

.podium { display: flex; align-items: flex-end; justify-content: center; gap: 8px; margin-bottom: 24px; }
.podium-place { display: flex; flex-direction: column; align-items: center; min-width: 100px; }
.podium-crown { font-size: 1.5rem; margin-bottom: 4px; }
.podium-avatar {
  width: 56px; height: 56px; border-radius: 50%;
  background: var(--surface-2); display: flex; align-items: center;
  justify-content: center; font-weight: 700; font-size: 1.1rem; margin-bottom: 6px;
}
.podium-avatar.gold { background: linear-gradient(135deg, #ffd700, #ff9500); }
.podium-name { font-size: 0.85rem; font-weight: 600; text-align: center; margin-bottom: 4px; }
.podium-score { font-size: 0.9rem; font-weight: 700; color: var(--text-muted); margin-bottom: 6px; }
.podium-block {
  width: 100%; min-width: 80px; display: flex; align-items: center;
  justify-content: center; font-weight: 900; font-size: 1.2rem; border-radius: 8px 8px 0 0;
}
.p1 { height: 70px; background: linear-gradient(180deg, #ffd700, #c8a600); color: #000; }
.p2 { height: 50px; background: var(--surface-2); }
.p3 { height: 36px; background: var(--surface); }

.player-list { display: flex; flex-direction: column; gap: 6px; }
.player-row {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px; background: var(--surface-2);
  border-radius: var(--radius); transition: background 0.2s;
}
.player-row.highlighted { background: rgba(233,69,96,0.15); border: 1px solid var(--primary); }
.rank {
  width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.8rem; font-weight: 700; background: var(--surface); flex-shrink: 0;
}
.rank-gold { background: #ffd700; color: #000; }
.rank-silver { background: #c0c0c0; color: #000; }
.rank-bronze { background: #cd7f32; color: #fff; }
.name { flex: 1; font-weight: 600; display: flex; align-items: center; gap: 6px; }
.streak-badge {
  font-size: 0.7rem; font-weight: 700; padding: 2px 7px; border-radius: 999px;
  background: rgba(255,159,67,0.15); color: #ff9f43; flex-shrink: 0;
}
.skip-badge {
  font-size: 0.7rem; font-weight: 700; padding: 2px 7px; border-radius: 999px;
  background: rgba(255,200,50,0.15); color: #ffc832; flex-shrink: 0;
}
.skip-badge-danger {
  background: rgba(233,69,96,0.18); color: var(--danger);
}
.delta { font-size: 0.85rem; font-weight: 700; min-width: 56px; text-align: right; }
.delta-pos  { color: var(--success); }
.delta-neg  { color: var(--danger); }
.delta-zero { color: var(--text-muted); }
.delta-skip { color: var(--text-muted); }
.score { font-weight: 700; color: var(--gold); }
</style>
