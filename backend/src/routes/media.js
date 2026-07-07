import { Router } from 'express'
import { searchTracks, getArtistRadio } from '../services/deezer.js'
import { searchVideo, getVideo } from '../services/youtube.js'

const router = Router()

router.get('/deezer/search', async (req, res) => {
  const { q } = req.query
  if (!q) return res.status(400).json({ error: 'Query parameter q is required' })
  try {
    const tracks = await searchTracks(q)
    res.json(tracks)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/deezer/radio', async (req, res) => {
  const { artistId } = req.query
  if (!artistId) return res.status(400).json({ error: 'Query parameter artistId is required' })
  try {
    const tracks = await getArtistRadio(artistId)
    res.json(tracks)
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
