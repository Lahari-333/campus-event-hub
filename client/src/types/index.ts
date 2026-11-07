// ─── Type Definitions ──────────────────────────────────────────────────────

export type UserRole = 'STUDENT' | 'ORGANIZER' | 'ADMIN';

export type EventStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export type EventCategory = 'Hackathon' | 'Technical' | 'Cultural' | 'Workshop' | 'Other';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string | null;
  createdAt: string;
}

export interface Venue {
  id: string;
  name: string;
  capacity: number;
  location: string;
  isAvailable: boolean;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  startTime: string;
  endTime: string;
  capacity: number;
  waitlistCapacity: number;
  status: EventStatus;
  registeredCount?: number;
  waitlistedCount?: number;
  remainingSeats?: number;
  remainingWaitlistSlots?: number;
  venue: Venue;
  organizer: Pick<User, 'id' | 'name' | 'email'>;
  createdAt: string;
}

export interface VenueConflict {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  status: EventStatus;
  venueName?: string;
}

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflictingEvent?: VenueConflict;
}

export type RegistrationStatus =
  | 'CONFIRMED'
  | 'WAITLISTED'
  | 'CANCELLED'
  | 'ATTENDED'
  | 'CHECKED_IN';

export interface Registration {
  id: string;
  eventId: string;
  userId: string;
  status: RegistrationStatus;
  qrToken?: string | null;
  waitlistPosition?: number | null;
  seatNumber?: string | null;
  checkedInAt?: string | null;
  registeredAt: string;
  event?: Event;
  user?: Pick<User, 'id' | 'name' | 'email' | 'department'>;
}

export interface CheckInResult {
  message: string;
  registration: Registration;
  student: Pick<User, 'id' | 'name' | 'email' | 'department'>;
  event: Pick<Event, 'id' | 'title' | 'category'> & {
    venue?: { name: string; location: string };
  };
  checkedInAt: string;
  confirmedBadge: boolean;
}

export interface EventRegistrationStatus {
  eventId: string;
  capacity: number;
  waitlistCapacity: number;
  confirmedCount: number;
  waitlistedCount: number;
  remainingSeats: number;
  remainingWaitlistSlots: number;
  isCapacityFull: boolean;
  isWaitlistFull: boolean;
  isSoldOut: boolean;
  userRegistration?: {
    id: string;
    status: RegistrationStatus;
    qrToken?: string | null;
    waitlistPosition?: number | null;
    seatNumber?: string | null;
    registeredAt: string;
  } | null;
}

// ─── Additional Enterprise Features Types ─────────────────────────────────────

export interface AdminUserItem extends User {
  totalRegistrations: number;
}

export interface AdminUserStats {
  totalUsers: number;
  students: number;
  organizers: number;
  admins: number;
}

export interface AdminUserResponse {
  stats: AdminUserStats;
  users: AdminUserItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface Announcement {
  id: string;
  eventId: string;
  title: string;
  message: string;
  createdAt: string;
}

export interface Feedback {
  id: string;
  eventId: string;
  userId: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
  user?: Pick<User, 'id' | 'name' | 'department'>;
}

export interface FeedbackStats {
  feedback: Feedback[];
  summary: {
    count: number;
    averageRating: number;
  };
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: string;
  joinedAt: string;
  user: Pick<User, 'id' | 'name' | 'email' | 'department'>;
}

export interface Team {
  id: string;
  eventId: string;
  name: string;
  code: string;
  members: TeamMember[];
  createdAt: string;
}

export interface AiSuggestionResult {
  suggestedDescription: string;
  agenda: string[];
  suggestedTags: string[];
  prerequisites: string;
}

