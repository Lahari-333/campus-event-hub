import type {
  Event,
  Venue,
  ConflictCheckResult,
  User,
  UserRole,
  Registration,
  EventRegistrationStatus,
  CheckInResult,
  AdminUserResponse,
  Announcement,
  Feedback,
  FeedbackStats,
  Team,
  AiSuggestionResult,
} from '@/types';
import { MOCK_EVENTS, MOCK_VENUES, MOCK_PROPOSALS } from './mockData';

// Normalize base URL so it always ends with /api
const RAW_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
export const API_BASE_URL = RAW_URL.replace(/\/+$/, '').endsWith('/api')
  ? RAW_URL.replace(/\/+$/, '')
  : `${RAW_URL.replace(/\/+$/, '')}/api`;

/**
 * Universal fetch wrapper supporting credentials and unified error handling.
 * Automatically resolves endpoint prefixes so /api/auth/login and /auth/login
 * consistently resolve to the canonical API base.
 */
async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  // Strip redundant leading /api if present so we never generate /api/api/...
  const path = endpoint.startsWith('/api/')
    ? endpoint.slice(4)
    : endpoint.startsWith('/api')
    ? endpoint.slice(4)
    : endpoint.startsWith('/')
    ? endpoint
    : `/${endpoint}`;

  const url = `${API_BASE_URL}${path}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include',
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error: Error & { status?: number; data?: unknown } = new Error(
        data.message || `Request failed with status ${response.status}`,
      );
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data.data as T;
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    if (!e.status) {
      const networkError: Error & { status?: number } = new Error(
        `Unable to connect to API server at ${url}. Server may be offline.`,
      );
      networkError.status = 503;
      throw networkError;
    }
    throw err;
  }
}

/**
 * Fetch all available venues for event creation dropdowns.
 */
export async function getVenues(): Promise<Venue[]> {
  try {
    const result = await fetchApi<{ venues: Venue[] }>('/api/venues');
    return result.venues;
  } catch (err) {
    console.warn('Backend unavailable, using fallback mock venues:', err);
    return MOCK_VENUES;
  }
}

/**
 * Fetch approved events for the discovery feed.
 */
export async function getApprovedEvents(category?: string, search?: string): Promise<Event[]> {
  try {
    const params = new URLSearchParams();
    if (category && category !== 'All') params.append('category', category);
    if (search) params.append('search', search);

    const query = params.toString() ? `?${params.toString()}` : '';
    const result = await fetchApi<{ events: Event[] }>(`/api/events${query}`);
    return result.events;
  } catch (err) {
    console.warn('Backend unavailable, using fallback mock events:', err);
    let events = [...MOCK_EVENTS];
    if (category && category !== 'All') {
      events = events.filter((e) => e.category === category);
    }
    if (search) {
      const term = search.toLowerCase();
      events = events.filter(
        (e) => e.title.toLowerCase().includes(term) || e.description.toLowerCase().includes(term),
      );
    }
    return events;
  }
}

/**
 * Fetch all events created by the current organizer.
 */
export async function getMyEvents(): Promise<Event[]> {
  try {
    const result = await fetchApi<{ events: Event[] }>('/api/events/my-events');
    return result.events;
  } catch (err) {
    console.warn('Backend unavailable, using fallback organizer proposals:', err);
    return MOCK_PROPOSALS;
  }
}

/**
 * Fetch event proposals for Admin review.
 */
export async function getAdminProposals(status?: string): Promise<Event[]> {
  try {
    const query = status && status !== 'ALL' ? `?status=${status}` : '';
    const result = await fetchApi<{ events: Event[] }>(`/api/events/proposals${query}`);
    return result.events;
  } catch (err) {
    console.warn('Backend unavailable, using fallback admin proposals:', err);
    if (status && status !== 'ALL') {
      return MOCK_PROPOSALS.filter((e) => e.status === status);
    }
    return MOCK_PROPOSALS;
  }
}

/**
 * Live temporal venue conflict verification.
 */
export async function checkVenueConflict(params: {
  venueId: string;
  startTime: string;
  endTime: string;
  excludeEventId?: string;
}): Promise<ConflictCheckResult> {
  try {
    const query = new URLSearchParams({
      venueId: params.venueId,
      startTime: params.startTime,
      endTime: params.endTime,
      ...(params.excludeEventId ? { excludeEventId: params.excludeEventId } : {}),
    }).toString();

    const result = await fetchApi<ConflictCheckResult>(`/api/events/check-conflict?${query}`);
    return result;
  } catch {
    // Client-side fallback conflict check against mock data
    const start = new Date(params.startTime).getTime();
    const end = new Date(params.endTime).getTime();

    const colliding = MOCK_PROPOSALS.find((event) => {
      if (params.excludeEventId && event.id === params.excludeEventId) return false;
      if (event.venue.id !== params.venueId) return false;
      if (event.status !== 'APPROVED' && event.status !== 'PENDING_APPROVAL') return false;

      const evStart = new Date(event.startTime).getTime();
      const evEnd = new Date(event.endTime).getTime();

      // Temporal collision: (newStart < existingEnd AND newEnd > existingStart)
      return start < evEnd && end > evStart;
    });

    if (colliding) {
      return {
        hasConflict: true,
        conflictingEvent: {
          id: colliding.id,
          title: colliding.title,
          startTime: colliding.startTime,
          endTime: colliding.endTime,
          status: colliding.status,
          venueName: colliding.venue.name,
        },
      };
    }

    return { hasConflict: false };
  }
}

/**
 * Submit an event proposal (Organizer).
 */
export async function createEventProposal(data: {
  title: string;
  description: string;
  category: string;
  venueId: string;
  startTime: string;
  endTime: string;
  capacity: number;
  waitlistCapacity: number;
}): Promise<{ event: Event }> {
  return fetchApi<{ event: Event }>('/api/events', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Update event status (Admin approve/reject).
 */
export async function updateEventStatus(
  eventId: string,
  status: 'APPROVED' | 'REJECTED',
  reason?: string,
): Promise<{ event: Event }> {
  return fetchApi<{ event: Event }>(`/api/events/${eventId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, reason }),
  });
}

