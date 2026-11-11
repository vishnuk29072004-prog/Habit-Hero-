import {
  eachDayOfInterval,
  format,
  getDay,
  startOfDay,
  subDays,
} from 'date-fns'
import { toDateKey } from '../utils/dateUtils'

export const STORAGE_KEY = 'habit-hero-data-v3'
export const nextGoalTarget = 15
export const completionGrowth = 12
export const weeklyConsistencyGrowth = 6

const habitDefs = [
  {
    id: 'h1',
    name: 'Morning Workout',
    description: 'Exercise for 30 minutes',
    icon: 'dumbbell',
    category: 'Health',
    frequency: 'Daily',
  },
  {
    id: 'h2',
    name: 'Read (30 mins)',
    description: 'Read a book for focused growth',
    icon: 'book',
    category: 'Learning',
    frequency: 'Daily',
  },
  {
    id: 'h3',
    name: 'Drink Water (2L)',
    description: 'Stay hydrated through the day',
    icon: 'droplets',
    category: 'Health',
    frequency: 'Daily',
  },
  {
    id: 'h4',
    name: 'Code / Learn',
    description: 'Practice coding skills',
    icon: 'code',
    category: 'Learning',
    frequency: 'Daily',
  },
  {
    id: 'h5',
    name: 'Sleep before 11 PM',
    description: 'Protect rest and recovery',
    icon: 'moon',
    category: 'Mental Health',
    frequency: 'Daily',
  },
  {
    id: 'h6',
    name: 'Meditation',
    description: 'Mindfulness for 10 minutes',
    icon: 'brain',
    category: 'Mental Health',
    frequency: 'Daily',
  },
  {
    id: 'h7',
    name: 'Plan Tomorrow',
    description: 'Prepare priorities for next day',
    icon: 'clipboard',
    category: 'Productivity',
    frequency: 'Daily',
  },
  {
    id: 'h8',
    name: 'Deep Work Block',
    description: 'Focused work session',
    icon: 'shield',
    category: 'Work',
    frequency: 'Weekly',
  },
  {
    id: 'h9',
    name: 'Write Journal',
    description: 'Reflect on the day',
    icon: 'pen',
    category: 'Productivity',
    frequency: 'Daily',
  },
  {
    id: 'h10',
    name: 'Stretching',
    description: 'Mobility and flexibility',
    icon: 'activity',
    category: 'Health',
    frequency: 'Daily',
  },
]

function seededBool(seed, threshold = 0.65) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x) < threshold
}

export function buildCheckinsForHabit(habit, today = new Date()) {
  const end = startOfDay(today)
  const start = subDays(end, 89)
  const days = eachDayOfInterval({ start, end })
  const checkins = {}
  const habitId = habit.id

  const weekDay =
    typeof habit.weekDay === 'number' ? habit.weekDay : getDay(start)

  days.forEach((day, index) => {
    const key = format(day, 'yyyy-MM-dd')
    if (habit.startDate && key < habit.startDate) return
    if (habit.frequency === 'Weekly' && getDay(day) !== weekDay) return

    const seed = habitId.charCodeAt(1) * 100 + index * 17
    const completed = seededBool(seed, 0.78 + (habitId === 'h1' ? 0.1 : 0))
    checkins[key] = {
      completed,
      notes:
        completed && seededBool(seed + 3, 0.15) ? 'Logged successfully' : '',
    }
  })

  const todayKey = toDateKey(end)
  const todayCompleted = ['h1', 'h2', 'h3', 'h6', 'h7', 'h9', 'h10'].includes(
    habitId
  )
  const todayScheduled =
    habit.frequency !== 'Weekly' || getDay(end) === weekDay
  if (todayScheduled && (!habit.startDate || todayKey >= habit.startDate)) {
    checkins[todayKey] = { completed: todayCompleted, notes: '' }
  }

  return checkins
}

export function createDefaultHabits(today = new Date()) {
  const startDate = format(subDays(startOfDay(today), 60), 'yyyy-MM-dd')
  return habitDefs.map((habit) => {
    const enriched = {
      ...habit,
      startDate,
      createdAt: startDate,
      archived: false,
      weekDay: habit.frequency === 'Weekly' ? 1 : undefined,
      checkins: {},
    }
    enriched.checkins = buildCheckinsForHabit(enriched, today)
    return enriched
  })
}

export const defaultHabits = createDefaultHabits()

export const notifications = [
  {
    id: 'n1',
    title: 'Streak milestone',
    message: 'You are approaching your streak goal!',
    time: '2h ago',
    unread: true,
  },
  {
    id: 'n2',
    title: 'Habit reminder',
    message: 'Some habits are still pending for today.',
    time: '4h ago',
    unread: true,
  },
  {
    id: 'n3',
    title: 'Weekly summary',
    message: 'Review your consistency insights this week.',
    time: '1d ago',
    unread: false,
  },
]

export function migrateCategory(category) {
  if (category === 'Lifestyle') return 'Mental Health'
  return category || 'Health'
}

export function normalizeHabit(habit, today = new Date()) {
  const startDate =
    habit.startDate ||
    format(subDays(startOfDay(today), 30), 'yyyy-MM-dd')
  return {
    id: habit.id || `h-${Date.now()}`,
    name: habit.name || 'Untitled Habit',
    description: habit.description || '',
    notes: habit.notes || '',
    icon: habit.icon || 'sparkles',
    category: migrateCategory(habit.category),
    frequency: habit.frequency === 'Weekly' ? 'Weekly' : 'Daily',
    startDate,
    createdAt: habit.createdAt || startDate,
    archived: Boolean(habit.archived),
    weekDay:
      typeof habit.weekDay === 'number'
        ? habit.weekDay
        : habit.frequency === 'Weekly'
          ? getDay(startOfDay(new Date(startDate)))
          : undefined,
    checkins: habit.checkins || {},
  }
}

export function createDefaultGoals(today = new Date()) {
  const end = startOfDay(today)
  const start = format(subDays(end, 29), 'yyyy-MM-dd')
  const endKey = format(end, 'yyyy-MM-dd')
  const created = start

  return [
    {
      id: 'g1',
      name: 'Build a Consistent Workout Routine',
      description: 'Workout for 15 days in a row',
      category: 'Health',
      icon: 'dumbbell',
      linkedHabitId: 'h1',
      targetType: 'consecutive_days',
      targetValue: 15,
      startDate: start,
      endDate: endKey,
      createdAt: created,
      notes: '',
      archived: false,
      completedAt: null,
    },
    {
      id: 'g2',
      name: 'Read Daily',
      description: 'Read for 30 days',
      category: 'Learning',
      icon: 'book',
      linkedHabitId: 'h2',
      targetType: 'completion_count',
      targetValue: 30,
      startDate: start,
      endDate: endKey,
      createdAt: created,
      notes: '',
      archived: false,
      completedAt: null,
    },
    {
      id: 'g3',
      name: 'Code Regularly',
      description: 'Practice coding 20 times',
      category: 'Learning',
      icon: 'code',
      linkedHabitId: 'h4',
      targetType: 'completion_count',
      targetValue: 20,
      startDate: start,
      endDate: endKey,
      createdAt: created,
      notes: '',
      archived: false,
      completedAt: null,
    },
    {
      id: 'g4',
      name: 'Improve Mental Health',
      description: 'Meditate on 10 days',
      category: 'Mental Health',
      icon: 'brain',
      linkedHabitId: 'h6',
      targetType: 'days_completed',
      targetValue: 10,
      startDate: start,
      endDate: endKey,
      createdAt: created,
      notes: '',
      archived: false,
      completedAt: null,
    },
  ]
}
