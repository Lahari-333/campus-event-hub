'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  PlusCircle,
  Search,
  LayoutGrid,
  Table as TableIcon,
  CheckCircle,
  Clock,
  FileEdit,
  XCircle,
  Users,
  MapPin,
  Calendar,
  AlertCircle,
  ArrowRight,
  Download,
  Radio,
  Megaphone,
  Bell,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { getMyEvents, getExportRosterUrl, getLiveAttendanceUrl, createAnnouncementApi } from '@/lib/api';
import { formatEventDateRange, getCategoryBadgeClasses } from '@/lib/utils';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import type { Event, EventStatus } from '@/types';

export default function MyEventsDashboard() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | EventStatus>('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Enterprise additions: SSE live attendance & broadcast announcements
  const [sseModalEvent, setSseModalEvent] = useState<Event | null>(null);
  const [sseStats, setSseStats] = useState<{ confirmed: number; checkedIn: number; percentage: number } | null>(null);
  const [announcementModalEvent, setAnnouncementModalEvent] = useState<Event | null>(null);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [announcementLoading, setAnnouncementLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!sseModalEvent) {
      setSseStats(null);
      return;
    }

    const eventSource = new EventSource(getLiveAttendanceUrl(sseModalEvent.id), {
      withCredentials: true,
    });

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setSseStats({
          confirmed: data.confirmed || 0,
          checkedIn: data.checkedIn || 0,
          percentage: data.percentage || 0,
        });
      } catch (e) {
        console.error('SSE JSON error:', e);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [sseModalEvent]);

  const handleBroadcastAnnouncement = async () => {
    if (!announcementModalEvent || !announcementTitle.trim() || !announcementMessage.trim()) return;
    try {
      setAnnouncementLoading(true);
      await createAnnouncementApi(
        announcementModalEvent.id,
        announcementTitle.trim(),
        announcementMessage.trim(),
      );
      setToast({
        type: 'success',
        message: `Announcement broadcast successfully to all attendees of "${announcementModalEvent.title}"!`,
      });
      setAnnouncementModalEvent(null);
      setAnnouncementTitle('');
      setAnnouncementMessage('');
    } catch (err: unknown) {
      const e = err as { message?: string };
      setToast({
        type: 'error',
        message: e.message || 'Failed to broadcast announcement.',
      });
    } finally {
      setAnnouncementLoading(false);
    }
  };

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getMyEvents();
        setEvents(data);
      } catch (err) {
        console.error('Error fetching organizer events:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Filtered Events
  const filteredEvents = events.filter((ev) => {
    const matchesStatus = statusFilter === 'ALL' || ev.status === statusFilter;
    const matchesSearch =
      ev.title.toLowerCase().includes(search.toLowerCase()) ||
      ev.category.toLowerCase().includes(search.toLowerCase()) ||
      ev.venue.name.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // KPI Calculations
  const totalEvents = events.length;
  const approvedCount = events.filter((e) => e.status === 'APPROVED').length;
  const pendingCount = events.filter((e) => e.status === 'PENDING_APPROVAL').length;
  const rejectedCount = events.filter((e) => e.status === 'REJECTED').length;
  const totalAttendees = events.reduce((sum, e) => sum + (e.registeredCount || 0), 0);

  function renderStatusBadge(status: EventStatus) {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle className="w-3.5 h-3.5" />
            Approved
          </span>
        );
      case 'PENDING_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <Clock className="w-3.5 h-3.5" />
            Pending Approval
          </span>
        );
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
            <FileEdit className="w-3.5 h-3.5" />
            Draft
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-300 dark:border-red-800">
            <XCircle className="w-3.5 h-3.5" />
            Rejected
          </span>
        );
    }
  }

  return (
    <ProtectedRoute allowedRoles={['ORGANIZER', 'ADMIN']}>
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Top Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <CalendarDays className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            Organizer Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Monitor your event proposals, approval statuses, temporal venue schedules, and attendee metrics.
          </p>
        </div>

        <Link
          href="/organizer/create-event"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 active:bg-indigo-800 transition shadow-sm"
        >
          <PlusCircle className="w-4 h-4" />
          Propose New Event
        </Link>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Created</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1.5">{totalEvents}</p>
          <p className="text-xs text-slate-400 mt-1">Across all statuses</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Pending Review</p>
          <p className="text-2xl font-black text-amber-700 dark:text-amber-400 mt-1.5">{pendingCount}</p>
          <p className="text-xs text-slate-400 mt-1">Awaiting admin review</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Approved & Live</p>
          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1.5">{approvedCount}</p>
          <p className="text-xs text-slate-400 mt-1">Active on public feed</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-medium text-red-600 dark:text-red-400">Rejected</p>
          <p className="text-2xl font-black text-red-700 dark:text-red-400 mt-1.5">{rejectedCount}</p>
          <p className="text-xs text-slate-400 mt-1">Action required</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm col-span-2 lg:col-span-1">
          <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">Total Attendees</p>
          <p className="text-2xl font-black text-indigo-700 dark:text-indigo-400 mt-1.5">{totalAttendees}</p>
          <p className="text-xs text-slate-400 mt-1">Confirmed signups</p>
        </div>
      </div>

      {/* Control Bar: Filters & View Switcher */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {(['ALL', 'PENDING_APPROVAL', 'APPROVED', 'DRAFT', 'REJECTED'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {st === 'ALL'
                ? 'All Events'
                : st === 'PENDING_APPROVAL'
                ? 'Pending Review'
                : st === 'APPROVED'
                ? 'Approved'
                : st === 'DRAFT'
                ? 'Drafts'
                : 'Rejected'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          {/* Search Input */}
          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by title, venue..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-xl p-0.5 bg-slate-100 dark:bg-slate-800">
            <button
              onClick={() => setViewMode('table')}
              title="Table View"
              className={`p-1.5 rounded-lg text-xs transition ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              <TableIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              title="Card Grid View"
              className={`p-1.5 rounded-lg text-xs transition ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-3 text-sm text-slate-500">Loading your events...</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-8">
          <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">No matching events found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {search || statusFilter !== 'ALL'
              ? 'Try adjusting your search criteria or status filter to see other events.'
              : 'You have not created any event proposals yet.'}
          </p>
          <div className="mt-5">
            <Link
              href="/organizer/create-event"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Propose Your First Event
            </Link>
          </div>
        </div>
      ) : viewMode === 'table' ? (
        /* TABULAR VIEW */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-5">Event Title & Category</th>
                  <th className="py-3.5 px-5">Venue & Location</th>
                  <th className="py-3.5 px-5">Temporal Window</th>
                  <th className="py-3.5 px-5">Attendee Stats</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {filteredEvents.map((event) => {
                  const regCount = event.registeredCount || 0;
                  const pct = Math.min(100, Math.round((regCount / event.capacity) * 100));

                  return (
                    <tr
                      key={event.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition group"
                    >
                      <td className="py-4 px-5">
                        <div className="font-semibold text-slate-900 dark:text-white max-w-xs truncate">
                          {event.title}
                        </div>
                        <div className="mt-1">
                          <span
                            className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-md ${getCategoryBadgeClasses(
                              event.category,
                            )}`}
                          >
                            {event.category}
                          </span>
                        </div>
                      </td>

                      <td className="py-4 px-5">
                        <div className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-xs">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {event.venue.name}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">{event.venue.location}</div>
                      </td>

                      <td className="py-4 px-5">
                        <div className="text-xs text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {formatEventDateRange(event.startTime, event.endTime)}
                        </div>
                      </td>

                      <td className="py-4 px-5">
                        <div className="space-y-1 w-36">
                          <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                            <span>{regCount} / {event.capacity}</span>
                            <span className="text-slate-400">{pct}%</span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-5">{renderStatusBadge(event.status)}</td>

                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {event.status === 'APPROVED' && (
                            <>
                              <button
                                type="button"
                                onClick={() => setSseModalEvent(event)}
                                title="Live SSE Attendance Pulse"
                                className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 hover:bg-teal-100 transition"
                              >
                                <Radio className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setAnnouncementModalEvent(event)}
                                title="Broadcast Announcement"
                                className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 transition"
                              >
                                <Megaphone className="w-3.5 h-3.5" />
                              </button>

                              <a
                                href={getExportRosterUrl(event.id)}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Export Attendee CSV Roster"
                                className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            </>
                          )}

                          <Link
                            href={`/events/${event.id}`}
                            className="inline-flex items-center text-xs font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 gap-1 transition"
                          >
                            Details
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* CARD GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((event) => {
            const regCount = event.registeredCount || 0;
            const pct = Math.min(100, Math.round((regCount / event.capacity) * 100));

            return (
              <div
                key={event.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between hover:border-indigo-300 dark:hover:border-indigo-800 transition"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded-md ${getCategoryBadgeClasses(
                        event.category,
                      )}`}
                    >
                      {event.category}
                    </span>
                    {renderStatusBadge(event.status)}
                  </div>

                  <h3 className="font-bold text-slate-900 dark:text-white text-base line-clamp-1 mb-2">
                    {event.title}
                  </h3>

                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-4">
                    {event.description}
                  </p>

                  <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{event.venue.name} ({event.venue.location})</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{formatEventDateRange(event.startTime, event.endTime)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                    <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-indigo-500" />
                      Attendee Enrollment
                    </span>
                    <span className="text-indigo-600 dark:text-indigo-400">
                      {regCount} / {event.capacity} seats ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {event.status === 'APPROVED' && (
                      <>
                        <button
                          type="button"
                          onClick={() => setSseModalEvent(event)}
                          title="Live Attendance Pulse"
                          className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 hover:bg-teal-100 transition"
                        >
                          <Radio className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setAnnouncementModalEvent(event)}
                          title="Broadcast Announcement"
                          className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 transition"
                        >
                          <Megaphone className="w-3.5 h-3.5" />
                        </button>
                        <a
                          href={getExportRosterUrl(event.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Export CSV Roster"
                          className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </>
                    )}
                  </div>
                  <Link
                    href={`/events/${event.id}`}
                    className="inline-flex items-center text-xs font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 gap-1"
                  >
                    Details <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-sm ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toast.message}</span>
          </div>
          <button onClick={() => setToast(null)} className="text-xs font-bold underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Live SSE Attendance Pulse Modal */}
      {sseModalEvent && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-teal-500"></span>
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Live Attendance Stream (SSE)
                </h3>
              </div>
              <button
                onClick={() => setSseModalEvent(null)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                Close
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Live updates for <strong className="text-slate-800 dark:text-slate-200">{sseModalEvent.title}</strong> streaming directly from Neon PostgreSQL check-in events.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center">
                <p className="text-[10px] font-bold uppercase text-slate-400">Confirmed</p>
                <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                  {sseStats ? sseStats.confirmed : '...'}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-center">
                <p className="text-[10px] font-bold uppercase text-teal-600 dark:text-teal-400">
                  Checked In
                </p>
                <p className="text-3xl font-black text-teal-700 dark:text-teal-300 mt-1">
                  {sseStats ? sseStats.checkedIn : '...'}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
                <span>Check-In Rate</span>
                <span>{sseStats ? `${sseStats.percentage}%` : 'Connecting...'}</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-teal-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${sseStats ? sseStats.percentage : 0}%` }}
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSseModalEvent(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              >
                Close Stream
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Broadcast Announcement Modal */}
      {announcementModalEvent && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <Megaphone className="w-6 h-6" />
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Broadcast Live Announcement
                </h3>
                <p className="text-xs text-slate-500">{announcementModalEvent.title}</p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Announcement Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Keynote speaker shifted by 15 minutes"
                  value={announcementTitle}
                  onChange={(e) => setAnnouncementTitle(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Message / Instructions for Attendees
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Please proceed to Hall B for the workshop track."
                  value={announcementMessage}
                  onChange={(e) => setAnnouncementMessage(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setAnnouncementModalEvent(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={announcementLoading || !announcementTitle.trim() || !announcementMessage.trim()}
                onClick={handleBroadcastAnnouncement}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {announcementLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Broadcasting...
                  </>
                ) : (
                  'Send Broadcast'
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
