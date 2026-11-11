import {
  Activity,
  BookOpen,
  Brain,
  ClipboardList,
  Code2,
  Droplets,
  Dumbbell,
  Moon,
  PenLine,
  Shield,
  Sparkles,
  Target,
} from 'lucide-react'

export const HABIT_ICON_MAP = {
  dumbbell: Dumbbell,
  book: BookOpen,
  droplets: Droplets,
  code: Code2,
  moon: Moon,
  brain: Brain,
  clipboard: ClipboardList,
  shield: Shield,
  pen: PenLine,
  activity: Activity,
  sparkles: Sparkles,
  target: Target,
}

export function getHabitIcon(iconKey) {
  return HABIT_ICON_MAP[iconKey] || Sparkles
}
