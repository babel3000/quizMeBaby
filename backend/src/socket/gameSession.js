import { v4 as uuidv4 } from 'uuid'

const sessions = new Map()

const WRONG_PENALTY = 500
const FIRST_ANSWER_BONUS = 100
const VALID_ROUND_TYPES = ['normal', 'hot_streak', 'safety_net', 'lone_wolf', 'double_down', 'chaos']
const CHAOS_MODIFIERS = ['hot_streak', 'safety_net', 'lone_wolf', 'double_down']

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  } while (sessions.has(code))
  return code
}

export class GameSession {
  constructor() {
    this.code = generateCode()
    this.hostSocketId = null
    this.players = new Map()
    this.status = 'lobby'
    this.questions = []
    this.currentQuestionIndex = -1
    this.questionAnswers = new Map()
    this.questionStartTime = null
    this.timer = null
    this.roundType = 'normal'
    this.questionModifier = null
    this.firstCorrectThisQuestion = false
    this.loneWolfWinner = null
    this.language = 'en'
    this.hostPlaysAsTeam = false
    this.revealPending = false
    this.revealTimer = null
    this.nextQuestionTimeOverride = null
  }

  addPlayer(socketId, nickname, isHost = false) {
    const player = {
      id: uuidv4(),
      nickname,
      score: 0,
      isHost,
      connected: true,
      consecutiveSkips: 0,
      correctStreak: 0,
      scoreBeforeQuestion: 0,
      skippedThisQuestion: false,
    }
    this.players.set(socketId, player)
    if (isHost) this.hostSocketId = socketId
    return player
  }

  removePlayer(socketId) {
    const player = this.players.get(socketId)
    if (player) player.connected = false
    return player
  }

  getPlayers() {
    return Array.from(this.players.entries()).map(([socketId, p]) => ({ socketId, ...p }))
  }

  getScoreboard() {
    return this.getPlayers()
      .filter(p => !p.isHost || this.hostPlaysAsTeam)
      .sort((a, b) => b.score - a.score)
      .map((p, i) => ({
        id: p.id,
        nickname: p.nickname,
        score: p.score,
        rank: i + 1,
        delta: p.score - p.scoreBeforeQuestion,
        consecutiveSkips: p.consecutiveSkips,
        correctStreak: p.correctStreak,
        skippedThisQuestion: p.skippedThisQuestion,
      }))
  }

  getCurrentQuestion() {
    if (this.currentQuestionIndex < 0 || this.currentQuestionIndex >= this.questions.length) return null
    const q = this.questions[this.currentQuestionIndex]
    const { correct_answer, ...safeQuestion } = q
    return safeQuestion
  }

  startGame(questions, roundType = 'normal') {
    this.questions = questions
    this.roundType = roundType
    this.status = 'active'
    this.currentQuestionIndex = -1
  }

  previewQuestion(io) {
    this.currentQuestionIndex++
    if (this.roundType === 'chaos') {
      this.questionModifier = CHAOS_MODIFIERS[Math.floor(Math.random() * CHAOS_MODIFIERS.length)]
    } else {
      this.questionModifier = null
    }
    for (const player of this.players.values()) {
      player.scoreBeforeQuestion = player.score
      player.skippedThisQuestion = false
    }
    const question = this.getCurrentQuestion()
    if (!question) return false

    this.status = 'preview'

    const pending = {
      index: this.currentQuestionIndex,
      total: this.questions.length,
      roundType: this.roundType,
    }
    // Players/screen wait; only the host sees the question (+ answer) during preview
    io.to(this.code).except(this.hostSocketId).emit('question_pending', pending)
    io.to(this.hostSocketId).emit('question_preview', {
      ...pending,
      question: { ...question, correct_answer: this.questions[this.currentQuestionIndex].correct_answer },
      questionModifier: this.questionModifier,
    })
    return true
  }

  broadcastQuestion(io) {
    if (this.status !== 'preview') return false

    this.status = 'active'
    this.questionAnswers = new Map()
    this.questionStartTime = Date.now()
    this.firstCorrectThisQuestion = false
    this.loneWolfWinner = null
    this.revealPending = false
    if (this.revealTimer) { clearTimeout(this.revealTimer); this.revealTimer = null }

    const question = this.getCurrentQuestion()
    if (!question) return false

    io.to(this.code).emit('question', {
      index: this.currentQuestionIndex,
      total: this.questions.length,
      question,
      roundType: this.roundType,
      questionModifier: this.questionModifier,
    })

    const timeLimit = this.nextQuestionTimeOverride ?? this.questions[this.currentQuestionIndex].time_limit ?? 30
    this.nextQuestionTimeOverride = null
    this.timer = setTimeout(() => this.prepareReveal(io), timeLimit * 1000)
    return true
  }

