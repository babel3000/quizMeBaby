<template>
  <div class="lang-screen">
    <div class="lang-inner">
      <button v-if="isChanging" class="back-btn" @click="router.back()">← Back</button>

      <div class="lang-brand">
        <div class="logo">PubQuiz</div>
        <p class="lang-prompt">Choose your language</p>
        <p class="lang-prompt-pt">Escolhe o teu idioma</p>
      </div>

      <div class="lang-tiles">
        <button
          v-for="lang in SUPPORTED_LANGUAGES"
          :key="lang.code"
          class="lang-tile"
          :class="{ active: lang.code === currentLocale }"
          @click="pick(lang.code)"
        >
          <span class="lang-flag">{{ lang.flag }}</span>
          <span class="lang-name">{{ lang.label }}</span>
          <span v-if="lang.code === currentLocale" class="active-dot" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { SUPPORTED_LANGUAGES, getSavedLocale, setLocale } from '../i18n/index.js'

const router = useRouter()
const { locale } = useI18n()

const isChanging = !!getSavedLocale()
const currentLocale = locale.value

function pick(code) {
  setLocale(code)
  router.push('/home')
}
</script>

<style scoped>
.back-btn {
  position: absolute;
  top: calc(20px + env(safe-area-inset-top, 0px));
  left: 20px;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  padding: 8px 4px;
  transition: color 0.15s;
}
.back-btn:hover { color: var(--text); }

.lang-screen {
  position: relative;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  padding-top: calc(40px + env(safe-area-inset-top, 0px));
  padding-bottom: calc(40px + env(safe-area-inset-bottom, 0px));
}

.lang-inner {
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 52px;
}

.lang-brand { text-align: center; }
.logo { font-size: 3.5rem; margin-bottom: 16px; }

.lang-prompt {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-muted);
  margin: 0;
}
.lang-prompt-pt {
  font-size: 0.95rem;
  color: var(--text-muted);
  opacity: 0.6;
  margin: 4px 0 0;
}

.lang-tiles {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  width: 100%;
}

.lang-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 32px 16px;
  background: var(--surface);
  border: 2px solid var(--surface-2);
  border-radius: calc(var(--radius) * 1.5);
  cursor: pointer;
  transition: border-color 0.15s, transform 0.1s, background 0.15s;
  -webkit-tap-highlight-color: transparent;
}

.lang-tile:hover {
  border-color: var(--primary);
  background: var(--surface-2);
}

.lang-tile:active {
  transform: scale(0.97);
}

.lang-tile.active {
  border-color: var(--primary);
  background: rgba(233,69,96,0.08);
}

.lang-flag { font-size: 3rem; line-height: 1; }

.lang-name {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text);
}

.active-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--primary);
}

/* Mobile: stack vertically if tiles are too narrow */
@media (max-width: 340px) {
  .lang-tiles { grid-template-columns: 1fr; }
}
</style>
