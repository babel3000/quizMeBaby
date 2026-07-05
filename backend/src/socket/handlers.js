import { createSession, getSession, findSessionBySocket } from './gameSession.js'
import supabase from '../db/client.js'

export function registerHandlers(io, socket) {
  socket.on('create_session', async ({ nickname, teamName } = {}) => {
    console.log(`[create_session] socket=${socket.id} nickname=${nickname}`)
    const session = createSession()
    const displayName = teamName?.trim() || nickname?.trim() || 'Host'
    const player = session.addPlayer(socket.id, displayName, true)
    if (teamName?.trim()) session.hostPlaysAsTeam = true
    socket.join(session.code)
    socket.emit('session_created', {
      code: session.code,
      player,
      players: session.getPlayers(),
      language: session.language,
      hostPlaysAsTeam: session.hostPlaysAsTeam,
    })
  })

  socket.on('join_session', ({ code, nickname } = {}) => {
    const upper = code?.toUpperCase()
    const session = getSession(upper)
    if (!session) return socket.emit('join_error', { message: 'Room not found.' })
    if (session.status !== 'lobby') return socket.emit('join_error', { message: 'Game already in progress.' })
    if (!nickname?.trim()) return socket.emit('join_error', { message: 'Nickname required.' })

    const taken = session.getPlayers().some(p => p.nickname.toLowerCase() === nickname.trim().toLowerCase())
    if (taken) return socket.emit('join_error', { message: 'Nickname already taken.' })

    const player = session.addPlayer(socket.id, nickname.trim())
    socket.join(upper)

    socket.emit('joined_session', { code: upper, player, players: session.getPlayers(), language: session.language })
    socket.to(upper).emit('player_joined', { player, players: session.getPlayers() })
  })

  socket.on('start_game', async ({ code, numQuestions = 10, roundType = 'normal', categoryId } = {}) => {
    const session = getSession(code)
    if (!session || session.hostSocketId !== socket.id) return

    let query = supabase.from('questions').select('*')
    if (categoryId) query = query.eq('category_id', categoryId)
    const { data: allQuestions } = await query

    if (!allQuestions?.length) return socket.emit('start_error', { message: 'No questions available.' })

    // Shuffle and take numQuestions
    const shuffled = allQuestions.sort(() => Math.random() - 0.5)
    let questions = shuffled.slice(0, Math.min(numQuestions, shuffled.length))

    // Overlay translations when the room language isn't English
    if (session.language !== 'en') {
      const ids = questions.map(q => q.id)
      const { data: translations } = await supabase
        .from('question_translations')
        .select('question_id, text, correct_answer, options')
        .in('question_id', ids)
        .eq('locale', session.language)

      if (translations?.length) {
        const tMap = new Map(translations.map(t => [t.question_id, t]))
        questions = questions.map(q => {
          const t = tMap.get(q.id)
          return t ? { ...q, text: t.text, correct_answer: t.correct_answer, options: t.options } : q
        })
      }
    }

    session.startGame(questions, roundType)
    io.to(code).emit('game_started', { totalQuestions: questions.length, language: session.language, roundType })
    setTimeout(() => session.startQuestion(io), 3000)
  })

  socket.on('submit_answer', ({ code, answer } = {}) => {
    const session = getSession(code)
    if (!session || session.status !== 'active') return

    const result = session.submitAnswer(socket.id, answer)
    if (!result) return

    socket.emit('answer_received', {
      isCorrect: result.isCorrect,
      pointsAwarded: result.pointsAwarded,
      consecutiveSkips: result.consecutiveSkips,
      correctStreak: result.correctStreak,
      correctAnswer: result.correctAnswer,
    })

    const player = session.players.get(socket.id)
    const activePlayers = session.getPlayers().filter(p => !p.isHost || session.hostPlaysAsTeam)
    // Use io.to so the host receives count updates even when they submitted the answer themselves
    io.to(session.hostSocketId).emit('player_answered', {
      playerId: player?.id,
      nickname: player?.nickname,
      totalAnswered: session.questionAnswers.size,
      totalPlayers: activePlayers.length,
    })

    if (session.questionAnswers.size >= activePlayers.length) {
      session.revealResults(io)
    }
  })

  socket.on('skip_question', ({ code } = {}) => {
    const session = getSession(code)
    if (!session || session.status !== 'active') return

    const result = session.skipQuestion(socket.id)
    if (!result) return

    socket.emit('skip_confirmed', {
      consecutiveSkips: result.consecutiveSkips,
      nextMultiplier: result.nextMultiplier,
    })

    const player = session.players.get(socket.id)
    const activePlayers = session.getPlayers().filter(p => !p.isHost || session.hostPlaysAsTeam)
    io.to(session.hostSocketId).emit('player_answered', {
      playerId: player?.id,
      nickname: player?.nickname,
      skipped: true,
      totalAnswered: session.questionAnswers.size,
      totalPlayers: activePlayers.length,
    })

    if (session.questionAnswers.size >= activePlayers.length) {
      session.revealResults(io)
    }
  })

  const VALID_LANGUAGES = ['en', 'pt-PT']
  socket.on('set_language', ({ code, language } = {}) => {
    const session = getSession(code)
    if (!session || session.hostSocketId !== socket.id) return
    if (!VALID_LANGUAGES.includes(language)) return
    if (session.setLanguage(language)) {
      io.to(code).emit('language_changed', { language })
    }
  })

  socket.on('set_round_type', ({ code, roundType } = {}) => {
    const session = getSession(code)
    if (!session || session.hostSocketId !== socket.id) return
    if (session.setRoundType(roundType)) {
      io.to(code).emit('round_type_changed', { roundType })
    }
  })

  socket.on('show_scoreboard', ({ code } = {}) => {
    const session = getSession(code)
    if (!session || session.hostSocketId !== socket.id) return
    io.to(code).emit('show_scoreboard', {
      scoreboard: session.getScoreboard(),
      roundType: session.roundType,
    })
  })

  socket.on('hide_scoreboard', ({ code } = {}) => {
    const session = getSession(code)
    if (!session || session.hostSocketId !== socket.id) return
    io.to(code).emit('hide_scoreboard')
  })

  socket.on('reveal_results', ({ code } = {}) => {
    const session = getSession(code)
    if (!session || session.hostSocketId !== socket.id) return
    session.revealResults(io)
  })

  socket.on('next_question', ({ code } = {}) => {
    const session = getSession(code)
    if (!session || session.hostSocketId !== socket.id) return
    session.startQuestion(io)
  })

  socket.on('end_game', ({ code } = {}) => {
    const session = getSession(code)
    if (!session || session.hostSocketId !== socket.id) return
    session.endGame(io)
  })

  socket.on('disconnect', () => {
    const session = findSessionBySocket(socket.id)
    if (!session) return

    const player = session.removePlayer(socket.id)
    if (player) {
      io.to(session.code).emit('player_left', {
        playerId: player.id,
        nickname: player.nickname,
        players: session.getPlayers(),
      })
    }
  })
}
