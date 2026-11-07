'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import {
  QrCode,
  Scan,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Ban,
  Clock,
  User,
  Building,
  Calendar,
  Sparkles,
  Loader2,
  RotateCcw,
  ArrowLeft,
  ShieldCheck,
  ClipboardPaste,
  Camera,
  Layers,
} from 'lucide-react';
import { checkInTicketApi } from '@/lib/api';
import type { CheckInResult } from '@/types';

// Web Audio API feedback generator (no external sound files required)
function playFeedbackTone(type: 'success' | 'duplicate' | 'error') {
  try {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (type === 'success') {
      // Pleasant double-chime (880Hz -> 1320Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, ctx.currentTime);
      gain1.gain.setValueAtTime(0.15, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.15);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1320, ctx.currentTime + 0.12);
      gain2.gain.setValueAtTime(0.15, ctx.currentTime + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(ctx.currentTime + 0.12);
      osc2.stop(ctx.currentTime + 0.35);
    } else if (type === 'duplicate') {
      // Low dual warning buzzer (260Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } else {
      // Harsh rejection tone (180Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch {
    // Ignore audio failures if browser blocks autoplay audio
  }
}

interface ScanHistoryEntry {
  id: string;
  qrToken: string;
  status: 'SUCCESS' | 'DUPLICATE' | 'DENIED' | 'INVALID';
  studentName?: string;
  eventTitle?: string;
  timestamp: string;
  details?: string;
}

export default function OrganizerCheckInPage() {
  const { user } = useAuth();
  const [qrInput, setQrInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [activeTab, setActiveTab] = useState<'console' | 'history'>('console');
  const [lastResult, setLastResult] = useState<{
    type: 'success' | 'duplicate' | 'denied' | 'invalid';
    title: string;
    message: string;
    data?: CheckInResult;
    rawToken: string;
    timestamp: string;
  } | null>(null);

  const [scanHistory, setScanHistory] = useState<ScanHistoryEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleVerify = async (tokenToVerify?: string) => {
    const token = (tokenToVerify || qrInput).trim();
    if (!token) return;

    setIsVerifying(true);
    setLastResult(null);

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    try {
      const response = await checkInTicketApi(token);

      playFeedbackTone('success');
      setLastResult({
        type: 'success',
        title: 'Check-In Verified!',
        message: response.message,
        data: response,
        rawToken: token,
        timestamp: timeStr,
      });

      setScanHistory((prev) => [
        {
          id: `scan-${Date.now()}`,
          qrToken: token,
          status: 'SUCCESS',
          studentName: response.student.name,
          eventTitle: response.event.title,
          timestamp: timeStr,
        },
        ...prev,
      ]);

      setQrInput('');
      inputRef.current?.focus();
    } catch (err: unknown) {
      const errorObj = err as { status?: number; message?: string };
      const status = errorObj.status;
      const message = errorObj.message || 'Verification failed';

      if (status === 409) {
        // Duplicate scan
        playFeedbackTone('duplicate');
        setLastResult({
          type: 'duplicate',
          title: 'Duplicate Scan Warning',
          message,
          rawToken: token,
          timestamp: timeStr,
        });
        setScanHistory((prev) => [
          {
            id: `scan-${Date.now()}`,
            qrToken: token,
            status: 'DUPLICATE',
            timestamp: timeStr,
            details: message,
          },
          ...prev,
        ]);
      } else if (status === 400) {
        // Waitlisted or cancelled
        playFeedbackTone('error');
        setLastResult({
          type: 'denied',
          title: 'Entry Denied',
          message,
          rawToken: token,
          timestamp: timeStr,
        });
        setScanHistory((prev) => [
          {
            id: `scan-${Date.now()}`,
            qrToken: token,
            status: 'DENIED',
            timestamp: timeStr,
            details: message,
          },
          ...prev,
        ]);
      } else {
        // 404 or other error
        playFeedbackTone('error');
        setLastResult({
          type: 'invalid',
          title: 'Invalid QR Code',
          message: message.includes('Invalid') ? message : 'Ticket token not found in database',
          rawToken: token,
          timestamp: timeStr,
        });
        setScanHistory((prev) => [
          {
            id: `scan-${Date.now()}`,
            qrToken: token,
            status: 'INVALID',
            timestamp: timeStr,
            details: message,
          },
          ...prev,
        ]);
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setQrInput(text);
        handleVerify(text);
      }
    } catch {
      inputRef.current?.focus();
    }
  };

  return (
    <ProtectedRoute allowedRoles={['ORGANIZER', 'ADMIN']}>
      <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                <QrCode className="w-3.5 h-3.5" />
                Phase 4 · Check-In Engine
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                <ShieldCheck className="w-3.5 h-3.5" />
                Live Validator
              </span>
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
              <Scan className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
              Event Check-In & Scanner Console
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Welcome, <strong className="text-slate-800 dark:text-slate-200">{user?.name}</strong>.
              Scan attendee QR codes or enter ticket tokens to verify attendance and prevent duplicate entry.
            </p>
          </div>

          <Link
            href="/organizer/my-events"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to My Events
          </Link>
        </div>

        {/* Tab Toggle */}
        <div className="border-b border-slate-200 dark:border-slate-800 flex gap-4">
          <button
            onClick={() => setActiveTab('console')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'console'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Scan className="w-4 h-4" />
            Scanner Console
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'history'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Layers className="w-4 h-4" />
            Session History
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {scanHistory.length}
            </span>
          </button>
        </div>

        {activeTab === 'console' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* ─── LEFT: Scanner Viewport & Input Console (7 cols) ─────────── */}
            <div className="lg:col-span-7 space-y-6">
              {/* Simulated Camera Viewfinder */}
              <div className="relative rounded-3xl bg-slate-900 border-2 border-indigo-500/50 overflow-hidden p-6 aspect-video flex flex-col items-center justify-center text-center shadow-md">
                {/* Viewfinder corners */}
                <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-indigo-400 rounded-tl-lg" />
                <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-indigo-400 rounded-tr-lg" />
                <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-indigo-400 rounded-bl-lg" />
                <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-indigo-400 rounded-br-lg" />

                {/* Animated Scanning Laser Line */}
                <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent shadow-[0_0_15px_#6366f1] animate-pulse" />

                <Camera className="w-12 h-12 text-indigo-400/80 mb-3 animate-bounce" />
                <h3 className="text-sm font-bold text-white tracking-wide">
                  Active Optical Scanner Ready
                </h3>
                <p className="text-xs text-slate-400 max-w-xs mt-1">
                  Point handheld camera or barcode reader at student ticket QR token.
                </p>

                <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    LISTENING FOR INPUT
                  </span>
                </div>
              </div>

              {/* Manual Entry Form */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
                <label
                  htmlFor="qr-input"
                  className="block text-sm font-bold text-slate-900 dark:text-white"
                >
                  Manual QR Token Verification
                </label>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleVerify();
                  }}
                  className="flex gap-2"
                >
                  <div className="relative flex-1">
                    <input
                      id="qr-input"
                      ref={inputRef}
                      type="text"
                      placeholder="e.g. QR-CAMPUS-2026-HACK-001 or scan token..."
                      value={qrInput}
                      onChange={(e) => setQrInput(e.target.value)}
                      className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={handlePaste}
                      title="Paste from clipboard"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-indigo-600 transition"
                    >
                      <ClipboardPaste className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={isVerifying || !qrInput.trim()}
                    className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-sm transition shadow-xs disabled:opacity-50 flex items-center gap-2 shrink-0"
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        Verify
                      </>
                    )}
                  </button>
                </form>

                {/* Quick-Scan Demo Presets */}
                <div className="pt-2">
                  <p className="text-xs font-semibold text-slate-400 mb-2">
                    Quick-Scan Demo Presets:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setQrInput('QR-CAMPUS-2026-HACK-001');
                        handleVerify('QR-CAMPUS-2026-HACK-001');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 dark:bg-slate-800 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300 text-[11px] font-mono text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 transition"
                    >
                      ✓ Sample Valid Token
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setQrInput('QR-INVALID-FRAUD-999');
                        handleVerify('QR-INVALID-FRAUD-999');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-red-50 hover:text-red-700 dark:bg-slate-800 dark:hover:bg-red-950/40 dark:hover:text-red-300 text-[11px] font-mono text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 transition"
                    >
                      ✗ Sample Invalid Token
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ─── RIGHT: Verification Verdict & Details Panel (5 cols) ────── */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm min-h-[420px] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      Scanner Result Card
                    </h3>
                    <span className="text-xs font-mono text-slate-400">
                      {lastResult?.timestamp || 'Waiting...'}
                    </span>
                  </div>

                  {lastResult ? (
                    <div className="space-y-6 animate-slide-up">
                      {/* Success Banner */}
                      {lastResult.type === 'success' && (
                        <div className="space-y-5">
                          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center gap-3.5">
                            <CheckCircle2 className="w-10 h-10 text-emerald-600 shrink-0" />
                            <div>
                              <h4 className="text-base font-extrabold text-emerald-900 dark:text-emerald-200">
                                ENTRY GRANTED
                              </h4>
                              <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                                Verified official attendee pass.
                              </p>
                            </div>
                          </div>

                          {/* Student & Event Card */}
                          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                            <div className="flex items-start gap-3">
                              <User className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                              <div className="space-y-0.5">
                                <p className="text-xs font-bold text-slate-400 uppercase">Student</p>
                                <p className="text-base font-bold text-slate-900 dark:text-white">
                                  {lastResult.data?.student.name}
                                </p>
                                <p className="text-xs text-slate-500 font-mono">
                                  {lastResult.data?.student.email}
                                </p>
                                {lastResult.data?.student.department && (
                                  <span className="inline-block text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                                    Dept: {lastResult.data.student.department}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="border-t border-slate-200 dark:border-slate-700 pt-3 flex items-start gap-3">
                              <Calendar className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                              <div className="space-y-0.5">
                                <p className="text-xs font-bold text-slate-400 uppercase">Event</p>
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                  {lastResult.data?.event.title}
                                </p>
                                {lastResult.data?.event.venue && (
                                  <p className="text-xs text-slate-500">
                                    Venue: {lastResult.data.event.venue.name}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex items-center justify-between text-xs text-slate-500">
                              <span>Verified Status:</span>
                              <span className="font-bold text-emerald-600 font-mono">
                                CHECKED_IN
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Duplicate Scan Warning */}
                      {lastResult.type === 'duplicate' && (
                        <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border-2 border-amber-400 dark:border-amber-700 space-y-3">
                          <div className="flex items-center gap-3">
                            <AlertTriangle className="w-8 h-8 text-amber-600 shrink-0" />
                            <div>
                              <h4 className="text-base font-extrabold text-amber-900 dark:text-amber-200">
                                DUPLICATE SCAN
                              </h4>
                              <p className="text-xs text-amber-700 dark:text-amber-300">
                                Ticket has already been scanned.
                              </p>
                            </div>
                          </div>
                          <p className="text-xs text-amber-800 dark:text-amber-300 font-mono bg-white/60 dark:bg-slate-900/60 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800">
                            {lastResult.message}
                          </p>
                        </div>
                      )}

                      {/* Denied / Waitlisted Banner */}
                      {lastResult.type === 'denied' && (
                        <div className="p-5 rounded-2xl bg-red-50 dark:bg-red-950/50 border-2 border-red-400 dark:border-red-700 space-y-3">
                          <div className="flex items-center gap-3">
                            <Ban className="w-8 h-8 text-red-600 shrink-0" />
                            <div>
                              <h4 className="text-base font-extrabold text-red-900 dark:text-red-200">
                                ENTRY DENIED
                              </h4>
                              <p className="text-xs text-red-700 dark:text-red-300">
                                Registration not confirmed.
                              </p>
                            </div>
                          </div>
                          <p className="text-xs text-red-800 dark:text-red-300 font-mono bg-white/60 dark:bg-slate-900/60 p-2.5 rounded-lg border border-red-200 dark:border-red-800">
                            {lastResult.message}
                          </p>
                        </div>
                      )}

                      {/* Invalid Code Banner */}
                      {lastResult.type === 'invalid' && (
                        <div className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border-2 border-rose-400 dark:border-rose-700 space-y-3">
                          <div className="flex items-center gap-3">
                            <XCircle className="w-8 h-8 text-rose-600 shrink-0" />
                            <div>
                              <h4 className="text-base font-extrabold text-rose-900 dark:text-rose-200">
                                INVALID TICKET CODE
                              </h4>
                              <p className="text-xs text-rose-700 dark:text-rose-300">
                                QR token not recognized.
                              </p>
                            </div>
                          </div>
                          <p className="text-xs text-rose-800 dark:text-rose-300 font-mono bg-white/60 dark:bg-slate-900/60 p-2.5 rounded-lg border border-rose-200 dark:border-rose-800">
                            Token: {lastResult.rawToken}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 space-y-2">
                      <Scan className="w-12 h-12 text-slate-300 dark:text-slate-700" />
                      <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                        No Scans Yet
                      </p>
                      <p className="text-xs max-w-xs text-slate-400">
                        Scan or submit a ticket QR token to inspect attendee credentials.
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>Session Scans: {scanHistory.length}</span>
                  <button
                    onClick={() => {
                      setLastResult(null);
                      setQrInput('');
                      inputRef.current?.focus();
                    }}
                    className="hover:text-indigo-600 transition flex items-center gap-1 font-semibold"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ─── TAB 2: Scan Session History Table ────────────────────────── */
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Recent Scans Log ({scanHistory.length})
              </h3>
              {scanHistory.length > 0 && (
                <button
                  onClick={() => setScanHistory([])}
                  className="text-xs text-red-600 hover:underline font-semibold"
                >
                  Clear History
                </button>
              )}
            </div>

            {scanHistory.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-12">
                No tickets scanned in this session yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-slate-400 border-b border-slate-200 dark:border-slate-800 uppercase font-mono">
                    <tr>
                      <th className="py-2.5 px-3">Time</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">QR Token</th>
                      <th className="py-2.5 px-3">Student / Event</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {scanHistory.map((scan) => (
                      <tr key={scan.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-mono text-slate-500">{scan.timestamp}</td>
                        <td className="py-2.5 px-3">
                          {scan.status === 'SUCCESS' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                              ✓ Verified
                            </span>
                          )}
                          {scan.status === 'DUPLICATE' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                              ⚠ Duplicate
                            </span>
                          )}
                          {scan.status === 'DENIED' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300">
                              ✗ Denied
                            </span>
                          )}
                          {scan.status === 'INVALID' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                              ✗ Invalid
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300">
                          {scan.qrToken}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                          {scan.studentName ? (
                            <div>
                              <strong className="text-slate-800 dark:text-slate-200">
                                {scan.studentName}
                              </strong>{' '}
                              — {scan.eventTitle}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">
                              {scan.details || 'Check-in rejected'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
