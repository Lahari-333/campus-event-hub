'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MapPin,
  Calendar,
  Users,
  Clock,
  CheckCircle2,
  Hourglass,
  Loader2,
  Ban,
  ArrowRight,
} from 'lucide-react';
import type { Event, RegistrationStatus } from '@/types';
import {
  formatDate,
  formatTime,
  getCapacityStatus,
  getCapacityMeta,
  getCategoryBadgeClasses,
} from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { registerForEventApi } from '@/lib/api';

interface EventCardProps {
  event: Event;
  userRegistration?: {
    status: RegistrationStatus;
    waitlistPosition?: number | null;
  } | null;
  onRegisterSuccess?: () => void;
}

export function EventCard({ event, userRegistration, onRegisterSuccess }: EventCardProps) {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [localReg, setLocalReg] = useState(userRegistration);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const registered = event.registeredCount ?? 0;
  const waitlisted = event.waitlistedCount ?? 0;
  const isPrimaryOpen = registered < event.capacity;
  const isWaitlistOpen =
    !isPrimaryOpen && event.waitlistCapacity > 0 && waitlisted < event.waitlistCapacity;
  const isSoldOut = !isPrimaryOpen && (!event.waitlistCapacity || waitlisted >= event.waitlistCapacity);
  const remainingWaitlistSlots = Math.max(0, event.waitlistCapacity - waitlisted);

  const fillPercent = Math.min((registered / event.capacity) * 100, 100);

  const activeRegistration = localReg || userRegistration;

  const handleRegisterAction = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await registerForEventApi(event.id);
      setLocalReg({
        status: res.status,
        waitlistPosition: res.waitlistPosition,
      });
      if (onRegisterSuccess) {
        onRegisterSuccess();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <article
      className="card flex flex-col h-full overflow-hidden hover:shadow-lg transition-shadow duration-300 group"
      aria-label={`Event: ${event.title}`}
    >
      {/* ─── Category Header Strip ──────────────────────────────────────── */}
      <div
        className={`h-1.5 w-full ${
          event.category === 'Hackathon'
            ? 'bg-purple-500'
            : event.category === 'Technical'
            ? 'bg-sky-500'
            : event.category === 'Cultural'
            ? 'bg-pink-500'
            : event.category === 'Workshop'
            ? 'bg-emerald-500'
            : 'bg-slate-400'
        }`}
        aria-hidden="true"
      />

      <div className="p-5 flex flex-col flex-1">
        {/* ─── Top Row: Category + Status ───────────────────────────────── */}
        <div className="flex items-center justify-between mb-3">
          <span
            className={`badge text-xs font-medium ${getCategoryBadgeClasses(event.category)}`}
            aria-label={`Category: ${event.category}`}
          >
            {event.category}
          </span>
          {isSoldOut && (
            <span className="badge text-xs bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 font-bold">
              Sold Out
            </span>
          )}
          {isWaitlistOpen && (
            <span className="badge text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 font-semibold">
              Waitlist Open
            </span>
          )}
          {isPrimaryOpen && (
            <span className="badge text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400 font-semibold">
              Open
            </span>
          )}
        </div>

        {/* ─── Title ────────────────────────────────────────────────────── */}
        <h3 className="font-bold text-base text-slate-900 dark:text-white mb-2 line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
          <Link href={`/events/${event.id}`} className="focus:outline-none focus:underline">
            {event.title}
          </Link>
        </h3>

        {/* ─── Description ──────────────────────────────────────────────── */}
        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-3 mb-4 leading-relaxed">
          {event.description}
        </p>

        {/* ─── Spacer ───────────────────────────────────────────────────── */}
        <div className="flex-1" />

        {/* ─── Event Meta ───────────────────────────────────────────────── */}
        <div className="space-y-2 mb-4">
          {/* Date */}
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{formatDate(event.startTime)}</span>
          </div>

          {/* Time */}
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              {formatTime(event.startTime)} – {formatTime(event.endTime)}
            </span>
          </div>

          {/* Venue */}
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="line-clamp-1">
              {event.venue.name} · {event.venue.location}
            </span>
          </div>
        </div>

        {/* ─── Capacity Indicator Bar ───────────────────────────────────── */}
        <div
          className="mb-4"
          aria-label={`Capacity: ${registered} of ${event.capacity} spots filled`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {registered} / {event.capacity} seats filled
              </span>
            </div>
            <span
              className={`text-xs font-semibold ${
                isSoldOut
                  ? 'text-red-600'
                  : isWaitlistOpen
                  ? 'text-amber-600'
                  : 'text-emerald-600'
              }`}
            >
              {isSoldOut
                ? 'Full'
                : isWaitlistOpen
                ? `${remainingWaitlistSlots} waitlist slots`
                : `${event.capacity - registered} left`}
            </span>
          </div>

          {/* Progress bar */}
          <div
            className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden"
            role="progressbar"
            aria-valuenow={registered}
            aria-valuemin={0}
            aria-valuemax={event.capacity}
          >
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isSoldOut ? 'bg-red-500' : isWaitlistOpen ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${fillPercent}%` }}
            />
          </div>
        </div>

        {/* ─── Error Message Feedback (if any) ─────────────────────────── */}
        {errorMsg && (
          <p className="text-[11px] text-red-600 dark:text-red-400 font-medium mb-2 line-clamp-1">
            {errorMsg}
          </p>
        )}

        {/* ─── Dynamic CTA Actions ───────────────────────────────────────── */}
        {activeRegistration ? (
          activeRegistration.status === 'CONFIRMED' ? (
            /* Student Already Registered Badge */
            <div
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold
                         bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300
                         border border-emerald-300 dark:border-emerald-800 cursor-default"
              aria-label="Already registered for this event"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Already Registered
            </div>
          ) : (
            /* Student On Waitlist Badge */
            <div
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold
                         bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300
                         border border-amber-300 dark:border-amber-800 cursor-default"
              aria-label={`On waitlist position ${activeRegistration.waitlistPosition ?? 1}`}
            >
              <Hourglass className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
              On Waitlist (#{activeRegistration.waitlistPosition ?? 1})
            </div>
          )
        ) : isPrimaryOpen ? (
          /* Capacity Open: Green Register Button */
          <button
            onClick={handleRegisterAction}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl text-xs font-bold text-white
                       bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 transition shadow-xs
                       focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 disabled:opacity-50"
            aria-label={`Register for ${event.title}`}
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Reserving seat...
              </>
            ) : (
              'Register'
            )}
          </button>
        ) : isWaitlistOpen ? (
          /* Capacity Full, Waitlist Open: Amber Join Waitlist Button */
          <button
            onClick={handleRegisterAction}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl text-xs font-bold text-white
                       bg-amber-600 hover:bg-amber-700 active:bg-amber-800 transition shadow-xs
                       focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 disabled:opacity-50"
            aria-label={`Join waitlist for ${event.title}`}
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Joining queue...
              </>
            ) : (
              `Join Waitlist (${remainingWaitlistSlots} slots left)`
            )}
          </button>
        ) : (
          /* Completely Full: Disabled Sold Out Button */
          <button
            disabled
            className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl text-xs font-semibold
                       bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700
                       cursor-not-allowed"
            aria-label={`${event.title} is sold out`}
          >
            <Ban className="w-3.5 h-3.5" />
            Sold Out
          </button>
        )}
      </div>
    </article>
  );
}
