'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Calendar,
  MapPin,
  Users,
  Search,
  Filter,
  ArrowLeft,
  Loader2,
  FileText,
  User,
  Check,
  X,
  MessageSquare,
} from 'lucide-react';
import { getAdminProposals, updateEventStatus, checkVenueConflict } from '@/lib/api';
import { formatEventDateRange, getCategoryBadgeClasses } from '@/lib/utils';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import type { Event, EventStatus, VenueConflict } from '@/types';

export default function AdminApprovalsPage() {
  const [proposals, setProposals] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'ALL'>(
    'PENDING_APPROVAL',
  );
  const [search, setSearch] = useState('');

  // Conflict maps: eventId -> VenueConflict | null
  const [conflictMap, setConflictMap] = useState<Record<string, VenueConflict | null>>({});
  const [checkingConflicts, setCheckingConflicts] = useState(true);

  // Action states
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectModalEvent, setRejectModalEvent] = useState<Event | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  // Fetch proposals
  useEffect(() => {
    async function fetchProposals() {
      try {
        setLoading(true);
        const data = await getAdminProposals('ALL');
        setProposals(data);
      } catch (err) {
        console.error('Error fetching admin proposals:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchProposals();
  }, []);

  // Compute live conflicts for all pending proposals
  useEffect(() => {
    async function evaluateConflicts() {
      if (proposals.length === 0) return;
      setCheckingConflicts(true);

      const conflicts: Record<string, VenueConflict | null> = {};

      for (const ev of proposals) {
        if (ev.status === 'PENDING_APPROVAL') {
          try {
            const res = await checkVenueConflict({
              venueId: ev.venue.id,
              startTime: ev.startTime,
              endTime: ev.endTime,
              excludeEventId: ev.id,
            });
            conflicts[ev.id] = res.hasConflict && res.conflictingEvent ? res.conflictingEvent : null;
          } catch {
            conflicts[ev.id] = null;
          }
        }
      }

      setConflictMap(conflicts);
      setCheckingConflicts(false);
    }

    evaluateConflicts();
  }, [proposals]);

  // One-click Approve Handler
  async function handleApprove(event: Event) {
    setProcessingId(event.id);
    setToastMessage(null);

    try {
      await updateEventStatus(event.id, 'APPROVED', 'Administrative approval granted.');

      // Update state locally
      setProposals((prev) =>
        prev.map((item) => (item.id === event.id ? { ...item, status: 'APPROVED' } : item)),
      );

      setToastMessage({
        type: 'success',
        text: `Proposal "${event.title}" has been successfully APPROVED and published to the discovery feed.`,
      });
    } catch (err: unknown) {
      const e = err as { message?: string };
      setToastMessage({
        type: 'error',
        text: e.message || 'Failed to approve proposal.',
      });
    } finally {
      setProcessingId(null);
    }
  }

  // Reject with reason handler
  async function handleConfirmReject() {
    if (!rejectModalEvent) return;

    setProcessingId(rejectModalEvent.id);
    setToastMessage(null);

    try {
      await updateEventStatus(
        rejectModalEvent.id,
        'REJECTED',
        rejectReason || 'Proposal does not meet scheduling or venue criteria.',
      );

      setProposals((prev) =>
        prev.map((item) =>
          item.id === rejectModalEvent.id ? { ...item, status: 'REJECTED' } : item,
        ),
      );

      setToastMessage({
        type: 'success',
        text: `Proposal "${rejectModalEvent.title}" has been REJECTED.`,
      });

      setRejectModalEvent(null);
      setRejectReason('');
    } catch (err: unknown) {
      const e = err as { message?: string };
      setToastMessage({
        type: 'error',
        text: e.message || 'Failed to reject proposal.',
      });
    } finally {
      setProcessingId(null);
    }
  }

  // Filtered proposal list
  const filteredProposals = proposals.filter((p) => {
    const matchesStatus = filterStatus === 'ALL' || p.status === filterStatus;
    const matchesSearch =
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.organizer.name.toLowerCase().includes(search.toLowerCase()) ||
      p.venue.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const pendingCount = proposals.filter((p) => p.status === 'PENDING_APPROVAL').length;
  const approvedCount = proposals.filter((p) => p.status === 'APPROVED').length;
  const rejectedCount = proposals.filter((p) => p.status === 'REJECTED').length;

  return (
    <ProtectedRoute allowedRoles={['ADMIN']}>
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
              <ShieldCheck className="w-3.5 h-3.5" />
              Administrative Governance
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Event Proposal Approvals & Schedule Audits
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Review event proposals submitted by campus organizers. Verify temporal venue non-collision
            and publish approved events into the live registry.
          </p>
        </div>

        <Link
          href="/"
          className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          View Live Event Feed
        </Link>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`p-4 rounded-xl text-sm flex items-start gap-3 border shadow-sm ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-red-50 dark:bg-red-950/50 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1 font-medium">{toastMessage.text}</div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-xs opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">Pending Review</p>
          <p className="text-3xl font-black text-amber-700 dark:text-amber-400 mt-1">{pendingCount}</p>
          <p className="text-xs text-slate-400 mt-1">Requires admin verdict</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Approved Events</p>
          <p className="text-3xl font-black text-emerald-700 dark:text-emerald-400 mt-1">{approvedCount}</p>
          <p className="text-xs text-slate-400 mt-1">Published to campus feed</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">Rejected Proposals</p>
          <p className="text-3xl font-black text-rose-700 dark:text-rose-400 mt-1">{rejectedCount}</p>
          <p className="text-xs text-slate-400 mt-1">Declined proposals</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">Total Proposals</p>
          <p className="text-3xl font-black text-indigo-700 dark:text-indigo-400 mt-1">{proposals.length}</p>
          <p className="text-xs text-slate-400 mt-1">Lifecycle queue total</p>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {(['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ALL'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterStatus(tab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                filterStatus === tab
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {tab === 'PENDING_APPROVAL'
                ? `Pending Review (${pendingCount})`
                : tab === 'APPROVED'
                ? `Approved (${approvedCount})`
                : tab === 'REJECTED'
                ? `Rejected (${rejectedCount})`
                : `All Proposals (${proposals.length})`}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search proposals, organizers, venues..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Proposals Review Queue */}
      {loading ? (
        <div className="py-24 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-3 text-sm text-slate-500">Loading proposal queue...</p>
        </div>
      ) : filteredProposals.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-8">
          <CheckCircle2 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Queue Clear
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {filterStatus === 'PENDING_APPROVAL'
              ? 'There are currently no event proposals waiting for administrative approval.'
              : 'No proposals match the selected filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProposals.map((proposal) => {
            const hasCollision = Boolean(conflictMap[proposal.id]);
            const collisionData = conflictMap[proposal.id];
            const isProcessing = processingId === proposal.id;

            return (
              <div
                key={proposal.id}
                className={`bg-white dark:bg-slate-900 rounded-2xl border p-6 shadow-sm transition ${
                  proposal.status === 'PENDING_APPROVAL'
                    ? hasCollision
                      ? 'border-red-300 dark:border-red-900/60 bg-red-50/20 dark:bg-red-950/10'
                      : 'border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800'
                    : 'border-slate-200 dark:border-slate-800 opacity-90'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                  {/* Left Column: Event Proposal Details */}
                  <div className="space-y-3 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-xs font-semibold px-2.5 py-0.5 rounded-md ${getCategoryBadgeClasses(
                          proposal.category,
                        )}`}
                      >
                        {proposal.category}
                      </span>

                      {/* Status Badge */}
                      {proposal.status === 'APPROVED' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          <CheckCircle2 className="w-3 h-3" /> Approved
                        </span>
                      ) : proposal.status === 'REJECTED' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                          <XCircle className="w-3 h-3" /> Rejected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                          <Clock className="w-3 h-3" /> Pending Review
                        </span>
                      )}

                      {/* TEMPORAL CONFLICT INDICATOR */}
                      {proposal.status === 'PENDING_APPROVAL' && (
                        checkingConflicts ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
                            <Loader2 className="w-3 h-3 animate-spin" /> Verifying venue slot...
                          </span>
                        ) : hasCollision ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-300 border border-red-300 dark:border-red-800 animate-pulse-once">
                            <AlertTriangle className="w-3 h-3 text-red-600" />
                            Temporal Collision Detected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Slot Verified Clear
                          </span>
                        )
                      )}
                    </div>

                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                      {proposal.title}
                    </h3>

                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed">
                      {proposal.description}
                    </p>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                          {proposal.venue.name} ({proposal.venue.location})
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate">
                          {formatEventDateRange(proposal.startTime, proposal.endTime)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span>
                          Target: <strong>{proposal.capacity}</strong> (Waitlist: {proposal.waitlistCapacity})
                        </span>
                      </div>
                    </div>

                    {/* Organizer Profile */}
                    <div className="flex items-center gap-2 pt-1 text-xs text-slate-500">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        Submitted by: <strong className="text-slate-700 dark:text-slate-300">{proposal.organizer.name}</strong> ({proposal.organizer.email})
                      </span>
                    </div>

                    {/* CONFLICT WARNING BANNER */}
                    {hasCollision && collisionData && (
                      <div className="mt-3 p-3.5 rounded-xl bg-red-100/70 dark:bg-red-950/50 border border-red-300 dark:border-red-800 text-xs text-red-900 dark:text-red-200">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold">
                              Overlap with &quot;{collisionData.title}&quot;
                            </p>
                            <p className="mt-0.5 text-red-800 dark:text-red-300">
                              Booked for {formatEventDateRange(collisionData.startTime, collisionData.endTime)} in {proposal.venue.name}. Approving this event will trigger a temporal collision.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: One-Click Admin Verdict Actions */}
                  <div className="flex flex-row lg:flex-col items-center lg:items-end justify-end gap-2.5 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
                    {proposal.status === 'PENDING_APPROVAL' ? (
                      <>
                        <button
                          onClick={() => handleApprove(proposal)}
                          disabled={isProcessing}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 active:bg-emerald-800 transition shadow-xs disabled:opacity-50"
                        >
                          {isProcessing ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          Approve Proposal
                        </button>

                        <button
                          onClick={() => {
                            setRejectModalEvent(proposal);
                            setRejectReason('');
                          }}
                          disabled={isProcessing}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-semibold text-xs hover:bg-rose-50 dark:hover:bg-rose-950/40 transition disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" />
                          Reject Proposal
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-slate-400 font-medium italic">
                        Verdict finalized ({proposal.status})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rejection Reason Modal */}
      {rejectModalEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-600" />
                Reject Event Proposal
              </h3>
              <button
                onClick={() => setRejectModalEvent(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              You are rejecting <strong>&quot;{rejectModalEvent.title}&quot;</strong>. Provide a rationale
              for the organizer to record into the audit log.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Rejection Rationale
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Venue capacity insufficient, schedule collision with campus hackathon..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectModalEvent(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </ProtectedRoute>
  );
}
