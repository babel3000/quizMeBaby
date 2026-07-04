<template>
  <div class="manage-view">
    <div class="manage-container">

      <!-- Header -->
      <div class="manage-header">
        <div>
          <RouterLink to="/" class="back-link">← Back</RouterLink>
          <h1 class="page-title">Question Manager</h1>
          <p class="subtitle">{{ filteredQuestions.length }} question{{ filteredQuestions.length !== 1 ? 's' : '' }}</p>
        </div>
        <button class="btn btn-primary" @click="openAdd">+ Add Question</button>
      </div>

      <!-- Category filter -->
      <div class="filter-tabs">
        <button
          class="tab"
          :class="{ active: selectedCategory === null }"
          @click="selectedCategory = null"
        >All</button>
        <button
          v-for="cat in categories"
          :key="cat.id"
          class="tab"
          :class="{ active: selectedCategory === cat.id }"
          @click="selectedCategory = cat.id"
        >{{ cat.icon }} {{ cat.name }}</button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="empty-state">Loading questions…</div>

      <!-- Empty -->
      <div v-else-if="!filteredQuestions.length" class="empty-state">
        No questions yet.
        <button class="btn btn-primary" style="margin-top:16px" @click="openAdd">Add the first one</button>
      </div>

      <!-- Question list -->
      <div v-else class="question-list">
        <div v-for="q in filteredQuestions" :key="q.id" class="question-card card">
          <div class="q-meta">
            <span class="badge" :class="typeBadgeClass(q.type)">{{ typeLabel(q.type) }}</span>
            <span v-if="q.categories" class="cat-label">{{ q.categories.icon }} {{ q.categories.name }}</span>
            <span class="points-label">{{ q.points }} pts · {{ q.time_limit }}s</span>
          </div>
          <p class="q-text">{{ q.text }}</p>
          <div v-if="q.options" class="q-options">
            <span
              v-for="opt in q.options"
              :key="opt"
              class="q-option"
              :class="{ correct: opt === q.correct_answer }"
            >{{ opt }}</span>
          </div>
          <div class="q-answer">
            <span class="answer-label">Answer</span>
            <span class="answer-value">{{ q.correct_answer }}</span>
          </div>
          <div class="q-actions">
            <button class="btn btn-secondary btn-sm" @click="openEdit(q)">Edit</button>
            <button class="btn btn-danger btn-sm" @click="confirmDelete(q)">Delete</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <Teleport to="body">
      <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
        <div class="modal card">
          <div class="modal-header">
            <h2>{{ editingId ? 'Edit Question' : 'Add Question' }}</h2>
            <button class="close-btn" @click="closeModal">✕</button>
          </div>

          <form @submit.prevent="saveQuestion" class="modal-form">
            <!-- Type -->
            <div class="field">
              <label>Type</label>
              <div class="type-grid">
                <label v-for="t in questionTypes" :key="t.value" class="type-option" :class="{ active: form.type === t.value }">
                  <input type="radio" v-model="form.type" :value="t.value" hidden />
                  <span class="type-icon">{{ t.icon }}</span>
                  <span>{{ t.label }}</span>
                </label>
              </div>
            </div>

            <!-- Category -->
            <div class="field">
              <label>Category</label>
              <select v-model="form.category_id">
                <option value="">— No category —</option>
                <option v-for="cat in categories" :key="cat.id" :value="cat.id">
                  {{ cat.icon }} {{ cat.name }}
                </option>
              </select>
            </div>

            <!-- Question text -->
            <div class="field">
              <label>Question</label>
              <textarea v-model="form.text" rows="2" placeholder="Enter your question…" required />
            </div>

            <!-- Multiple choice options -->
            <div v-if="form.type === 'multiple_choice'" class="field">
              <label>Options <span class="hint">(click the circle to mark correct)</span></label>
              <div class="options-editor">
                <div v-for="(opt, i) in form.options" :key="i" class="option-row">
                  <button
                    type="button"
                    class="correct-toggle"
                    :class="{ selected: opt !== '' && form.correct_answer === opt }"
                    @click="form.correct_answer = opt"
                    :title="opt !== '' && form.correct_answer === opt ? 'Correct answer' : 'Mark as correct'"
                  >{{ opt !== '' && form.correct_answer === opt ? '✓' : '○' }}</button>
                  <input
                    v-model="form.options[i]"
                    type="text"
                    :placeholder="`Option ${i + 1}`"
                    @input="syncCorrectAnswer"
                  />
                  <button
                    v-if="form.options.length > 2"
                    type="button"
                    class="remove-opt"
                    @click="removeOption(i)"
                  >✕</button>
                </div>
                <button
                  v-if="form.options.length < 4"
                  type="button"
                  class="btn btn-secondary btn-sm"
                  @click="form.options.push('')"
                >+ Add option</button>
              </div>
            </div>

            <!-- Correct answer (non-MC) -->
            <div v-else class="field">
              <label>Correct Answer</label>
              <input v-model="form.correct_answer" type="text" placeholder="The answer players must match" required />
            </div>

            <!-- Media URL -->
            <div v-if="form.type !== 'multiple_choice'" class="field">
              <label>
                {{ form.type === 'music' ? 'Audio URL (Spotify preview)' : form.type === 'video' ? 'YouTube Embed URL' : 'Image URL' }}
              </label>
              <input v-model="form.media_url" type="text" :placeholder="mediaPlaceholder" />
            </div>

            <!-- Points & time -->
            <div class="field-row">
              <div class="field">
                <label>Points</label>
                <input v-model.number="form.points" type="number" min="100" max="5000" step="100" />
              </div>
              <div class="field">
                <label>Time limit (seconds)</label>
                <input v-model.number="form.time_limit" type="number" min="5" max="120" step="5" />
              </div>
            </div>

            <p v-if="formError" class="form-error">{{ formError }}</p>

            <div class="modal-actions">
              <button type="button" class="btn btn-secondary" @click="closeModal">Cancel</button>
              <button type="submit" class="btn btn-primary" :disabled="saving">
                {{ saving ? 'Saving…' : (editingId ? 'Save Changes' : 'Add Question') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Delete confirmation -->
    <Teleport to="body">
      <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
        <div class="modal card confirm-modal">
          <h2>Delete question?</h2>
          <p class="confirm-text">« {{ deleteTarget.text }} »</p>
          <p class="confirm-hint">This cannot be undone.</p>
          <div class="modal-actions">
            <button class="btn btn-secondary" @click="deleteTarget = null">Cancel</button>
            <button class="btn btn-danger" :disabled="saving" @click="deleteQuestion">
              {{ saving ? 'Deleting…' : 'Delete' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import axios from 'axios'

const questions = ref([])
const categories = ref([])
const loading = ref(true)
const saving = ref(false)
const selectedCategory = ref(null)
const showModal = ref(false)
const editingId = ref(null)
const deleteTarget = ref(null)
const formError = ref('')

const questionTypes = [
  { value: 'multiple_choice', label: 'Multiple Choice', icon: '🔤' },
  { value: 'music',           label: 'Music',           icon: '🎵' },
  { value: 'video',           label: 'Video',           icon: '📺' },
  { value: 'image',           label: 'Image',           icon: '🖼️' },
]

const defaultForm = () => ({
  type: 'multiple_choice',
  category_id: '',
  text: '',
  correct_answer: '',
  options: ['', '', '', ''],
  media_url: '',
  points: 1000,
  time_limit: 30,
})

const form = ref(defaultForm())

const filteredQuestions = computed(() =>
  selectedCategory.value
    ? questions.value.filter(q => q.category_id === selectedCategory.value)
    : questions.value
)

const mediaPlaceholder = computed(() => {
  if (form.value.type === 'music') return 'https://p.scdn.co/mp3-preview/...'
  if (form.value.type === 'video') return 'https://www.youtube.com/embed/VIDEO_ID'
  return 'https://example.com/image.jpg'
})

async function loadData() {
  loading.value = true
  const [qRes, cRes] = await Promise.all([
    axios.get('/api/questions?limit=200'),
    axios.get('/api/questions/categories'),
  ])
  questions.value = qRes.data
  categories.value = cRes.data
  loading.value = false
}

function openAdd() {
  editingId.value = null
  form.value = defaultForm()
  formError.value = ''
  showModal.value = true
}

function openEdit(q) {
  editingId.value = q.id
  form.value = {
    type: q.type,
    category_id: q.category_id ?? '',
    text: q.text,
    correct_answer: q.correct_answer,
    options: q.options ? [...q.options] : ['', '', '', ''],
    media_url: q.media_url ?? '',
    points: q.points,
    time_limit: q.time_limit,
  }
  formError.value = ''
  showModal.value = true
}

function closeModal() {
  showModal.value = false
}

function syncCorrectAnswer() {
  if (!form.value.options.includes(form.value.correct_answer)) {
    form.value.correct_answer = ''
  }
}

function removeOption(i) {
  form.value.options.splice(i, 1)
  if (!form.value.options.includes(form.value.correct_answer)) {
    form.value.correct_answer = ''
  }
}

async function saveQuestion() {
  formError.value = ''
  const f = form.value

  if (!f.text.trim()) return (formError.value = 'Question text is required.')
  if (!f.correct_answer.trim()) return (formError.value = 'Correct answer is required.')

  if (f.type === 'multiple_choice') {
    const filled = f.options.filter(o => o.trim())
    if (filled.length < 2) return (formError.value = 'At least 2 options required.')
    if (!filled.includes(f.correct_answer)) return (formError.value = 'Mark one option as the correct answer.')
  }

  const payload = {
    text: f.text.trim(),
    type: f.type,
    category_id: f.category_id || null,
    correct_answer: f.correct_answer.trim(),
    options: f.type === 'multiple_choice' ? f.options.filter(o => o.trim()) : null,
    media_url: f.media_url.trim() || null,
    points: f.points,
    time_limit: f.time_limit,
  }

  saving.value = true
  try {
    if (editingId.value) {
      const { data } = await axios.put(`/api/questions/${editingId.value}`, payload)
      const idx = questions.value.findIndex(q => q.id === editingId.value)
      if (idx !== -1) questions.value[idx] = { ...questions.value[idx], ...data }
    } else {
      const { data } = await axios.post('/api/questions', payload)
      questions.value.unshift(data)
    }
    closeModal()
  } catch (err) {
    formError.value = err.response?.data?.error ?? 'Failed to save. Please try again.'
  } finally {
    saving.value = false
  }
}

function confirmDelete(q) {
  deleteTarget.value = q
}

async function deleteQuestion() {
  saving.value = true
  try {
    await axios.delete(`/api/questions/${deleteTarget.value.id}`)
    questions.value = questions.value.filter(q => q.id !== deleteTarget.value.id)
    deleteTarget.value = null
  } catch {
    deleteTarget.value = null
  } finally {
    saving.value = false
  }
}

function typeBadgeClass(type) {
  return { 'badge-primary': type === 'multiple_choice', 'badge-music': type === 'music', 'badge-video': type === 'video', 'badge-image': type === 'image' }
}

function typeLabel(type) {
  return { multiple_choice: 'Multiple Choice', music: '🎵 Music', video: '📺 Video', image: '🖼️ Image' }[type] ?? type
}

onMounted(loadData)
</script>

<style scoped>
.manage-view { min-height: 100vh; padding: 40px 24px; }
.manage-container { max-width: 860px; margin: 0 auto; }

.back-link { color: var(--text-muted); font-size: 0.9rem; display: inline-block; margin-bottom: 8px; }
.back-link:hover { color: var(--text); }
.page-title { font-size: 2rem; font-weight: 900; }
.subtitle { color: var(--text-muted); font-size: 0.9rem; margin-top: 4px; }
.manage-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }

.filter-tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px; }
.tab {
  padding: 7px 16px; border-radius: 999px; font-size: 0.85rem; font-weight: 600;
  background: var(--surface); color: var(--text-muted); cursor: pointer;
  border: 2px solid transparent; transition: all 0.15s;
}
.tab.active { background: var(--primary); color: white; border-color: var(--primary); }
.tab:hover:not(.active) { border-color: var(--surface-2); color: var(--text); }

.empty-state { text-align: center; padding: 80px 0; color: var(--text-muted); display: flex; flex-direction: column; align-items: center; }

.question-list { display: flex; flex-direction: column; gap: 12px; }
.question-card { padding: 20px 24px; }
.q-meta { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
.badge-music { background: rgba(123,94,167,0.2); color: #b39ddb; }
.badge-video { background: rgba(255,82,82,0.2); color: #ff8a80; }
.badge-image { background: rgba(0,188,212,0.2); color: #80deea; }
.cat-label { color: var(--text-muted); font-size: 0.85rem; }
.points-label { color: var(--text-muted); font-size: 0.8rem; margin-left: auto; }
.q-text { font-size: 1.05rem; font-weight: 600; margin-bottom: 10px; }
.q-options { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
.q-option {
  padding: 4px 12px; border-radius: 999px; font-size: 0.85rem;
  background: var(--surface-2); color: var(--text-muted);
}
.q-option.correct { background: rgba(44,182,125,0.15); color: var(--success); font-weight: 700; }
.q-answer { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.answer-label { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--success); }
.answer-value { font-weight: 600; color: var(--success); }
.q-actions { display: flex; gap: 8px; }
.btn-sm { padding: 7px 16px; font-size: 0.85rem; }
.btn-danger { background: rgba(233,69,96,0.15); color: var(--danger); }
.btn-danger:hover { background: rgba(233,69,96,0.3); }

/* Modal */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.7);
  display: flex; align-items: center; justify-content: center;
  z-index: 100; padding: 24px;
}
.modal {
  width: 100%; max-width: 560px; max-height: 90vh;
  overflow-y: auto; padding: 32px;
}
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.modal-header h2 { font-size: 1.4rem; font-weight: 800; }
.close-btn { background: none; color: var(--text-muted); font-size: 1.2rem; padding: 4px 8px; border-radius: 6px; }
.close-btn:hover { background: var(--surface-2); color: var(--text); }

.modal-form { display: flex; flex-direction: column; gap: 18px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.field label { font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; }
.hint { font-weight: 400; text-transform: none; letter-spacing: 0; }
textarea, select {
  width: 100%; padding: 12px 16px; background: var(--surface-2);
  border: 2px solid transparent; border-radius: var(--radius);
  color: var(--text); font-family: inherit; font-size: 0.95rem;
  transition: border-color 0.2s; resize: vertical;
}
textarea:focus, select:focus { outline: none; border-color: var(--primary); }
select option { background: var(--surface-2); }

.type-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.type-option {
  display: flex; align-items: center; gap: 8px; padding: 10px 14px;
  background: var(--surface-2); border-radius: var(--radius);
  cursor: pointer; border: 2px solid transparent; transition: all 0.15s;
  font-size: 0.9rem; font-weight: 600;
}
.type-option.active { border-color: var(--primary); background: rgba(233,69,96,0.1); }
.type-icon { font-size: 1.1rem; }

.options-editor { display: flex; flex-direction: column; gap: 8px; }
.option-row { display: flex; align-items: center; gap: 8px; }
.correct-toggle {
  width: 32px; height: 32px; flex-shrink: 0; border-radius: 50%;
  background: var(--surface-2); font-size: 0.9rem; font-weight: 700;
  color: var(--text-muted); display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.correct-toggle.selected { background: var(--success); color: white; }
.option-row input { flex: 1; }
.remove-opt { color: var(--text-muted); background: none; font-size: 1rem; padding: 4px 6px; border-radius: 4px; }
.remove-opt:hover { color: var(--danger); }

.form-error { color: var(--danger); font-size: 0.9rem; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px; }

.confirm-modal { max-width: 400px; text-align: center; }
.confirm-modal h2 { margin-bottom: 12px; }
.confirm-text { font-style: italic; color: var(--text-muted); margin-bottom: 8px; }
.confirm-hint { font-size: 0.85rem; color: var(--danger); margin-bottom: 24px; }
.confirm-modal .modal-actions { justify-content: center; }
</style>