  prepareReveal(io) {
    if (this.revealPending) return
    this.revealPending = true

    if (this.timer) { clearTimeout(this.timer); this.timer = null }

    io.to(this.code).emit('music_stop')
    io.to(this.code).emit('preparing_reveal', { countdown: 3 })

    this.revealTimer = setTimeout(() => {
      this.revealPending = false
      this.revealResults(io)
    }, 3000)
  }

  submitAnswer(socketId, answer) {
    if (this.questionAnswers.has(socketId)) return null

    const player = this.players.get(socketId)
    if (!player) return null

    const currentQ = this.questions[this.currentQuestionIndex]
    if (!currentQ) return null

    const timeTaken = (Date.now() - this.questionStartTime) / 1000
    const timeLimit = currentQ.time_limit || 30
    const isCorrect = answer.trim().toLowerCase() === currentQ.correct_answer.trim().toLowerCase()

    let pointsAwarded = 0
    const effectiveType = this.roundType === 'chaos' ? this.questionModifier : this.roundType

    if (isCorrect) {
      const speedRatio = Math.max(0, 1 - timeTaken / timeLimit)
      const speedPoints = Math.round(currentQ.points * 0.5 * speedRatio)
      let subtotal = currentQ.points + speedPoints

      const isFirst = !this.firstCorrectThisQuestion
      if (isFirst) this.firstCorrectThisQuestion = true
      if (isFirst && effectiveType !== 'lone_wolf') subtotal += FIRST_ANSWER_BONUS
      if (isFirst && effectiveType === 'lone_wolf') {
        this.loneWolfWinner = { id: player.id, nickname: player.nickname }
      }

      let roundMult = 1
      if (effectiveType === 'double_down') {
        roundMult = 2
      } else if (effectiveType === 'hot_streak') {
        roundMult = 1 + 0.25 * Math.min(player.correctStreak, 4)
      } else if (effectiveType === 'lone_wolf') {
        roundMult = isFirst ? 1 : 0
      }

      pointsAwarded = Math.round(subtotal * roundMult)
      player.correctStreak++
      player.consecutiveSkips = 0
    } else {
      if (effectiveType === 'safety_net') {
        pointsAwarded = 0
      } else {
        // Faster wrong answers cost more — mirrors the speed bonus for correct answers
        const speedRatio = Math.max(0, 1 - timeTaken / timeLimit)
        const speedMult = 0.5 + speedRatio  // 0.5 (slow) → 1.5 (instant)
        const skipPenaltyMult = 1 + 0.25 * player.consecutiveSkips
        pointsAwarded = -Math.round(WRONG_PENALTY * speedMult * skipPenaltyMult)
      }
      player.correctStreak = 0
      player.consecutiveSkips = 0
    }

    player.score += pointsAwarded

    const result = {
      answer,
      isCorrect,
      pointsAwarded,
      timeTaken,
      skipped: false,
      consecutiveSkips: player.consecutiveSkips,
      correctStreak: player.correctStreak,
      correctAnswer: isCorrect ? undefined : currentQ.correct_answer,
    }
    this.questionAnswers.set(socketId, result)
    return result
  }

  skipQuestion(socketId) {
    if (this.questionAnswers.has(socketId)) return null

    const player = this.players.get(socketId)
    if (!player) return null

    // Block skip if player has already hit the 4-skip limit
    if (player.consecutiveSkips >= 4) return null

    player.consecutiveSkips++
    player.correctStreak = 0
    player.skippedThisQuestion = true

    this.questionAnswers.set(socketId, {
      answer: null,
      isCorrect: false,
      pointsAwarded: 0,
      timeTaken: null,
      skipped: true,
      consecutiveSkips: player.consecutiveSkips,
      correctStreak: 0,
    })

    return {
      consecutiveSkips: player.consecutiveSkips,
      penaltyMultiplier: 1 + 0.25 * player.consecutiveSkips,
    }
  }

  rejoinPlayer(newSocketId, playerId) {
    let oldSocketId = null
    let playerData = null

    for (const [sid, p] of this.players.entries()) {
      if (p.id === playerId) {
        oldSocketId = sid
        playerData = p
        break
      }
    }

    if (!playerData) return null

    this.players.delete(oldSocketId)
    playerData.connected = true
    this.players.set(newSocketId, playerData)

    if (playerData.isHost) this.hostSocketId = newSocketId

    // Move any existing answer for this question to the new socket key
    if (this.questionAnswers.has(oldSocketId)) {
      this.questionAnswers.set(newSocketId, this.questionAnswers.get(oldSocketId))
      this.questionAnswers.delete(oldSocketId)
    }

    return playerData
  }

