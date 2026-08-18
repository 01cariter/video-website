import type { StudioTemplate } from './types';

export const STUDIO_TEMPLATES: StudioTemplate[] = [
  {
    id: 'focus-lab',
    title: '25-minute focus experiment',
    description: 'Turn one week of study sessions into a practical visual plan',
    category: 'Study',
    prompt:
      'Design a seven-day focus experiment canvas with four 25-minute sessions per day, task priorities, distraction notes, completion rates, and a weekly review. Use a restrained black, white, and gray editorial style with paper texture and handwritten marks.',
    cover:
      'https://images.unsplash.com/photo-1456324504439-367cee3b3c32?auto=format&fit=crop&w=1600&q=85',
  },
  {
    id: 'book-cards',
    title: 'Break a book into six knowledge cards',
    description: 'Turn chapter structure and key ideas into a review set',
    category: 'Study',
    prompt:
      'Organize the book I am reading into six knowledge cards: the core thesis, three key concepts, one counterintuitive idea, and one action list. Establish the information hierarchy first, then create a restrained editorial design worth saving.',
    cover:
      'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=1600&q=85',
  },
  {
    id: 'exam-route',
    title: '30-day exam roadmap',
    description: 'Map goals, weak areas, and daily tasks in one place',
    category: 'Study',
    prompt:
      'Create a roadmap for an exam in 30 days. Break goals down by week and mark weak topics, daily practice volume, three mock exams, and rest days. Use a clear timeline, progress checkpoints, and review areas.',
    cover:
      'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1600&q=85',
  },
  {
    id: 'running-form',
    title: 'Running form review',
    description: 'Analyze cadence, foot strike, and posture',
    category: 'Training',
    prompt:
      'Create a running-form review canvas covering the start, arm swing, torso, foot strike, and cadence. Include space for training video frames, issue annotations, coaching notes, and goals for the next session. Make it feel like a professional sports analysis report.',
    cover:
      'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=1600&q=85',
  },
  {
    id: 'basketball-shot',
    title: 'Jump-shot breakdown',
    description: 'Review the kinetic chain and release consistency frame by frame',
    category: 'Training',
    prompt:
      'Create a basketball shooting breakdown with consecutive frames for the gather, knee bend, jump, release, and follow-through. Annotate the kinetic chain, common errors, shooting percentage, and three correction goals for the next session.',
    cover:
      'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1600&q=85',
  },
  {
    id: 'mobility-week',
    title: 'Seven-day mobility plan',
    description: 'Plan movements, duration, and recovery feedback by body area',
    category: 'Training',
    prompt:
      'Design a seven-day mobility canvas focused on one body area per day. Include a warm-up, three main movements, hold times, difficulty adjustments, and post-session feedback. Keep it quiet, spacious, and easy to check off each day.',
    cover:
      'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=1600&q=85',
  },
];
