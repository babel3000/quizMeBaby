<template>
  <div class="timer" :class="{ large, urgent: remaining <= 5 }">
    <svg class="ring" viewBox="0 0 36 36">
      <circle class="track" cx="18" cy="18" r="15.9" />
      <circle
        class="progress"
        cx="18" cy="18" r="15.9"
        :stroke-dasharray="`${pct} 100`"
      />
    </svg>
    <span class="seconds">{{ remaining }}</span>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  seconds: { type: Number, default: 30 },
  large: { type: Boolean, default: false },
})

const emit = defineEmits(['expired'])

const remaining = ref(props.seconds)
const pct = computed(() => (remaining.value / props.seconds) * 100)

let interval = null

onMounted(() => {
  interval = setInterval(() => {
    if (remaining.value <= 0) {
      clearInterval(interval)
      emit('expired')
      return
    }
    remaining.value--
  }, 1000)
})

onUnmounted(() => clearInterval(interval))
</script>

<style scoped>
.timer {
  position: relative;
  width: 52px; height: 52px;
  display: inline-flex; align-items: center; justify-content: center;
}
.timer.large { width: 80px; height: 80px; }

.ring { width: 100%; height: 100%; transform: rotate(-90deg); }
.track { fill: none; stroke: var(--surface-2); stroke-width: 3; }
.progress {
  fill: none; stroke: var(--primary); stroke-width: 3;
  stroke-linecap: round;
  transition: stroke-dasharray 0.9s linear;
}
.urgent .progress { stroke: var(--danger); }

.seconds {
  position: absolute;
  font-size: 1rem; font-weight: 700;
}
.large .seconds { font-size: 1.5rem; }
.urgent .seconds { color: var(--danger); }
</style>
