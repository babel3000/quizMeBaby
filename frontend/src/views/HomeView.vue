<template>
  <div class="home-screen">
    <div class="home-inner">
      <div class="home-brand">
        <div class="logo">PubQuiz</div>
        <p class="tagline">{{ $t('home.tagline') }}</p>
      </div>

      <div class="home-actions">
        <RouterLink to="/host" class="btn btn-primary btn-lg action-btn">
          {{ $t('home.host') }}
        </RouterLink>
        <RouterLink to="/join" class="btn btn-secondary btn-lg action-btn">
          {{ $t('home.join') }}
        </RouterLink>
        <RouterLink to="/manage" class="manage-link">
          {{ $t('home.manage') }}
        </RouterLink>
      </div>
    </div>
  </div>
</template>

<script setup>
import { RouterLink } from 'vue-router'
</script>

<style scoped>
.home-screen {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  padding-bottom: calc(40px + env(safe-area-inset-bottom, 0px));
}

.home-inner {
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: 56px;
}

.home-brand { text-align: center; }
.logo { font-size: 3.5rem; margin-bottom: 12px; }
.tagline { color: var(--text-muted); font-size: 1rem; }

.home-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-btn { width: 100%; display: flex; }

.manage-link {
  display: block;
  text-align: center;
  padding: 12px;
  color: var(--text-muted);
  font-size: 0.9rem;
  font-weight: 600;
  transition: color 0.15s;
}
.manage-link:hover { color: var(--text); }

/* Mobile: brand at top, actions toward bottom */
@media (max-width: 480px) {
  .home-screen {
    align-items: stretch;
    justify-content: space-between;
    padding: calc(72px + env(safe-area-inset-top, 0px)) 28px calc(48px + env(safe-area-inset-bottom, 0px));
  }

  .home-inner {
    gap: 0;
    flex: 1;
    justify-content: space-between;
    max-width: 100%;
  }

  .home-actions { gap: 14px; }
}
</style>
