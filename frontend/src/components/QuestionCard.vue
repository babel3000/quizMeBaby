<template>
  <div class="question-card card" :class="{ large }">
    <div v-if="question.type !== 'multiple_choice'" class="media-block">
      <audio v-if="question.type === 'music' && question.media_url" controls :src="question.media_url" />
      <iframe
        v-else-if="question.type === 'video' && question.media_url"
        :src="question.media_url"
        allow="autoplay; encrypted-media"
        allowfullscreen
      />
      <img v-else-if="question.type === 'image' && question.media_url" :src="question.media_url" alt="Question image" />
    </div>

    <p class="question-text">{{ question.text }}</p>

    <div v-if="question.options && !showAnswer" class="options-display">
      <div v-for="(opt, i) in question.options" :key="opt" class="option-display">
        <span class="option-letter">{{ letters[i] }}</span>
        <span>{{ opt }}</span>
      </div>
    </div>

    <div v-if="showAnswer && correctAnswer" class="answer-reveal">
      <span class="answer-label">Answer</span>
      <span class="answer-text">{{ correctAnswer }}</span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  question: { type: Object, required: true },
  showAnswer: { type: Boolean, default: false },
  correctAnswer: { type: String, default: null },
  large: { type: Boolean, default: false },
})

const letters = ['A', 'B', 'C', 'D']
</script>

<style scoped>
.question-card { width: 100%; }
.question-card.large .question-text { font-size: 2rem; }
.question-card.large .option-display { font-size: 1.2rem; padding: 16px 20px; }

.media-block { margin-bottom: 20px; }
.media-block audio { width: 100%; }
.media-block iframe { width: 100%; height: 360px; border: none; border-radius: var(--radius); }
.media-block img { max-width: 100%; border-radius: var(--radius); max-height: 320px; object-fit: cover; }

.question-text { font-size: 1.3rem; font-weight: 700; line-height: 1.4; margin-bottom: 20px; }

.options-display { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.option-display {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px; background: var(--surface-2);
  border-radius: var(--radius); font-weight: 600;
}
.option-letter {
  width: 30px; height: 30px; border-radius: 50%;
  background: var(--accent); display: flex; align-items: center;
  justify-content: center; font-size: 0.85rem; font-weight: 700; flex-shrink: 0;
}

.answer-reveal {
  margin-top: 16px; padding: 16px 20px;
  background: rgba(44,182,125,0.15); border-radius: var(--radius);
  border-left: 4px solid var(--success);
  display: flex; align-items: center; gap: 16px;
}
.answer-label { font-size: 0.8rem; font-weight: 700; color: var(--success); text-transform: uppercase; letter-spacing: 0.1em; }
.answer-text { font-size: 1.2rem; font-weight: 700; color: var(--success); }
</style>
