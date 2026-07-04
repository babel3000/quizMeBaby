import { Router } from 'express'
import { searchTrack, getTrack } from '../services/spotify.js'
import { searchVideo, getVideo } from '../services/youtube.js'

const router = Router()

router.get('/spotify/search', async (req, res) => {
  const { q } = req.query
  if (!q) return res.status(400).json({ error: 'Query parameter q is required' })
  try {
    const tracks = await searchTrack(q)
    res.json(tracks)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/spotify/track/:id', async (req, res) => {
  try {
    const track = await getTrack(req.params.id)
    res.json(track)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/youtube/search', async (req, res) => {
  const { q } = req.query
  if (!q) return res.status(400).json({ error: 'Query parameter q is required' })
  try {
    const videos = await searchVideo(q)
    res.json(videos)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/youtube/video/:id', async (req, res) => {
  try {
    const video = await getVideo(req.params.id)
    if (!video) return res.status(404).json({ error: 'Video not found' })
    res.json(video)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
