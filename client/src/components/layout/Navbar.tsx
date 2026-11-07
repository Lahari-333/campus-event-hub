'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  CalendarDays,
  Menu,
  X,
  LogIn,
  LogOut,
  UserPlus,
  LayoutDashboard,
  PlusCircle,
  ShieldCheck,
  Compass,
  Loader2,
  QrCode,
  Users,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { UserRole } from '@/types';

// ─── Role-Based Navigation Link Definitions ─────────────────────────────────

const publicLinks = [
  { href: '/', label: 'Discover', icon: Compass },
];

const studentLinks = [
  { href: '/', label: 'Discover', icon: Compass },
  { href: '/student/registrations', label: 'My Registrations', icon: CalendarDays },
];

const organizerLinks = [
  { href: '/', label: 'Discover', icon: Compass },
  { href: '/organizer/my-events', label: 'My Events', icon: LayoutDashboard },
  { href: '/organizer/create-event', label: 'Propose Event', icon: PlusCircle },
  { href: '/organizer/check-in', label: 'Check-In Scanner', icon: QrCode },
];

const adminLinks = [
  { href: '/', label: 'Discover', icon: Compass },
  { href: '/admin/approvals', label: 'Admin Queue', icon: ShieldCheck },
  { href: '/admin/users', label: 'User Directory', icon: Users },
];

function getNavLinks(role?: UserRole | null) {
  if (!role) return publicLinks;
  switch (role) {
    case 'STUDENT':
      return studentLinks;
    case 'ORGANIZER':
      return organizerLinks;
    case 'ADMIN':
      return adminLinks;
    default:
      return publicLinks;
  }
}

function getRoleBadgeClasses(role: UserRole) {
  switch (role) {
    case 'STUDENT':
      return 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-300 dark:border-sky-800';
    case 'ORGANIZER':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-300 dark:border-purple-800';
    case 'ADMIN':
      return 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800';
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Navbar() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const navLinks = getNavLinks(user?.role);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsLoggingOut(false);
      setMobileOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* ─── Logo ───────────────────────────────────────────────────── */}
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-lg text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            aria-label="Campus Event Hub Home"
          >
            <CalendarDays className="h-6 w-6 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
            <span>Campus Event Hub</span>
          </Link>

          {/* ─── Desktop Navigation ─────────────────────────────────────── */}
          <nav className="hidden md:flex items-center gap-1.5" aria-label="Main navigation">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold
                           text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400
                           hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-all duration-200"
              >
                <link.icon className="h-4 w-4" aria-hidden="true" />
                {link.label}
              </Link>
            ))}
          </nav>

          {/* ─── Desktop Auth Controls ───────────────────────────────────── */}
          <div className="hidden md:flex items-center gap-3">
            {isLoading ? (
              <div className="h-9 w-24 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
            ) : isAuthenticated && user ? (
              <div className="flex items-center gap-3">
                {/* User Info Badge */}
                <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <div className="h-6 w-6 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-white">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200 max-w-[130px] truncate">
                    {user.name}
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${getRoleBadgeClasses(
                      user.role,
                    )}`}
                  >
                    {user.role}
                  </span>
                </div>

                {/* Logout Button */}
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium
                             text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400
                             hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all duration-200 disabled:opacity-50"
                  aria-label="Log out"
                >
                  {isLoggingOut ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                  )}
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <Link
                  href="/login"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold
                             text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400
                             hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200"
                >
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold
                             bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800
                             shadow-xs transition-all duration-200"
                >
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                  Sign Up
                </Link>
              </div>
            )}
          </div>

          {/* ─── Mobile Menu Toggle ──────────────────────────────────────── */}
          <button
            className="md:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300
                       hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* ─── Mobile Drawer Menu ───────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-fade-in"
          role="navigation"
          aria-label="Mobile navigation"
        >
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium
                           text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400
                           hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                <link.icon className="h-4 w-4" aria-hidden="true" />
                {link.label}
              </Link>
            ))}

            {/* Mobile Auth Section */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 mt-3">
              {isLoading ? (
                <div className="h-10 w-full bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
              ) : isAuthenticated && user ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-white">
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{user.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${getRoleBadgeClasses(
                        user.role,
                      )}`}
                    >
                      {user.role}
                    </span>
                  </div>

                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
                               text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Logout
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Link
                    href="/login"
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                               text-sm font-semibold text-slate-700 dark:text-slate-300 border border-slate-300
                               dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    onClick={() => setMobileOpen(false)}
                  >
                    <LogIn className="h-4 w-4" aria-hidden="true" />
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                               text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                    onClick={() => setMobileOpen(false)}
                  >
                    <UserPlus className="h-4 w-4" aria-hidden="true" />
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