  getCurrentState(socketId) {
    const isHost = socketId === this.hostSocketId
    // During preview, only the host may see the question (with answer)
    let question = null
    if (this.status === 'preview' && isHost) {
      const q = this.getCurrentQuestion()
      if (q) {
        question = { ...q, correct_answer: this.questions[this.currentQuestionIndex].correct_answer }
      }
    } else if (this.status === 'active') {
      question = this.getCurrentQuestion()
    } else if (this.status === 'results') {
      question = this.getCurrentQuestion()
    }

    const myAnswer = this.questionAnswers.get(socketId) ?? null
    let lastResult = null

    if (this.status === 'results') {
      const currentQ = this.questions[this.currentQuestionIndex]
      lastResult = {
        correctAnswer: currentQ?.correct_answer,
        scoreboard: this.getScoreboard(),
        roundType: this.roundType,
        questionModifier: this.questionModifier,
        loneWolfWinner: this.loneWolfWinner,
        isLastQuestion: this.currentQuestionIndex >= this.questions.length - 1,
      }
    }

    return {
      status: this.status,
      question,
      questionIndex: this.currentQuestionIndex,
      totalQuestions: this.questions.length,
      scoreboard: this.getScoreboard(),
      players: this.getPlayers(),
      language: this.language,
      roundType: this.roundType,
      questionModifier: this.questionModifier,
      myAnswer,
      lastResult,
    }
  }

  setRoundType(type) {
    if (!VALID_ROUND_TYPES.includes(type)) return false
    this.roundType = type
    return true
  }

  setLanguage(lang) {
    if (this.status !== 'lobby') return false
    this.language = lang
    return true
  }

  revealResults(io) {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }

    const currentQ = this.questions[this.currentQuestionIndex]

    // Auto-penalise players who hit the 4-skip limit and didn't answer before time ran out
    for (const [socketId, player] of this.players.entries()) {
      if (player.consecutiveSkips >= 4 && !this.questionAnswers.has(socketId)) {
        // speedRatio=0: they waited the full timer, so minimum speed factor (×0.5)
        const penalty = Math.round(WRONG_PENALTY * 0.5 * (1 + 0.25 * player.consecutiveSkips))
        player.score -= penalty
        player.consecutiveSkips = 0
        player.correctStreak = 0
        this.questionAnswers.set(socketId, {
          answer: null,
          isCorrect: false,
          pointsAwarded: -penalty,
          timeTaken: null,
          skipped: false,
          forcedPenalty: true,
          consecutiveSkips: 0,
          correctStreak: 0,
        })
        io.to(socketId).emit('answer_received', {
          isCorrect: false,
          pointsAwarded: -penalty,
          consecutiveSkips: 0,
          correctStreak: 0,
          forcedPenalty: true,
        })
      }
    }

    const playerResults = this.getPlayers()
      .filter(p => !p.isHost || this.hostPlaysAsTeam)
      .map(p => {
        const ans = this.questionAnswers.get(p.socketId)
        return {
          id: p.id,
          nickname: p.nickname,
          score: p.score,
          answer: ans?.answer ?? null,
          isCorrect: ans?.isCorrect ?? false,
          pointsAwarded: ans?.pointsAwarded ?? 0,
          skipped: ans?.skipped ?? false,
          timeTaken: ans?.timeTaken ?? null,
        }
      })

    io.to(this.code).emit('results_revealed', {
      correctAnswer: currentQ.correct_answer,
      scoreboard: this.getScoreboard(),
      playerResults,
      roundType: this.roundType,
      questionModifier: this.questionModifier,
      loneWolfWinner: this.loneWolfWinner,
      isLastQuestion: this.currentQuestionIndex >= this.questions.length - 1,
    })
  }

  endGame(io) {
    this.status = 'finished'
    if (this.timer) clearTimeout(this.timer)
    if (this.revealTimer) clearTimeout(this.revealTimer)
    io.to(this.code).emit('game_ended', { scoreboard: this.getScoreboard() })
  }
}

export function createSession() {
  const session = new GameSession()
  sessions.set(session.code, session)
  return session
}

export function getSession(code) { return sessions.get(code) }
export function deleteSession(code) { sessions.delete(code) }

export function getActiveSessions() {
  return Array.from(sessions.values())
    .filter(s => s.status !== 'finished')
    .map(s => ({ code: s.code, status: s.status, playerCount: s.getPlayers().filter(p => !p.isHost).length }))
}

export function findSessionBySocket(socketId) {
  for (const session of sessions.values()) {
    if (session.players.has(socketId)) return session
  }
  return null
}
