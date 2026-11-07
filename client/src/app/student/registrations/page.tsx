'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import {
  CalendarDays,
  QrCode,
  MapPin,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  Ticket,
  AlertCircle,
  Loader2,
  XCircle,
  Hourglass,
  ArrowRight,
  ShieldCheck,
  Award,
  Star,
  Download,
} from 'lucide-react';
import { formatEventDateRange, getCategoryBadgeClasses } from '@/lib/utils';
import { getMyRegistrationsApi, cancelRegistrationApi, getCertificateUrl, submitFeedbackApi } from '@/lib/api';
import type { Registration } from '@/types';

export default function StudentRegistrationsPage() {
  const { user } = useAuth();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'CONFIRMED' | 'WAITLISTED'>('CONFIRMED');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [reviewModalReg, setReviewModalReg] = useState<Registration | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const fetchRegistrations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getMyRegistrationsApi();
      setRegistrations(data);
    } catch (err: unknown) {
      console.error('Failed to load student registrations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      fetchRegistrations();
    }
  }, [fetchRegistrations]);

  const handleCancelRegistration = async (registration: Registration) => {
    const isWaitlist = registration.status === 'WAITLISTED';
    const confirmPrompt = isWaitlist
      ? `Are you sure you want to leave the waitlist for "${registration.event?.title || 'this event'}"?`
      : `Are you sure you want to cancel your confirmed ticket for "${registration.event?.title || 'this event'}"? Your spot will be automatically offered to the next student in the queue.`;

    if (!window.confirm(confirmPrompt)) return;

    setCancellingId(registration.id);
    setFeedback(null);

    // Optimistic UI Update: immediately mark as cancelled in local state
    const previousState = [...registrations];
    setRegistrations((prev) => prev.filter((r) => r.id !== registration.id));

    try {
      const response = await cancelRegistrationApi(registration.id);

      if (response.promoted) {
        setFeedback({
          type: 'success',
          message: `Ticket cancelled successfully. Student in waitlist position #1 was automatically promoted to Confirmed!`,
        });
      } else {
        setFeedback({
          type: 'success',
          message: isWaitlist
            ? 'You have successfully left the waitlist.'
            : 'Registration cancelled successfully.',
        });
      }
    } catch (err: unknown) {
      // Revert optimistic update on error
      setRegistrations(previousState);
      const message =
        err instanceof Error ? err.message : 'Failed to cancel registration. Please try again.';
      setFeedback({ type: 'error', message });
    } finally {
      setCancellingId(null);
    }
  };

  const handleSubmitReview = async () => {
    if (!reviewModalReg) return;
    try {
      setSubmittingReview(true);
      await submitFeedbackApi(reviewModalReg.eventId, reviewRating, reviewComment || undefined);
      setFeedback({
        type: 'success',
        message: 'Thank you! Your rating and feedback have been recorded.',
      });
      setReviewModalReg(null);
      setReviewComment('');
      setReviewRating(5);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setFeedback({
        type: 'error',
        message: e.message || 'Failed to submit feedback.',
      });
    } finally {
      setSubmittingReview(false);
    }
  };

  const confirmedRegistrations = registrations.filter(
    (r) => r.status === 'CONFIRMED' || r.status === 'CHECKED_IN' || r.status === 'ATTENDED',
  );
  const waitlistedRegistrations = registrations.filter((r) => r.status === 'WAITLISTED');

  return (
    <ProtectedRoute allowedRoles={['STUDENT', 'ADMIN']}>
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
                <Ticket className="w-3.5 h-3.5" />
                Student Portal
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                <ShieldCheck className="w-3.5 h-3.5" />
                Live Hub
              </span>
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
              <CalendarDays className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
              My Event Registrations
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Welcome back, <strong className="text-slate-800 dark:text-slate-200">{user?.name}</strong>.
              Manage your verified entry passes, track real-time waitlist queues, and view event schedules.
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 active:bg-indigo-800 transition shadow-xs shrink-0"
          >
            <Compass className="w-4 h-4" />
            Discover More Events
          </Link>
        </div>

        {/* Feedback Banner */}
        {feedback && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-sm animate-slide-up ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tab Switching Bar */}
        <div className="border-b border-slate-200 dark:border-slate-800 flex gap-4">
          <button
            onClick={() => setActiveTab('CONFIRMED')}
            className={`pb-3.5 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'CONFIRMED'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            Confirmed Tickets
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === 'CONFIRMED'
                  ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              {confirmedRegistrations.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('WAITLISTED')}
            className={`pb-3.5 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'WAITLISTED'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400 dark:border-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Hourglass className="w-4 h-4" />
            Waitlisted
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === 'WAITLISTED'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              {waitlistedRegistrations.length}
            </span>
          </button>
        </div>

        {/* Loading Spinner */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-sm">Synchronizing your registrations...</p>
          </div>
        ) : (
          <>
            {/* ─── TAB 1: CONFIRMED TICKETS ────────────────────────────────────────── */}
            {activeTab === 'CONFIRMED' && (
              <div className="space-y-4">
                {confirmedRegistrations.length === 0 ? (
                  <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8">
                    <Ticket className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                      No Confirmed Tickets
                    </h3>
                    <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-5">
                      You haven&apos;t registered for any events yet. Check out the discovery feed to reserve your spot!
                    </p>
                    <Link
                      href="/"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition"
                    >
                      <Compass className="w-3.5 h-3.5" />
                      Browse Events
                    </Link>
                  </div>
                ) : (
                  confirmedRegistrations.map((reg) => (
                    <div
                      key={reg.id}
                      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-800 transition flex flex-col md:flex-row md:items-center justify-between gap-6"
                    >
                      <div className="space-y-3 flex-1">
                        <div className="flex items-center gap-2">
                          {reg.event && (
                            <span
                              className={`text-xs font-semibold px-2.5 py-0.5 rounded-md ${getCategoryBadgeClasses(
                                reg.event.category,
                              )}`}
                            >
                              {reg.event.category}
                            </span>
                          )}
                          {reg.status === 'CHECKED_IN' || reg.status === 'ATTENDED' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-300 dark:border-teal-800">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Checked In & Attended
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Confirmed Ticket
                            </span>
                          )}
                          {reg.seatNumber && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
                              💺 Seat: {reg.seatNumber}
                            </span>
                          )}
                        </div>

                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                          {reg.event?.title || 'Campus Event'}
                        </h3>

                        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                          {reg.event?.description || 'Campus community event.'}
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs text-slate-600 dark:text-slate-400">
                          {reg.event?.venue && (
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>
                                {reg.event.venue.name} ({reg.event.venue.location})
                              </span>
                            </div>
                          )}
                          {reg.event && (
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>
                                {formatEventDateRange(reg.event.startTime, reg.event.endTime)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Ticket Pass Pill + Action Buttons */}
                      <div className="flex flex-col items-start md:items-end gap-3 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 dark:border-slate-800">
                        {reg.qrToken && (
                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-center space-y-1 w-full md:w-auto">
                            <div className="flex items-center justify-center gap-1.5 text-indigo-600 dark:text-indigo-400 text-xs font-bold font-mono">
                              <QrCode className="w-4 h-4" />
                              {reg.qrToken}
                            </div>
                            <p className="text-[10px] text-slate-400">Official Entry Pass Token</p>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                          {(reg.status === 'CHECKED_IN' || reg.status === 'ATTENDED') && (
                            <>
                              <a
                                href={getCertificateUrl(reg.id)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition flex items-center gap-1.5 shadow-xs"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Certificate
                              </a>

                              <button
                                onClick={() => setReviewModalReg(reg)}
                                className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition flex items-center gap-1.5 shadow-xs"
                              >
                                <Star className="w-3.5 h-3.5 fill-white" />
                                Review
                              </button>
                            </>
                          )}

                          <button
                            onClick={() =>
                              setSelectedTicket(selectedTicket === reg.id ? null : reg.id)
                            }
                            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          >
                            {selectedTicket === reg.id ? 'Close Pass' : 'View Pass'}
                          </button>

                          {reg.status !== 'CHECKED_IN' && reg.status !== 'ATTENDED' && (
                            <button
                              onClick={() => handleCancelRegistration(reg)}
                              disabled={cancellingId === reg.id}
                              className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 text-xs font-semibold transition disabled:opacity-50 flex items-center gap-1"
                            >
                              {cancellingId === reg.id ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  Cancelling...
                                </>
                              ) : (
                                'Cancel Ticket'
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expanded QR Modal Card */}
                      {selectedTicket === reg.id && (
                        <div className="md:col-span-2 w-full mt-4 p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 flex flex-col items-center text-center space-y-3">
                          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800">
                            <QrCode className="w-24 h-24 text-slate-900 dark:text-white mx-auto" />
                            <p className="mt-2 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                              {reg.qrToken}
                            </p>
                          </div>
                          <p className="text-xs text-slate-500">
                            Present this QR code or token to an event volunteer at the venue entrance.
                          </p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ─── TAB 2: WAITLISTED REGISTRATIONS ─────────────────────────────────── */}
            {activeTab === 'WAITLISTED' && (
              <div className="space-y-4">
                {waitlistedRegistrations.length === 0 ? (
                  <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8">
                    <Hourglass className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                      No Active Waitlists
                    </h3>
                    <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-5">
                      You are not currently in any event waitlists. All your registrations are confirmed!
                    </p>
                    <Link
                      href="/"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition"
                    >
                      <Compass className="w-3.5 h-3.5" />
                      Browse Events
                    </Link>
                  </div>
                ) : (
                  waitlistedRegistrations.map((reg) => (
                    <div
                      key={reg.id}
                      className="bg-white dark:bg-slate-900 rounded-2xl border border-amber-200 dark:border-amber-900/50 p-6 shadow-sm hover:border-amber-400 transition flex flex-col md:flex-row md:items-center justify-between gap-6"
                    >
                      <div className="space-y-3 flex-1">
                        <div className="flex items-center gap-2">
                          {reg.event && (
                            <span
                              className={`text-xs font-semibold px-2.5 py-0.5 rounded-md ${getCategoryBadgeClasses(
                                reg.event.category,
                              )}`}
                            >
                              {reg.event.category}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                            <Hourglass className="w-3.5 h-3.5 animate-pulse text-amber-600" />
                            Queue Position: #{reg.waitlistPosition ?? 1}
                          </span>
                        </div>

                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                          {reg.event?.title || 'Campus Event'}
                        </h3>

                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Primary venue capacity is currently full. As registered attendees cancel, you will be automatically promoted to <strong>CONFIRMED</strong> in strict FIFO order!
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs text-slate-600 dark:text-slate-400">
                          {reg.event?.venue && (
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>
                                {reg.event.venue.name} ({reg.event.venue.location})
                              </span>
                            </div>
                          )}
                          {reg.event && (
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>
                                {formatEventDateRange(reg.event.startTime, reg.event.endTime)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Waitlist Queue Indicator & Action */}
                      <div className="flex flex-col items-start md:items-end gap-3 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 dark:border-slate-800">
                        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-center w-full md:w-auto">
                          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                            FIFO Standby Queue
                          </p>
                          <p className="text-lg font-black text-amber-700 dark:text-amber-400">
                            #{reg.waitlistPosition ?? 1} in line
                          </p>
                        </div>

                        <button
                          onClick={() => handleCancelRegistration(reg)}
                          disabled={cancellingId === reg.id}
                          className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 text-xs font-semibold transition disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {cancellingId === reg.id ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Leaving queue...
                            </>
                          ) : (
                            'Leave Waitlist'
                          )}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
        {/* Star Rating & Feedback Modal */}
        {reviewModalReg && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-3 text-amber-500">
                <Star className="w-7 h-7 fill-amber-500" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Rate Your Experience
                  </h3>
                  <p className="text-xs text-slate-500">
                    {reviewModalReg.event?.title || 'Campus Event'}
                  </p>
                </div>
              </div>

              {/* Star selector */}
              <div className="flex items-center justify-center gap-2 py-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className="p-1 text-slate-300 hover:text-amber-400 focus:outline-hidden transition"
                  >
                    <Star
                      className={`w-8 h-8 ${
                        star <= reviewRating
                          ? 'text-amber-500 fill-amber-500'
                          : 'text-slate-300 dark:text-slate-700'
                      }`}
                    />
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Optional Review or Comments
                </label>
                <textarea
                  rows={3}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="What did you enjoy about the sessions, speakers, or organization?"
                  className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setReviewModalReg(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submittingReview}
                  onClick={handleSubmitReview}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submittingReview ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Review'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
