import { QUIZ, QUIZ_BY_ID, QUIZ_REWARD, type QuizQuestion } from '../config/quiz';
import { addLog, type GameState } from './state';

export const QUIZ_PREFIX = 'quiz:';

/** Next question the player can answer: its fact is discovered and it hasn't been asked in this colony. */
export function nextQuiz(s: GameState): QuizQuestion | null {
  return QUIZ.find((q) => s.scienceSeen.includes(q.factId) && !s.quiz.answered.includes(q.id) && !s.scienceQueue.includes(QUIZ_PREFIX + q.id)) ?? null;
}

/** Queue a mission quiz (shown like a science card, pausing the colony). */
export function queueQuiz(s: GameState): boolean {
  const q = nextQuiz(s);
  if (!q) return false;
  s.scienceQueue.push(QUIZ_PREFIX + q.id);
  return true;
}

/** Record an answer. A correct first answer earns credits. */
export function answerQuiz(s: GameState, id: string, choice: number): { correct: boolean; reward: number } {
  const q = QUIZ_BY_ID[id];
  if (!q || s.quiz.answered.includes(id)) return { correct: false, reward: 0 };
  s.quiz.answered.push(id);
  const correct = choice === q.answer;
  let reward = 0;
  if (correct) {
    reward = QUIZ_REWARD;
    s.quiz.correct++;
    s.res.credits += reward;
    s.stats.creditsEarned += reward;
    addLog(s, `🧠 Correct! Mission Control sends +${reward} ₡.`, 'good');
  }
  return { correct, reward };
}
