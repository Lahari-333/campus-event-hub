'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, SlidersHorizontal, X, Loader2, Sparkles } from 'lucide-react';
import { EventCard } from '@/components/events/EventCard';
import { EVENT_CATEGORIES } from '@/lib/mockData';
import { getCategoryBadgeClasses } from '@/lib/utils';
import { getApprovedEvents, getMyRegistrationsApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import type { Event, EventCategory, Registration } from '@/types';

export function EventDiscoveryFeed() {
  const { isAuthenticated } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [userRegistrations, setUserRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<EventCategory | 'All'>('All');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [fetchedEvents, myRegistrations] = await Promise.all([
        getApprovedEvents(),
        isAuthenticated ? getMyRegistrationsApi() : Promise.resolve([]),
      ]);
      setEvents(fetchedEvents);
      setUserRegistrations(myRegistrations);
    } catch (err) {
      console.warn('Failed to load discovery feed:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Map of eventId -> registration
  const registrationMap = useMemo(() => {
    const map = new Map<string, { status: Registration['status']; waitlistPosition?: number | null }>();
    userRegistrations.forEach((reg) => {
      map.set(reg.eventId, {
        status: reg.status,
        waitlistPosition: reg.waitlistPosition,
      });
    });
    return map;
  }, [userRegistrations]);

  // ─── Filtered Events ─────────────────────────────────────────────────────
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesSearch =
        searchQuery === '' ||
        event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.venue?.name?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        selectedCategory === 'All' || event.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [events, searchQuery, selectedCategory]);

  const hasActiveFilters = searchQuery !== '' || selectedCategory !== 'All';

  function clearFilters() {
    setSearchQuery('');
    setSelectedCategory('All');
  }

  return (
    <section aria-label="Event discovery feed">
      {/* ─── Search & Filter Header ────────────────────────────────────── */}
      <div className="mb-8 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" aria-hidden="true" />
          </div>
          <input
            type="search"
            placeholder="Search events by name, description, or venue..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-10 pr-10 py-3 text-sm"
            aria-label="Search events"
            role="searchbox"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Category Filter Badges */}
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by category">
          <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 mr-1">
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Filter:</span>
          </div>

          {/* "All" badge */}
          <button
            onClick={() => setSelectedCategory('All')}
            className={`badge px-3 py-1.5 text-sm cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-1 ${
              selectedCategory === 'All'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200 dark:shadow-indigo-900'
                : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
            aria-pressed={selectedCategory === 'All'}
            aria-label="Show all event categories"
          >
            All Events
          </button>

          {/* Category badges */}
          {EVENT_CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() =>
                setSelectedCategory(
                  selectedCategory === category ? 'All' : category,
                )
              }
              className={`badge px-3 py-1.5 text-sm cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                selectedCategory === category
                  ? `${getCategoryBadgeClasses(category)} ring-2 ring-offset-1 shadow-sm`
                  : `bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 hover:${getCategoryBadgeClasses(
                      category,
                    )}`
              }`}
              aria-pressed={selectedCategory === category}
              aria-label={`Filter by ${category} events`}
            >
              {category}
            </button>
          ))}

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 ml-1 transition-colors"
              aria-label="Clear all filters"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Clear filters
            </button>
          )}
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                Updating available seats...
              </span>
            ) : filteredEvents.length === 0 ? (
              'No events found'
            ) : (
              `Showing ${filteredEvents.length} event${
                filteredEvents.length !== 1 ? 's' : ''
              }${selectedCategory !== 'All' ? ` in ${selectedCategory}` : ''}${
                searchQuery ? ` matching "${searchQuery}"` : ''
              }`
            )}
          </p>
        </div>
      </div>

      {/* ─── Event Grid ───────────────────────────────────────────────────── */}
      {filteredEvents.length > 0 ? (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in"
          role="list"
          aria-label="Events list"
        >
          {filteredEvents.map((event) => (
            <div key={event.id} role="listitem">
              <EventCard
                event={event}
                userRegistration={registrationMap.get(event.id) || null}
                onRegisterSuccess={loadData}
              />
            </div>
          ))}
        </div>
      ) : (
        /* ─── Empty State ─────────────────────────────────────────────── */
        <div
          className="flex flex-col items-center justify-center py-20 text-center animate-fade-in"
          role="status"
        >
          <div className="h-16 w-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
            <Search className="h-8 w-8 text-slate-400" aria-hidden="true" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
            No Events Found
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-4">
            We couldn&apos;t find any events matching your search. Try adjusting your filters or search term.
          </p>
          <button onClick={clearFilters} className="btn-secondary text-sm">
            Clear filters
          </button>
        </div>
      )}
    </section>
  );
}
