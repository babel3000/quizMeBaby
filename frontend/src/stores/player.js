import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePlayerStore = defineStore('player', () => {
  const id = ref(null)
  const nickname = ref('')
  const score = ref(0)
  const isHost = ref(false)

  function setPlayer(data) {
    id.value = data.id
    nickname.value = data.nickname
    score.value = data.score ?? 0
    isHost.value = data.isHost ?? false
  }

  function addScore(points) {
    score.value += points
  }

  function reset() {
    id.value = null
    nickname.value = ''
    score.value = 0
    isHost.value = false
  }

  return { id, nickname, score, isHost, setPlayer, addScore, reset }
})
