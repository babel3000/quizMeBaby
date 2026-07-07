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

  // Screen view: join the room as an observer only — no player record created
  socket.on('join_screen', ({ code } = {}) => {
    const upper = code?.toUpperCase()
    const session = getSession(upper)
    if (!session) return socket.emit('join_error', { message: 'Room not found.' })

    socket.join(upper)
    socket.emit('joined_session', {
      code: upper,
      player: null,
      players: session.getPlayers(),
      language: session.language,
    })
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

    // Attach all available translations so each client can render in their own language
    const ids = questions.map(q => q.id)
    const { data: allTranslations } = await supabase
      .from('question_translations')
      .select('question_id, locale, text, correct_answer, options')
      .in('question_id', ids)

    if (allTranslations?.length) {
      const tByQ = new Map()
      for (const t of allTranslations) {
        if (!tByQ.has(t.question_id)) tByQ.set(t.question_id, {})
        tByQ.get(t.question_id)[t.locale] = { text: t.text, options: t.options, correct_answer: t.correct_answer }
      }
      questions = questions.map(q => ({ ...q, translations: tByQ.get(q.id) ?? {} }))
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
      session.prepareReveal(io)
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
      session.prepareReveal(io)
    }
  })

  const VALID_LANGUAGES = ['en', 'pt-PT']
  socket.on('rejoin_session', ({ code, playerId } = {}) => {
    const upper = code?.toUpperCase()
    const session = getSession(upper)
    if (!session) return socket.emit('rejoin_error', { message: 'Room not found.' })
    if (session.status === 'finished') return socket.emit('rejoin_error', { message: 'Game already ended.' })

    const player = session.rejoinPlayer(socket.id, playerId)
    if (!player) return socket.emit('rejoin_error', { message: 'Player not found in session.' })

    socket.join(upper)

    const state = session.getCurrentState(socket.id)
    socket.emit('rejoined_session', { code: upper, player, ...state })

    // Notify others the player is back
    socket.to(upper).emit('player_joined', { player, players: session.getPlayers() })
  })

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
    session.prepareReveal(io)
  })

  socket.on('next_question', ({ code, timeOverride } = {}) => {
    const session = getSession(code)
    if (!session || session.hostSocketId !== socket.id) return
    if (timeOverride > 0) session.nextQuestionTimeOverride = timeOverride
    session.startQuestion(io)
  })

  socket.on('play_music', ({ code } = {}) => {
    const session = getSession(code)
    if (!session || session.hostSocketId !== socket.id) return
    io.to(code).emit('music_play')
  })

  socket.on('stop_music', ({ code } = {}) => {
    const session = getSession(code)
    if (!session || session.hostSocketId !== socket.id) return
    io.to(code).emit('music_stop')
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
