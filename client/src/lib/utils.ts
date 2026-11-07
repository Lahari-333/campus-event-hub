import type { EventCategory } from '@/types';

// ─── Date Formatting Utilities ─────────────────────────────────────────────

/**
 * Format an ISO date string to a human-readable date.
 * e.g. "Dec 1, 2026"
 */
export function formatDate(isoString: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(isoString));
}

/**
 * Format an ISO date string to a time string.
 * e.g. "9:00 AM"
 */
export function formatTime(isoString: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(isoString));
}

/**
 * Format event duration from start and end time ISO strings.
 * e.g. "Dec 1 · 9:00 AM – Dec 2 · 9:00 PM"
 */
export function formatEventDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);

  const isSameDay = startDate.toDateString() === endDate.toDateString();

  if (isSameDay) {
    return `${formatDate(start)} · ${formatTime(start)} – ${formatTime(end)}`;
  }

  return `${formatDate(start)} – ${formatDate(end)}`;
}

// ─── Capacity Utilities ────────────────────────────────────────────────────

export type CapacityStatus = 'available' | 'limited' | 'full' | 'waitlist';

/**
 * Determine the capacity status of an event.
 */
export function getCapacityStatus(
  registered: number,
  capacity: number,
  waitlistCapacity: number,
): CapacityStatus {
  if (registered >= capacity + waitlistCapacity) return 'full';
  if (registered >= capacity) return 'waitlist';
  if (registered / capacity >= 0.8) return 'limited';
  return 'available';
}

/**
 * Returns display metadata for a given capacity status.
 */
export function getCapacityMeta(status: CapacityStatus): {
  label: string;
  colorClass: string;
  barColorClass: string;
} {
  switch (status) {
    case 'available':
      return {
        label: 'Available',
        colorClass: 'text-emerald-600 dark:text-emerald-400',
        barColorClass: 'bg-emerald-500',
      };
    case 'limited':
      return {
        label: 'Filling Fast',
        colorClass: 'text-amber-600 dark:text-amber-400',
        barColorClass: 'bg-amber-500',
      };
    case 'waitlist':
      return {
        label: 'Waitlist',
        colorClass: 'text-orange-600 dark:text-orange-400',
        barColorClass: 'bg-orange-500',
      };
    case 'full':
      return {
        label: 'Full',
        colorClass: 'text-red-600 dark:text-red-400',
        barColorClass: 'bg-red-500',
      };
  }
}

// ─── Category Utilities ────────────────────────────────────────────────────

/**
 * Returns Tailwind badge color classes for event categories.
 */
export function getCategoryBadgeClasses(category: EventCategory | string): string {
  switch (category) {
    case 'Hackathon':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300';
    case 'Technical':
      return 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300';
    case 'Cultural':
      return 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300';
    case 'Workshop':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
    default:
      return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
  }
}
