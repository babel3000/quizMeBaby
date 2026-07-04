import { createSession, getSession, findSessionBySocket } from './gameSession.js'
import supabase from '../db/client.js'

export function registerHandlers(io, socket) {
  socket.on('create_session', async ({ nickname } = {}) => {
    const session = createSession()
    const player = session.addPlayer(socket.id, nickname?.trim() || 'Host', true)
    socket.join(session.code)
    socket.emit('session_created', {
      code: session.code,
      player,
      players: session.getPlayers(),
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

    socket.emit('joined_session', { code: upper, player, players: session.getPlayers() })
    socket.to(upper).emit('player_joined', { player, players: session.getPlayers() })
  })

  socket.on('start_game', async ({ code, questionIds } = {}) => {
    const session = getSession(code)
    if (!session || session.hostSocketId !== socket.id) return

    let questions
    if (questionIds?.length) {
      const { data } = await supabase.from('questions').select('*').in('id', questionIds)
      questions = data
    } else {
      const { data } = await supabase.from('questions').select('*').limit(10)
      questions = data
    }

    if (!questions?.length) return socket.emit('start_error', { message: 'No questions available.' })

    session.startGame(questions)
    io.to(code).emit('game_started', { totalQuestions: questions.length })
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
    })

    const player = session.players.get(socket.id)
    const nonHostPlayers = session.getPlayers().filter(p => !p.isHost)
    socket.to(session.hostSocketId).emit('player_answered', {
      playerId: player?.id,
      nickname: player?.nickname,
      totalAnswered: session.questionAnswers.size,
      totalPlayers: nonHostPlayers.length,
    })

    if (session.questionAnswers.size >= nonHostPlayers.length) {
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
    const nonHostPlayers = session.getPlayers().filter(p => !p.isHost)
    socket.to(session.hostSocketId).emit('player_answered', {
      playerId: player?.id,
      nickname: player?.nickname,
      skipped: true,
      totalAnswered: session.questionAnswers.size,
      totalPlayers: nonHostPlayers.length,
    })

    if (session.questionAnswers.size >= nonHostPlayers.length) {
      session.revealResults(io)
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
    const hasNext = session.startQuestion(io)
    if (!hasNext) session.endGame(io)
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
