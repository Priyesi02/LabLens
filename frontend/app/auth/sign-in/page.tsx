'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { requestLoginOTP, verifyLoginOTP, setStoredUserEmail, getIdToken } from '@/utils/aws-cognito';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  useEffect(() => {
    if (searchParams.get('registered') === 'true') {
      setInfoMessage('Account confirmed successfully! Enter your email to log in.');
      const autoEmail = searchParams.get('email');
      if (autoEmail) {
        setEmail(decodeURIComponent(autoEmail));
      }
    }
  }, [searchParams]);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const normalizedEmail = email.trim().toLowerCase();

    try {
      const result = await requestLoginOTP(normalizedEmail);
      if (!result.success) {
        throw new Error(result.error || 'Could not send login code.');
      }
      setStep('otp');
      setInfoMessage(`Enter the code sent to ${normalizedEmail}.`);
    } catch (err: any) {
      setError(err.message || 'Could not send login code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await verifyLoginOTP(otpCode.trim());
      if (!result.success) {
        throw new Error(result.error || 'Invalid or expired code.');
      }

      const normalizedEmail = email.trim().toLowerCase();
      setStoredUserEmail(normalizedEmail);

      try {
        const idToken = await getIdToken();
        const backendCheck = await fetch(`${API_BASE_URL}/api/patient/has-records`, {
          headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
        });
        const data = await backendCheck.json();

        router.push(data.hasRecords === true ? '/dashboard/results' : '/dashboard');
      } catch {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Could not verify code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-card p-8 rounded-2xl shadow-card border border-line/40 transition-all hover:shadow-card-hover">

      {/* Brand Header */}
      <div className="flex flex-col items-center mb-8 text-center">
        <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center mb-3 shadow-glow/10">
          <span className="w-3 h-3 rounded-full bg-teal-500" />
        </div>
        <h1 className="font-display text-2xl font-semibold text-ink tracking-tightish">
          Clinical Gateway
        </h1>
        <p className="text-muted text-sm mt-1 font-light">
          {step === 'email'
            ? 'Enter your registered email to access your workspace'
            : 'Enter the verification code sent to your email'}
        </p>
      </div>

      {infoMessage && (
        <div className="mb-5 p-3.5 rounded-sm bg-status-success-bg text-status-success text-xs font-medium border border-status-success/10 text-center">
          {infoMessage}
        </div>
      )}

      {error && (
        <div className="mb-5 p-3.5 rounded-sm bg-status-danger-bg text-status-danger text-xs font-medium border border-status-danger/10 text-center">
          {error}
        </div>
      )}

      {step === 'email' ? (
        <form onSubmit={handleRequestOtp} className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-ink-soft tracking-wideish uppercase mb-1.5">
              Registered Email Address
            </label>
            <input
              type="email" required placeholder="john@example.com"
              value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-canvas border border-line rounded-md text-ink text-sm placeholder-faint focus:outline-none focus:border-teal-400 transition-all font-light"
            />
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full py-3 px-4 bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-xl shadow-glow hover:shadow-glow-hover transition-all text-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Sending Code...' : 'Send Login Code'}
          </button>

          <div className="text-center mt-6">
            <p className="text-xs text-muted font-light">
              First profile setup?{' '}
              <button type="button" onClick={() => router.push('/auth/sign-up')} className="text-teal-600 hover:text-teal-500 font-medium transition-colors">
                Create patient record
              </button>
            </p>
          </div>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-ink-soft tracking-wideish uppercase mb-1.5">
              Verification Code
            </label>
            <input
              type="text" inputMode="numeric" required placeholder="123456" autoFocus
              value={otpCode} onChange={e => setOtpCode(e.target.value)}
              className="w-full px-4 py-3 bg-canvas border border-line rounded-md text-ink text-sm placeholder-faint focus:outline-none focus:border-teal-400 transition-all font-light tracking-widest text-center"
            />
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full py-3 px-4 bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-xl shadow-glow hover:shadow-glow-hover transition-all text-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Verifying...' : 'Verify & Sign In'}
          </button>

          <div className="text-center mt-6">
            <button
              type="button"
              onClick={() => { setStep('email'); setOtpCode(''); setError(''); setInfoMessage(''); }}
              className="text-xs text-teal-600 hover:text-teal-500 font-medium transition-colors"
            >
              Use a different email
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4 py-12 font-body animate-fade-up">
      <Suspense fallback={<div className="text-teal-500 text-sm">Loading security portal...</div>}>
        <SignInForm />
      </Suspense>
    </div>
  );
}
