'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  Shield,
  GraduationCap,
  Sparkles,
  Search,
  Filter,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  ChevronDown,
  UserCheck,
} from 'lucide-react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { getAdminUsersApi, updateUserRoleApi, deleteUserApi } from '@/lib/api';
import type { AdminUserItem, AdminUserStats, UserRole } from '@/types';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [stats, setStats] = useState<AdminUserStats>({
    totalUsers: 0,
    students: 0,
    organizers: 0,
    admins: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<AdminUserItem | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getAdminUsersApi({
        search: search || undefined,
        role: roleFilter !== 'ALL' ? roleFilter : undefined,
      });
      setUsers(res.users);
      setStats(res.stats);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setToast({
        type: 'error',
        text: e.message || 'Failed to load user directory.',
      });
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      setActionUserId(userId);
      await updateUserRoleApi(userId, newRole);
      setToast({
        type: 'success',
        text: `Role successfully updated to ${newRole}.`,
      });
      await fetchUsers();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setToast({
        type: 'error',
        text: e.message || 'Failed to update user role.',
      });
    } finally {
      setActionUserId(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteConfirmUser) return;
    try {
      setActionUserId(deleteConfirmUser.id);
      await deleteUserApi(deleteConfirmUser.id);
      setToast({
        type: 'success',
        text: `User ${deleteConfirmUser.name} deleted successfully.`,
      });
      setDeleteConfirmUser(null);
      await fetchUsers();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setToast({
        type: 'error',
        text: e.message || 'Failed to delete user.',
      });
    } finally {
      setActionUserId(null);
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <Shield className="w-3 h-3" /> Admin
          </span>
        );
      case 'ORGANIZER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            <Sparkles className="w-3 h-3" /> Organizer
          </span>
        );
      case 'STUDENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
            <GraduationCap className="w-3 h-3" /> Student
          </span>
        );
    }
  };

  return (
    <ProtectedRoute allowedRoles={['ADMIN']}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Link
                  href="/admin/approvals"
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Approvals
                </Link>
              </div>
              <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                <Users className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                User Management & Directory
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Oversee platform members, assign elevated permissions, and govern campus community accounts.
              </p>
            </div>
          </div>

          {/* Toast Notification */}
          {toast && (
            <div
              className={`p-4 rounded-xl border flex items-center justify-between text-sm transition-all ${
                toast.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {toast.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                )}
                <span>{toast.text}</span>
              </div>
              <button
                onClick={() => setToast(null)}
                className="text-xs font-semibold underline ml-4 hover:opacity-80"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Metric Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Total Registered
                  </p>
                  <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                    {stats.totalUsers}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                  <Users className="w-6 h-6" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                    Active Students
                  </p>
                  <p className="text-3xl font-black text-sky-900 dark:text-sky-100 mt-1">
                    {stats.students}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-950 flex items-center justify-center text-sky-600 dark:text-sky-400">
                  <GraduationCap className="w-6 h-6" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                    Organizers
                  </p>
                  <p className="text-3xl font-black text-purple-900 dark:text-purple-100 mt-1">
                    {stats.organizers}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <Sparkles className="w-6 h-6" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                    Administrators
                  </p>
                  <p className="text-3xl font-black text-rose-900 dark:text-rose-100 mt-1">
                    {stats.admins}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950 flex items-center justify-center text-rose-600 dark:text-rose-400">
                  <Shield className="w-6 h-6" />
                </div>
              </div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by student name or email..."
                className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <Filter className="w-3.5 h-3.5" /> Filter Role:
              </div>
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                {(['ALL', 'STUDENT', 'ORGANIZER', 'ADMIN'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRoleFilter(r)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                      roleFilter === r
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            {loading ? (
              <div className="p-16 flex flex-col items-center justify-center text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
                <p className="text-sm font-medium">Loading user records...</p>
              </div>
            ) : users.length === 0 ? (
              <div className="p-16 text-center">
                <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No users found</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Try adjusting your search criteria or role filters.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase text-xs font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-6 py-4">User</th>
                      <th className="px-6 py-4">Department</th>
                      <th className="px-6 py-4">Role</th>
                      <th className="px-6 py-4">Registrations</th>
                      <th className="px-6 py-4">Joined</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {users.map((u) => {
                      const isActing = actionUserId === u.id;
                      const initials = u.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase();

                      return (
                        <tr
                          key={u.id}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0">
                                {initials || 'U'}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-900 dark:text-white">
                                  {u.name}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                                  {u.email}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                            {u.department || (
                              <span className="text-slate-400 italic">None specified</span>
                            )}
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {getRoleBadge(u.role)}
                              <div className="relative inline-block">
                                <select
                                  disabled={isActing}
                                  value={u.role}
                                  onChange={(e) =>
                                    handleRoleChange(u.id, e.target.value as UserRole)
                                  }
                                  className="text-xs font-semibold py-1 pl-2 pr-6 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer disabled:opacity-50"
                                >
                                  <option value="STUDENT">Student</option>
                                  <option value="ORGANIZER">Organizer</option>
                                  <option value="ADMIN">Admin</option>
                                </select>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs">
                              <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                              {u.totalRegistrations} events
                            </span>
                          </td>

                          <td className="px-6 py-4 text-xs text-slate-500 font-mono">
                            {new Date(u.createdAt).toLocaleDateString()}
                          </td>

                          <td className="px-6 py-4 text-right">
                            <button
                              disabled={isActing}
                              onClick={() => setDeleteConfirmUser(u)}
                              title="Delete User Account"
                              className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition disabled:opacity-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {deleteConfirmUser && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
                <AlertCircle className="w-7 h-7" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Confirm Account Deletion
                </h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Are you sure you want to delete user{' '}
                <strong className="text-slate-900 dark:text-white">
                  {deleteConfirmUser.name}
                </strong>{' '}
                ({deleteConfirmUser.email})? This action removes their access and associated records.
              </p>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmUser(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteUser}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition"
                >
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
