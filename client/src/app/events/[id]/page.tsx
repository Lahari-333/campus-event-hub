'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CalendarDays,
  MapPin,
  Clock,
  Users,
  CheckCircle2,
  Hourglass,
  Ban,
  ArrowLeft,
  Loader2,
  ShieldCheck,
  AlertCircle,
  Building,
  User,
  Ticket,
  Bell,
  Star,
  Sparkles,
  UserPlus,
  KeyRound,
  Copy,
  Check,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  getApprovedEvents,
  getEventRegistrationStatusApi,
  registerForEventApi,
  getEventAnnouncementsApi,
  getEventTeamsApi,
  createTeamApi,
  joinTeamApi,
  getEventFeedbackApi,
} from '@/lib/api';
import { formatEventDateRange, formatDate, formatTime, getCategoryBadgeClasses } from '@/lib/utils';
import type { Event, EventRegistrationStatus, Announcement, Team, FeedbackStats } from '@/types';

export default function EventDetailsPage() {
  const params = useParams();
  const eventId = params['id'] as string;
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const [event, setEvent] = useState<Event | null>(null);
  const [status, setStatus] = useState<EventRegistrationStatus | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStats>({
    feedback: [],
    summary: { count: 0, averageRating: 0 },
  });
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  // Team creation / join state
  const [newTeamName, setNewTeamName] = useState('');
  const [teamJoinCode, setTeamJoinCode] = useState('');
  const [teamLoading, setTeamLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const loadEventData = useCallback(async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      const [eventsList, regStatus, eventAnnounce, eventTeams, eventReviews] = await Promise.all([
        getApprovedEvents(),
        getEventRegistrationStatusApi(eventId),
        getEventAnnouncementsApi(eventId),
        getEventTeamsApi(eventId),
        getEventFeedbackApi(eventId),
      ]);

      const found = eventsList.find((e) => e.id === eventId);
      if (found) {
        setEvent(found);
      }
      setStatus(regStatus);
      setAnnouncements(eventAnnounce);
      setTeams(eventTeams);
      setFeedbackStats(eventReviews);
    } catch (err) {
      console.error('Failed to load event details:', err);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadEventData();
  }, [loadEventData]);

  const handleRegister = async () => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await registerForEventApi(eventId, selectedSeat || undefined);
      if (res.status === 'CONFIRMED') {
        setFeedback({
          type: 'success',
          message: selectedSeat
            ? `Your seat (${selectedSeat}) is confirmed! A unique QR entry pass has been issued.`
            : 'Your registration is confirmed! A unique QR entry pass has been issued.',
        });
      } else {
        setFeedback({
          type: 'success',
          message: `Primary capacity is full. You have been placed on the waitlist at position #${res.waitlistPosition}!`,
        });
      }
      await loadEventData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setFeedback({ type: 'error', message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    try {
      setTeamLoading(true);
      await createTeamApi(eventId, newTeamName.trim());
      setNewTeamName('');
      setFeedback({
        type: 'success',
        message: 'Team successfully created! Share your 6-digit code with teammates.',
      });
      const updatedTeams = await getEventTeamsApi(eventId);
      setTeams(updatedTeams);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setFeedback({
        type: 'error',
        message: e.message || 'Failed to create team.',
      });
    } finally {
      setTeamLoading(false);
    }
  };

  const handleJoinTeam = async () => {
    if (!teamJoinCode.trim()) return;
    try {
      setTeamLoading(true);
      await joinTeamApi(teamJoinCode.trim());
      setTeamJoinCode('');
      setFeedback({
        type: 'success',
        message: 'Joined team successfully!',
      });
      const updatedTeams = await getEventTeamsApi(eventId);
      setTeams(updatedTeams);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setFeedback({
        type: 'error',
        message: e.message || 'Failed to join team.',
      });
    } finally {
      setTeamLoading(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
        <p className="text-sm text-slate-500">Loading event details and live seat status...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Event Not Found</h2>
        <p className="text-sm text-slate-500">
          The event you are looking for does not exist or may have been unlisted.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Events Feed
        </Link>
      </div>
    );
  }

  const confirmedCount = status?.confirmedCount ?? event.registeredCount ?? 0;
  const waitlistedCount = status?.waitlistedCount ?? event.waitlistedCount ?? 0;
  const capacity = status?.capacity ?? event.capacity;
  const waitlistCapacity = status?.waitlistCapacity ?? event.waitlistCapacity;
  const userReg = status?.userRegistration;

  const isPrimaryOpen = confirmedCount < capacity;
  const isWaitlistOpen = !isPrimaryOpen && waitlistCapacity > 0 && waitlistedCount < waitlistCapacity;
  const isSoldOut = !isPrimaryOpen && (!waitlistCapacity || waitlistedCount >= waitlistCapacity);
  const remainingWaitlistSlots = Math.max(0, waitlistCapacity - waitlistedCount);
  const fillPercent = Math.min((confirmedCount / capacity) * 100, 100);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8 animate-fade-in">
      {/* Top Nav Back Link */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Event Discovery
      </Link>

      {/* Live Broadcast Announcements */}
      {announcements.length > 0 && (
        <div className="space-y-3">
          {announcements.map((ann) => (
            <div
              key={ann.id}
              className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-start gap-3 shadow-xs"
            >
              <Bell className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-bounce" />
              <div className="space-y-0.5 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                    {ann.title}
                  </h4>
                  <span className="text-[10px] text-amber-700/80 dark:text-amber-400 font-mono">
                    {new Date(ann.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  {ann.message}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-sm animate-slide-up ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Main Event Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        {/* Banner Strip */}
        <div
          className={`h-3 w-full ${
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
        />

        <div className="p-6 sm:p-10 space-y-8">
          {/* Header Metadata */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-xs font-bold px-3 py-1 rounded-md ${getCategoryBadgeClasses(
                  event.category,
                )}`}
              >
                {event.category}
              </span>

              {isSoldOut && (
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-300">
                  Sold Out
                </span>
              )}
              {isWaitlistOpen && (
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 flex items-center gap-1">
                  <Hourglass className="w-3.5 h-3.5" />
                  Waitlist Active ({remainingWaitlistSlots} slots remaining)
                </span>
              )}
              {isPrimaryOpen && (
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Registration Open
                </span>
              )}
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {event.title}
            </h1>

            <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
              {event.description}
            </p>
          </div>

          {/* Logistics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            {/* Schedule */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-start gap-3">
              <CalendarDays className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Date & Time</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {formatDate(event.startTime)}
                </p>
                <p className="text-xs text-slate-500">
                  {formatTime(event.startTime)} – {formatTime(event.endTime)}
                </p>
              </div>
            </div>

            {/* Venue */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-start gap-3">
              <MapPin className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Venue</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {event.venue.name}
                </p>
                <p className="text-xs text-slate-500">{event.venue.location}</p>
              </div>
            </div>
          </div>

          {/* Real-time Capacity Progress Box */}
          <div className="p-6 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Real-time Seat & Queue Tracker
                </h3>
              </div>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                {confirmedCount} / {capacity} Seats Confirmed
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isSoldOut ? 'bg-red-500' : isWaitlistOpen ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${fillPercent}%` }}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-slate-600 dark:text-slate-400 pt-2">
              <div>
                <span className="text-slate-400 block">Available Seats:</span>
                <strong className="text-slate-800 dark:text-slate-200 text-sm">
                  {Math.max(0, capacity - confirmedCount)}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block">Waitlist Queue:</span>
                <strong className="text-slate-800 dark:text-slate-200 text-sm">
                  {waitlistedCount} / {waitlistCapacity}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block">FIFO Promotion:</span>
                <strong className="text-emerald-600 dark:text-emerald-400 text-sm">
                  Active
                </strong>
              </div>
            </div>
          </div>

          {/* Interactive Seat Picker (When primary capacity open and not yet registered) */}
          {isPrimaryOpen && !userReg && (
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    💺 Interactive Seat Selection
                  </h4>
                  <p className="text-xs text-slate-500">
                    Choose your reserved seat (or leave unselected for automatic assignment).
                  </p>
                </div>
                {selectedSeat && (
                  <span className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-xs font-bold font-mono">
                    Seat: {selectedSeat}
                  </span>
                )}
              </div>

              {/* Grid of Seats */}
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 pt-1">
                {['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'C3', 'C4', 'D1', 'D2', 'D3', 'D4'].map(
                  (seat) => (
                    <button
                      key={seat}
                      type="button"
                      onClick={() => setSelectedSeat(selectedSeat === seat ? null : seat)}
                      className={`py-1.5 text-xs font-bold rounded-lg border transition ${
                        selectedSeat === seat
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                      }`}
                    >
                      {seat}
                    </button>
                  ),
                )}
              </div>
            </div>
          )}

          {/* Action CTA Container */}
          <div className="pt-2">
            {userReg ? (
              userReg.status === 'CONFIRMED' ? (
                <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
                    <div>
                      <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                        You&apos;re Confirmed for this Event!
                      </h4>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        Your entry pass is active and verified.
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/student/registrations"
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 transition flex items-center gap-1.5 shrink-0"
                  >
                    <Ticket className="w-3.5 h-3.5" />
                    View Entry Pass
                  </Link>
                </div>
              ) : (
                <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Hourglass className="w-8 h-8 text-amber-600 animate-pulse shrink-0" />
                    <div>
                      <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                        You are on the Waitlist (Queue #{userReg.waitlistPosition ?? 1})
                      </h4>
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        If any registered student cancels, you will automatically receive a confirmed seat.
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/student/registrations"
                    className="px-4 py-2 rounded-xl bg-amber-600 text-white font-semibold text-xs hover:bg-amber-700 transition flex items-center gap-1.5 shrink-0"
                  >
                    Manage Registration
                  </Link>
                </div>
              )
            ) : isPrimaryOpen ? (
              <button
                onClick={handleRegister}
                disabled={submitting}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm transition shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Confirming seat...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Register for Event
                  </>
                )}
              </button>
            ) : isWaitlistOpen ? (
              <button
                onClick={handleRegister}
                disabled={submitting}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-sm transition shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Joining waitlist...
                  </>
                ) : (
                  <>
                    <Hourglass className="w-4 h-4" />
                    Join Waitlist ({remainingWaitlistSlots} slots left)
                  </>
                )}
              </button>
            ) : (
              <button
                disabled
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-bold text-sm cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Ban className="w-4 h-4" />
                Sold Out
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Competition Teams Section (for Hackathon / Technical) */}
      {(event.category === 'Hackathon' || event.category === 'Technical') && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                Competition Teams ({teams.length})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Form a project team or join your peers using a private 6-character team join code.
              </p>
            </div>
          </div>

          {/* Create / Join Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Create Team */}
            <div className="p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 space-y-3">
              <h4 className="text-xs font-bold text-purple-900 dark:text-purple-200 uppercase tracking-wider flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5" /> Create New Team
              </h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Team Name (e.g. ByteRunners)"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="flex-1 text-xs rounded-xl border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-purple-500"
                />
                <button
                  type="button"
                  disabled={teamLoading || !newTeamName.trim()}
                  onClick={handleCreateTeam}
                  className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 transition disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </div>

            {/* Join Team with Code */}
            <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 space-y-3">
              <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wider flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" /> Join with 6-Digit Code
              </h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Invite Code (e.g. AB12CD)"
                  maxLength={6}
                  value={teamJoinCode}
                  onChange={(e) => setTeamJoinCode(e.target.value.toUpperCase())}
                  className="flex-1 text-xs rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white uppercase font-mono tracking-wider focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  disabled={teamLoading || !teamJoinCode.trim()}
                  onClick={handleJoinTeam}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  Join
                </button>
              </div>
            </div>
          </div>

          {/* Teams Grid */}
          {teams.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              No teams created yet. Be the first to start a team!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {teams.map((t) => (
                <div
                  key={t.id}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h5 className="font-bold text-sm text-slate-900 dark:text-white">{t.name}</h5>
                    <button
                      type="button"
                      onClick={() => handleCopyCode(t.code)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-mono hover:bg-slate-300 transition"
                      title="Copy join code"
                    >
                      {copiedCode === t.code ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> {t.code}
                        </>
                      )}
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase text-slate-400">
                      Members ({t.members.length})
                    </p>
                    <div className="space-y-1">
                      {t.members.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300"
                        >
                          <span className="font-medium">{m.user.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-slate-200 dark:bg-slate-700 font-semibold">
                            {m.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Attendee Reviews & Star Ratings */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
              Verified Attendee Reviews
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Honest ratings and feedback from students who checked into this event.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-4 py-2 rounded-2xl">
            <div className="text-center">
              <p className="text-2xl font-black text-amber-600 dark:text-amber-400">
                {feedbackStats.summary.averageRating.toFixed(1)}
              </p>
              <div className="flex items-center justify-center gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-3 h-3 ${
                      s <= Math.round(feedbackStats.summary.averageRating)
                        ? 'text-amber-500 fill-amber-500'
                        : 'text-slate-300 dark:text-slate-600'
                    }`}
                  />
                ))}
              </div>
            </div>
            <div className="border-l border-amber-200 dark:border-amber-800 pl-3 text-xs text-amber-800 dark:text-amber-300">
              <p className="font-bold">{feedbackStats.summary.count} Reviews</p>
              <p className="text-[10px] text-amber-600">Verified attendance</p>
            </div>
          </div>
        </div>

        {feedbackStats.feedback.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            No reviews submitted yet. Be the first attendee to review after checking in!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {feedbackStats.feedback.map((f) => (
              <div
                key={f.id}
                className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs">
                      {f.user?.name?.[0] || 'U'}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        {f.user?.name || 'Anonymous Student'}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {f.user?.department || 'Verified Attendee'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-3.5 h-3.5 ${
                          s <= f.rating
                            ? 'text-amber-500 fill-amber-500'
                            : 'text-slate-300 dark:text-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {f.comment && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 italic pt-1">
                    &ldquo;{f.comment}&rdquo;
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
