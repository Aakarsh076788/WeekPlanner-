import {addDays, minutes, taskComplete, type Planner, type Task} from './model';
import type {ChangePlan} from './direct-planning';

export type Phase = 'now' | 'upcoming' | 'anytime' | 'pending' | 'done';
export const phaseLabels: Record<Phase, string> = {
  now: 'Happening now', upcoming: 'Coming up', anytime: 'Anytime',
  pending: 'Pending · make a new plan', done: 'Completed',
};
export const phaseOrder: Phase[] = ['now', 'upcoming', 'anytime', 'pending', 'done'];

export function kolkataClock(instant = new Date()) {
  const local = new Date(instant.getTime() + 330 * 60000).toISOString();
  return {date: local.slice(0, 10), time: local.slice(11, 16), instant};
}

export function taskPhase(task: Task, instant = new Date()): Phase {
  if (taskComplete(task)) return 'done';
  const {date} = kolkataClock(instant);
  if (!task.start) return task.date < date ? 'pending' : 'anytime';
  const start = Date.parse(`${task.date}T${task.start}:00+05:30`);
  // A start-only session stays open until the end of its local day.
  const end = task.end ? start + minutes(task) * 60000
    : Date.parse(`${addDays(task.date, 1)}T00:00:00+05:30`);
  if (instant.getTime() >= end) return 'pending';
  if (instant.getTime() >= start) return 'now';
  return 'upcoming';
}

export function dailyWork(state: Planner, selected: string, instant = new Date()) {
  const isToday = selected === kolkataClock(instant).date;
  return Object.values(state.weeks).flatMap(w => w.tasks).filter(task => {
    if (task.date === selected) return true;
    const phase = taskPhase(task, instant);
    return isToday && task.date < selected && (phase === 'pending' || phase === 'now');
  }).sort((a, b) => a.date.localeCompare(b.date)
    || (a.start || '24:00').localeCompare(b.start || '24:00') || a.title.localeCompare(b.title));
}

export function movePlan(task: Task, date: string, start = task.start, end = task.end): ChangePlan {
  return {summary: `Move ${task.title} to ${date}`, remove_ids: [], sessions: [{
    existing_session_id: task.id, date, start, end, category: task.category,
    title: task.title, topic: task.topic, notes: task.notes,
    problems: task.problems.map(({title, url}) => ({title, url})),
  }]};
}