// ─── Authentication API ───────────────────────────────────────────────────────

/**
 * Fetch authenticated user session profile.
 * Gracefully returns null on 401, network failure, or SSR to prevent hydration crashes.
 */
export async function getMeApi(): Promise<User | null> {
  if (typeof window === 'undefined') return null;
  try {
    const result = await fetchApi<{ user: User }>('/api/auth/me');
    return result?.user ?? null;
  } catch {
    return null;
  }
}

/**
 * Log in with email and password.
 */
export async function loginApi(email: string, password: string): Promise<User> {
  const result = await fetchApi<{ user: User }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return result.user;
}

/**
 * Register a new user account.
 */
export async function registerApi(data: {
  name: string;
  email: string;
  password: string;
  role?: 'STUDENT' | 'ORGANIZER';
  department?: string;
}): Promise<User> {
  const result = await fetchApi<{ user: User }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return result.user;
}

/**
 * Log out and invalidate HTTP-only cookie session.
 */
export async function logoutApi(): Promise<void> {
  await fetchApi<void>('/api/auth/logout', {
    method: 'POST',
  });
}

// ─── Registration & Waitlist API ─────────────────────────────────────────────

/**
 * Register student for an event (concurrency-safe booking with optional seat selection).
 */
export async function registerForEventApi(
  eventId: string,
  seatNumber?: string,
): Promise<{
  status: 'CONFIRMED' | 'WAITLISTED';
  registration: Registration;
  waitlistPosition?: number | null;
  remainingSeats?: number;
  remainingWaitlistSlots?: number;
}> {
  return fetchApi<{
    status: 'CONFIRMED' | 'WAITLISTED';
    registration: Registration;
    waitlistPosition?: number | null;
    remainingSeats?: number;
    remainingWaitlistSlots?: number;
  }>(`/api/registrations/${eventId}`, {
    method: 'POST',
    body: seatNumber ? JSON.stringify({ seatNumber }) : undefined,
  });
}

/**
 * Cancel an active registration with automatic FIFO promotion of waitlisted student.
 */
export async function cancelRegistrationApi(registrationId: string): Promise<{
  cancelledRegistration: Registration;
  promoted?: {
    userId: string;
    registrationId: string;
    qrToken: string;
    status: string;
  } | null;
  remainingWaitlistCount: number;
}> {
  return fetchApi<{
    cancelledRegistration: Registration;
    promoted?: {
      userId: string;
      registrationId: string;
      qrToken: string;
      status: string;
    } | null;
    remainingWaitlistCount: number;
  }>(`/api/registrations/${registrationId}/cancel`, {
    method: 'POST',
  });
}

/**
 * Fetch all registrations for the logged-in student.
 */
export async function getMyRegistrationsApi(): Promise<Registration[]> {
  try {
    const result = await fetchApi<{ registrations: Registration[] }>(
      '/api/registrations/my-registrations',
    );
    return result.registrations;
  } catch (err) {
    console.warn('Backend unavailable or unauthenticated:', err);
    return [];
  }
}

/**
 * Retrieve real-time capacity and registration status for an event.
 */
export async function getEventRegistrationStatusApi(
  eventId: string,
): Promise<EventRegistrationStatus | null> {
  try {
    return await fetchApi<EventRegistrationStatus>(`/api/registrations/event/${eventId}`);
  } catch {
    return null;
  }
}

// ─── Phase 4: QR Check-In API ────────────────────────────────────────────────

