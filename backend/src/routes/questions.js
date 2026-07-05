import { Router } from 'express'
import supabase from '../db/client.js'

const router = Router()

router.get('/', async (req, res) => {
  const { category_id, type, search, limit = 20, offset = 0 } = req.query
  let query = supabase.from('questions').select('*, categories(name, type, icon)')

  if (category_id) query = query.eq('category_id', category_id)
  if (type) query = query.eq('type', type)
  if (search) query = query.ilike('text', `%${search}%`)

  const { data, error } = await query.range(Number(offset), Number(offset) + Number(limit) - 1)
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.get('/count', async (req, res) => {
  const { category_id, type, search } = req.query
  let query = supabase.from('questions').select('*', { count: 'exact', head: true })

  if (category_id) query = query.eq('category_id', category_id)
  if (type) query = query.eq('type', type)
  if (search) query = query.ilike('text', `%${search}%`)

  const { count, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json({ count })
})

router.get('/categories', async (_req, res) => {
  const { data, error } = await supabase.from('categories').select('*').order('name')
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('questions')
    .select('*, categories(name, type, icon)')
    .eq('id', req.params.id)
    .single()
  if (error) return res.status(404).json({ error: 'Question not found' })
  res.json(data)
})

router.post('/', async (req, res) => {
  const { text, type, category_id, correct_answer, options, media_url, points, time_limit } = req.body
  if (!text || !type || !correct_answer) {
    return res.status(400).json({ error: 'text, type and correct_answer are required' })
  }

  const { data, error } = await supabase
    .from('questions')
    .insert({ text, type, category_id, correct_answer, options, media_url, points, time_limit })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

router.put('/:id', async (req, res) => {
  const allowed = ['text', 'type', 'category_id', 'correct_answer', 'options', 'media_url', 'points', 'time_limit']
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)))

  const { data, error } = await supabase
    .from('questions')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('questions').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.status(204).send()
})

export default router
