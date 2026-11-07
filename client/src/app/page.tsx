import { CalendarDays, TrendingUp, Users, Award } from 'lucide-react';
import { EventDiscoveryFeed } from '@/components/events/EventDiscoveryFeed';

const stats = [
  { icon: CalendarDays, label: 'Active Events', value: 'Live' },
  { icon: Users, label: 'Real-Time Sync', value: 'PostgreSQL' },
  { icon: TrendingUp, label: 'Queue Engine', value: 'FIFO' },
  { icon: Award, label: 'Entry Passes', value: 'QR Verified' },
];

export default function HomePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-fade-in">
      {/* ─── Hero Section ──────────────────────────────────────────────────── */}
      <section className="mb-12" aria-labelledby="hero-heading">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 mb-4 shadow-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              Campus Event Hub · Live
            </span>
          </div>

          <h1
            id="hero-heading"
            className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white mb-4 leading-tight tracking-tight"
          >
            Discover Campus{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-indigo-600">
              Events
            </span>
          </h1>

          <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed mb-8">
            Find, register, and attend hackathons, workshops, cultural fests,
            and technical events happening across your campus — all in one place with real-time seat tracking and verified entry passes.
          </p>

          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6" aria-label="Platform statistics">
            {stats.map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                className="card p-4 flex flex-col items-center text-center hover:shadow-md transition-shadow"
              >
                <Icon className="h-6 w-6 text-indigo-600 dark:text-indigo-400 mb-2" aria-hidden="true" />
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {value}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Divider ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 mb-8">
        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
          Upcoming Events
        </h2>
        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
      </div>

      {/* ─── Discovery Feed ──────────────────────────────────────────────────── */}
      <EventDiscoveryFeed />
    </div>
  );
}