/**
 * Organizer / Admin QR Code Ticket Check-In.
 * Validates ticket authenticity, confirms attendance, records check-in timestamp.
 */
export async function checkInTicketApi(qrToken: string): Promise<CheckInResult> {
  return fetchApi<CheckInResult>('/api/registrations/check-in', {
    method: 'POST',
    body: JSON.stringify({ qrToken: qrToken.trim() }),
  });
}

// ─── Phase 5: Enterprise Features & Governance ────────────────────────────────

/**
 * Admin: Get directory of all users with role distribution and registration counts.
 */
export async function getAdminUsersApi(params?: {
  page?: number;
  limit?: number;
  role?: string;
  search?: string;
}): Promise<AdminUserResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.append('page', String(params.page));
  if (params?.limit) query.append('limit', String(params.limit));
  if (params?.role && params.role !== 'ALL') query.append('role', params.role);
  if (params?.search) query.append('search', params.search);

  const qs = query.toString() ? `?${query.toString()}` : '';
  return fetchApi<AdminUserResponse>(`/api/admin/users${qs}`);
}

/**
 * Admin: Update user role (promote/demote between STUDENT, ORGANIZER, ADMIN).
 */
export async function updateUserRoleApi(
  userId: string,
  role: UserRole,
): Promise<{ user: User }> {
  return fetchApi<{ user: User }>(`/api/admin/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

/**
 * Admin: Delete a user account safely.
 */
export async function deleteUserApi(userId: string): Promise<{ message: string }> {
  return fetchApi<{ message: string }>(`/api/admin/users/${userId}`, {
    method: 'DELETE',
  });
}

/**
 * Helper to get the direct download URL for a verified certificate PDF.
 */
export function getCertificateUrl(registrationId: string): string {
  return `${API_BASE_URL}/registrations/${registrationId}/certificate`;
}

/**
 * Helper to get the direct EventSource SSE endpoint for live attendance.
 */
export function getLiveAttendanceUrl(eventId: string): string {
  return `${API_BASE_URL}/events/${eventId}/live-attendance`;
}

/**
 * Helper to get the CSV download URL for attendee roster.
 */
export function getExportRosterUrl(eventId: string): string {
  return `${API_BASE_URL}/events/${eventId}/export`;
}

/**
 * AI Assistant: Generate optimized description, agenda, tags, and prerequisites.
 */
export async function aiSuggestEventApi(data: {
  title: string;
  category: string;
  description?: string;
}): Promise<AiSuggestionResult> {
  return fetchApi<AiSuggestionResult>('/api/events/ai-suggest', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Teams: Create a new hackathon/competition team.
 */
export async function createTeamApi(eventId: string, name: string): Promise<{ team: Team }> {
  return fetchApi<{ team: Team }>('/api/teams', {
    method: 'POST',
    body: JSON.stringify({ eventId, name }),
  });
}

/**
 * Teams: Join an existing team using a 6-character team join code.
 */
export async function joinTeamApi(code: string): Promise<{ team: Team }> {
  return fetchApi<{ team: Team }>('/api/teams/join', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

/**
 * Teams: Fetch all teams for an event.
 */
export async function getEventTeamsApi(eventId: string): Promise<Team[]> {
  try {
    const res = await fetchApi<{ teams: Team[] }>(`/api/teams/event/${eventId}`);
    return res.teams || [];
  } catch {
    return [];
  }
}

/**
 * Announcements: Organizer broadcast announcement for an event.
 */
export async function createAnnouncementApi(
  eventId: string,
  title: string,
  message: string,
): Promise<{ announcement: Announcement }> {
  return fetchApi<{ announcement: Announcement }>(`/api/events/${eventId}/announcements`, {
    method: 'POST',
    body: JSON.stringify({ title, message }),
  });
}

/**
 * Announcements: Fetch all broadcast announcements for an event.
 */
export async function getEventAnnouncementsApi(eventId: string): Promise<Announcement[]> {
  try {
    const res = await fetchApi<{ announcements: Announcement[] }>(
      `/api/events/${eventId}/announcements`,
    );
    return res.announcements || [];
  } catch {
    return [];
  }
}

/**
 * Feedback: Submit post-event star rating and review.
 */
export async function submitFeedbackApi(
  eventId: string,
  rating: number,
  comment?: string,
): Promise<{ feedback: Feedback }> {
  return fetchApi<{ feedback: Feedback }>(`/api/events/${eventId}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ rating, comment }),
  });
}

/**
 * Feedback: Get feedback breakdown and reviews for an event.
 */
export async function getEventFeedbackApi(eventId: string): Promise<FeedbackStats> {
  try {
    return await fetchApi<FeedbackStats>(`/api/events/${eventId}/feedback`);
  } catch {
    return { feedback: [], summary: { count: 0, averageRating: 0 } };
  }
}

