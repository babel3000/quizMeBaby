<template>
  <div class="page-center">
    <div class="home-card card">
      <div class="logo">PubQuiz</div>
      <p class="tagline">The ultimate live quiz experience</p>

      <div class="actions">
        <RouterLink to="/host">
          <button class="btn btn-primary btn-lg" style="width:100%">
            🎙️ Host a Game
          </button>
        </RouterLink>
        <RouterLink to="/join">
          <button class="btn btn-secondary btn-lg" style="width:100%">
            🎮 Join a Game
          </button>
        </RouterLink>
        <RouterLink to="/manage" class="manage-link">
          ⚙️ Manage Questions
        </RouterLink>
      </div>
    </div>
  </div>
</template>

<script setup>
import { RouterLink } from 'vue-router'
</script>

<style scoped>
.home-card {
  width: 100%;
  max-width: 420px;
  text-align: center;
}

.logo {
  font-size: 3rem;
  margin-bottom: 8px;
}

.tagline {
  color: var(--text-muted);
  margin-bottom: 40px;
  font-size: 1rem;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.manage-link {
  display: block;
  text-align: center;
  padding-top: 4px;
  color: var(--text-muted);
  font-size: 0.9rem;
  font-weight: 600;
  transition: color 0.15s;
}
.manage-link:hover { color: var(--text); }
</style>
