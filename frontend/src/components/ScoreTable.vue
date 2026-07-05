<template>
  <Teleport to="body">
    <div v-if="visible" class="st-overlay">
      <div class="st-container">

        <div class="st-header">
          <h2 class="st-title">Scoreboard</h2>
          <span class="rt-badge" :class="`rt-${roundType}`">{{ roundTypeLabel }}</span>
        </div>

        <div class="st-body">
          <div v-for="(team, i) in scoreboard" :key="team.id" class="st-row">
            <!-- Rank -->
            <span class="st-rank" :class="rankClass(i)">
              {{ i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1 }}
            </span>

            <!-- Name + badges -->
            <div class="st-name-col">
              <span class="st-name">{{ team.nickname }}</span>
              <div class="st-badges">
                <span
                  v-if="team.consecutiveSkips > 0"
                  class="badge-skip"
                  :class="{ locked: team.consecutiveSkips >= 4 }"
                >
                  {{ team.consecutiveSkips >= 4 ? '⚠️' : '↷' }}
                  skip ×{{ skipMultiplier(team.consecutiveSkips) }}{{ team.consecutiveSkips >= 4 ? ' — locked' : '' }}
                </span>
                <span v-if="team.correctStreak > 1" class="badge-streak">
                  🔥 {{ team.correctStreak }}
                </span>
              </div>
            </div>

            <!-- Delta -->
            <span class="st-delta" :class="deltaClass(team)">{{ deltaLabel(team) }}</span>

            <!-- Score -->
            <span class="st-score" :class="{ negative: team.score < 0 }">
              {{ team.score.toLocaleString() }}
            </span>
          </div>
        </div>

        <div v-if="isHost" class="st-footer">
          <button class="btn btn-secondary" @click="$emit('hide')">Hide</button>
          <template v-if="!isLastQuestion">
            <button class="btn btn-primary" @click="$emit('next-question')">Next question →</button>
          </template>
          <template v-else>
            <button class="btn btn-secondary" @click="$emit('new-round')">New Round</button>
            <button class="btn btn-primary" @click="$emit('end-game')">End Game 🏆</button>
          </template>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  scoreboard: { type: Array, default: () => [] },
  roundType: { type: String, default: 'normal' },
  isHost: { type: Boolean, default: false },
  isLastQuestion: { type: Boolean, default: false },
})

defineEmits(['hide', 'next-question', 'new-round', 'end-game'])

const ROUND_TYPE_LABELS = {
  normal:      'Normal round',
  hot_streak:  '🔥 Hot Streak round',
  safety_net:  '🛡️ Safety Net round',
  lone_wolf:   '🐺 Lone Wolf round',
  double_down: '⚡ Double Down round',
}

const roundTypeLabel = computed(() => ROUND_TYPE_LABELS[props.roundType] ?? props.roundType)

function skipMultiplier(skips) {
  return (1 + 0.25 * Math.min(skips, 4)).toFixed(2).replace(/\.?0+$/, '')
}

function rankClass(i) {
  if (i === 0) return 'rank-gold'
  if (i === 1) return 'rank-silver'
  if (i === 2) return 'rank-bronze'
  return 'rank-num'
}

function deltaClass(team) {
  if (team.skippedThisQuestion) return 'delta-skip'
  if (team.delta > 0) return 'delta-pos'
  if (team.delta < 0) return 'delta-neg'
  return 'delta-zero'
}

function deltaLabel(team) {
  if (team.skippedThisQuestion) return 'skipped'
  if (team.delta > 0) return `+${team.delta.toLocaleString()}`
  if (team.delta < 0) return team.delta.toLocaleString()
  return '—'
}
</script>

<style scoped>
.st-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(10, 9, 18, 0.97);
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
  animation: fadeIn 0.2s ease;
}
@keyframes fadeIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }

.st-container {
  width: 100%; max-width: 680px;
  display: flex; flex-direction: column; gap: 0;
}

.st-header {
  display: flex; align-items: center; gap: 16px;
  margin-bottom: 28px;
}
.st-title {
  font-size: 2rem; font-weight: 900; letter-spacing: -0.5px;
}
.rt-badge {
  padding: 5px 14px; border-radius: 999px;
  font-size: 0.85rem; font-weight: 700;
  background: var(--surface-2); color: var(--text-muted);
}
.rt-badge.rt-hot_streak  { background: rgba(255,140,0,0.15); color: #ffaa33; }
.rt-badge.rt-safety_net  { background: rgba(44,182,125,0.15); color: var(--success); }
.rt-badge.rt-lone_wolf   { background: rgba(180,100,220,0.15); color: #c47de0; }
.rt-badge.rt-double_down { background: rgba(233,69,96,0.15); color: var(--primary); }

.st-body {
  display: flex; flex-direction: column; gap: 8px;
  margin-bottom: 32px;
}

.st-row {
  display: grid;
  grid-template-columns: 48px 1fr auto auto;
  align-items: center; gap: 12px;
  padding: 14px 16px;
  background: var(--surface);
  border-radius: var(--radius);
}

.st-rank {
  font-size: 1.3rem; text-align: center; font-weight: 700;
}
.rank-num {
  font-size: 0.9rem; color: var(--text-muted);
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--surface-2);
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto;
}

.st-name-col {
  display: flex; flex-direction: column; gap: 4px; min-width: 0;
}
.st-name {
  font-weight: 700; font-size: 1rem;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.st-badges {
  display: flex; gap: 6px; flex-wrap: wrap;
}
.badge-skip {
  font-size: 0.72rem; font-weight: 700;
  padding: 2px 8px; border-radius: 999px;
  background: rgba(255,200,50,0.15); color: #ffc832;
}
.badge-skip.locked {
  background: rgba(233,69,96,0.15); color: var(--primary);
}
.badge-streak {
  font-size: 0.72rem; font-weight: 700;
  padding: 2px 8px; border-radius: 999px;
  background: rgba(255,140,0,0.15); color: #ffaa33;
}

.st-delta {
  font-size: 0.9rem; font-weight: 700; text-align: right; min-width: 64px;
}
.delta-pos  { color: var(--success); }
.delta-neg  { color: var(--danger); }
.delta-zero { color: var(--text-muted); }
.delta-skip { color: var(--text-muted); font-weight: 400; font-style: italic; font-size: 0.8rem; }

.st-score {
  font-size: 1.1rem; font-weight: 900; text-align: right;
  min-width: 80px; color: var(--gold);
}
.st-score.negative { color: var(--danger); }

.st-footer {
  display: flex; justify-content: flex-end; gap: 12px;
  border-top: 1px solid var(--surface-2); padding-top: 24px;
}
</style>
