import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useGameStore = defineStore('game', () => {
  const code = ref(null)
  const status = ref('idle')
  const players = ref([])
  const currentQuestion = ref(null)
  const questionIndex = ref(0)
  const totalQuestions = ref(0)
  const scoreboard = ref([])
  const lastResult = ref(null)
  const myAnswer = ref(null)
  const timeLimit = ref(30)
  const roundType = ref('normal')
  const questionModifier = ref(null)
  const scoreboardVisible = ref(false)
  const language = ref('en')
  const playerLanguage = ref(localStorage.getItem('playerLanguage') || null)
  const hostPlaysAsTeam = ref(false)
  const moderationMode = ref('host')
  const readyForNext = ref({ readyCount: 0, total: 0 })
  const isReadyForNext = ref(false)

  function setLanguage(lang) { language.value = lang }
  function setPlayerLanguage(lang) {
    playerLanguage.value = lang
    if (lang) localStorage.setItem('playerLanguage', lang)
    else localStorage.removeItem('playerLanguage')
  }
  function setHostPlaysAsTeam(val) { hostPlaysAsTeam.value = val }
  function setCode(c) { code.value = c }
  function setStatus(s) { status.value = s }
  function setPlayers(list) { players.value = list }

  function setQuestion(data) {
    currentQuestion.value = data.question
    questionIndex.value = data.index
    totalQuestions.value = data.total
    timeLimit.value = data.question.time_limit ?? 30
    roundType.value = data.roundType ?? 'normal'
    questionModifier.value = data.questionModifier ?? null
    moderationMode.value = data.moderationMode ?? moderationMode.value
    myAnswer.value = null
    isReadyForNext.value = false
    readyForNext.value = { readyCount: 0, total: 0 }
    scoreboardVisible.value = false
    status.value = 'question'
  }

  function setMyAnswer(result) {
    myAnswer.value = result
  }

  function setResults(data) {
    lastResult.value = data
    scoreboard.value = data.scoreboard
    roundType.value = data.roundType ?? roundType.value
    questionModifier.value = data.questionModifier ?? null
    moderationMode.value = data.moderationMode ?? moderationMode.value
    readyForNext.value = data.readyForNext ?? { readyCount: 0, total: 0 }
    isReadyForNext.value = false
    status.value = 'results'
  }

  function endGame(data) {
    scoreboard.value = data.scoreboard
    status.value = 'ended'
  }

  function reset() {
    code.value = null
    status.value = 'idle'
    players.value = []
    currentQuestion.value = null
    questionIndex.value = 0
    totalQuestions.value = 0
    scoreboard.value = []
    lastResult.value = null
    myAnswer.value = null
    roundType.value = 'normal'
    questionModifier.value = null
    scoreboardVisible.value = false
    language.value = 'en'
    hostPlaysAsTeam.value = false
    moderationMode.value = 'host'
    readyForNext.value = { readyCount: 0, total: 0 }
    isReadyForNext.value = false
    // playerLanguage is intentionally NOT reset — it's a persistent device preference
  }

  return {
    code, status, players, currentQuestion, questionIndex,
    totalQuestions, scoreboard, lastResult, myAnswer, timeLimit,
    roundType, questionModifier, scoreboardVisible, language, playerLanguage, hostPlaysAsTeam,
    moderationMode, readyForNext, isReadyForNext,
    setCode, setStatus, setPlayers, setQuestion, setMyAnswer, setResults, endGame, reset,
    setLanguage, setPlayerLanguage, setHostPlaysAsTeam,
  }
})
