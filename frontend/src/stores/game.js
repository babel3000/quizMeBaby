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
  const scoreboardVisible = ref(false)

  function setCode(c) { code.value = c }
  function setStatus(s) { status.value = s }
  function setPlayers(list) { players.value = list }

  function setQuestion(data) {
    currentQuestion.value = data.question
    questionIndex.value = data.index
    totalQuestions.value = data.total
    timeLimit.value = data.question.time_limit ?? 30
    roundType.value = data.roundType ?? 'normal'
    myAnswer.value = null
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
    scoreboardVisible.value = false
  }

  return {
    code, status, players, currentQuestion, questionIndex,
    totalQuestions, scoreboard, lastResult, myAnswer, timeLimit,
    roundType, scoreboardVisible,
    setCode, setStatus, setPlayers, setQuestion, setMyAnswer, setResults, endGame, reset,
  }
})
