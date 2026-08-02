'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { registerPatient, confirmRegistration, autoLoginAfterSignUp, setStoredUserEmail } from '@/utils/aws-cognito';

// Cognito requires E.164 format (e.g. +919876543210). A plain 10-digit
// Indian number entered without a country code fails with a cryptic
// "Invalid phone number format" error, so normalize it here first.
function toE164(phone: string): string {
  const digitsOnly = phone.replace(/[\s-]/g, '');
  if (digitsOnly.startsWith('+')) return digitsOnly;
  if (/^\d{10}$/.test(digitsOnly)) return `+91${digitsOnly}`;
  return digitsOnly;
}

export default function SignUpPage() {
  const router = useRouter();
  const [step, setStep] = useState<'FIELDS' | 'VERIFY'>('FIELDS');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [savedPassword, setSavedPassword] = useState(''); 

  const [formData, setFormData] = useState({
    name: '',
    email: '', 
    phoneNumber: '', 
    age: '',
    sex: 'Male',
    emergencyName: '',
    emergencyPhone: '', 
    language: 'English'
  });
  
  const [verificationCode, setVerificationCode] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!formData.email.includes('@')) {
      setError('Please enter a valid email address.');
      setLoading(false);
      return;
    }

    const res = await registerPatient({
      name: formData.name,
      email: formData.email,
      phoneNumber: toE164(formData.phoneNumber),
      age: Number(formData.age),
      sex: formData.sex,
      emergencyName: formData.emergencyName,
      emergencyPhone: toE164(formData.emergencyPhone),
      language: formData.language
    });

    setLoading(false);
    if (res.success) {
      if (res.generatedPassword) {
        setSavedPassword(res.generatedPassword);
      }
      setStep('VERIFY');
    } else {
      setError(res.error || 'Registration failed');
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await confirmRegistration(formData.email, verificationCode);

    if (res.success) {
      // FIX: Add a 2-second sleep delay to allow Cognito DB clusters to replicate the "CONFIRMED" state flags
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Execute Silent Auto-Login using the validated email string
      const loginRes = await autoLoginAfterSignUp(formData.email, savedPassword);
      setLoading(false);

      if (loginRes.success) {
        setStoredUserEmail(formData.email);
        // Flow Requirement: First-time users are always directed straight to the clean upload interface panel
        router.push('/dashboard');
      } else {
        // Fallback: If network lag intercepts the token extraction, push to sign-in with clean context parameters
        router.push(`/auth/sign-in?registered=true&email=${encodeURIComponent(formData.email)}`);
      }
    } else {
      setError(res.error || 'Invalid verification code');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4 py-12 font-body animate-fade-up">
      <div className="w-full max-w-lg bg-card p-8 rounded-2xl shadow-card border border-line/40 transition-all hover:shadow-card-hover">
        
        {/* Header Block */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center mb-3 shadow-glow/10">
            <span className="w-3 h-3 rounded-full bg-teal-500 animate-pulse-dot" />
          </div>
          <h1 className="font-display text-2xl font-semibold text-ink tracking-tightish">
            {step === 'FIELDS' ? 'Patient Registration' : 'Verify Your Email'}
          </h1>
          <p className="text-muted text-sm mt-1 font-light">
            {step === 'FIELDS' 
              ? 'Provide core metrics for health profile creation' 
              : `Enter the security verification code sent to ${formData.email}`}
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-sm bg-status-danger-bg text-status-danger text-xs font-medium border border-status-danger/10">
            {error}
          </div>
        )}

        {step === 'FIELDS' ? (
          <form onSubmit={handleRegister} className="space-y-5">
            <h3 className="text-xs font-medium text-teal-600 tracking-wideish uppercase border-b border-line pb-1.5">
              1. Basic Information
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-ink-soft mb-1.5">Full Name</label>
                <input
                  type="text" required placeholder="John Doe"
                  value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2.5 bg-canvas border border-line rounded-md text-ink text-sm placeholder-faint focus:outline-none focus:border-teal-400 transition-all font-light"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-soft mb-1.5">Email Address</label>
                <input
                  type="email" required placeholder="john@example.com"
                  value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-2.5 bg-canvas border border-line rounded-md text-ink text-sm placeholder-faint focus:outline-none focus:border-teal-400 transition-all font-light"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-ink-soft mb-1.5">Personal Phone Number</label>
                <input
                  type="tel" required placeholder="+919876543210"
                  value={formData.phoneNumber} onChange={e => setFormData({...formData, phoneNumber: e.target.value})}
                  className="w-full px-4 py-2.5 bg-canvas border border-line rounded-md text-ink text-sm placeholder-faint focus:outline-none focus:border-teal-400 transition-all font-light"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-soft mb-1.5">Age</label>
                <input
                  type="number" required placeholder="32"
                  value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})}
                  className="w-full px-4 py-2.5 bg-canvas border border-line rounded-md text-ink text-sm placeholder-faint focus:outline-none focus:border-teal-400 transition-all font-light"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-ink-soft mb-1.5">Sex</label>
                <select
                  value={formData.sex} onChange={e => setFormData({...formData, sex: e.target.value})}
                  className="w-full px-4 py-2.5 bg-canvas border border-line rounded-md text-ink text-sm focus:outline-none focus:border-teal-400 transition-all font-light appearance-none"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-soft mb-1.5">Preferred Language</label>
                <select
                  value={formData.language} onChange={e => setFormData({...formData, language: e.target.value})}
                  className="w-full px-4 py-2.5 bg-canvas border border-line rounded-md text-ink text-sm focus:outline-none focus:border-teal-400 transition-all font-light appearance-none"
                >
                  <option value="English">English</option>
                  <option value="Hindi">Hindi</option>
                </select>
              </div>
            </div>

            <h3 className="text-xs font-medium text-teal-600 tracking-wideish uppercase border-b border-line pb-1.5 pt-2">
              2. Medical Safety Contacts (Critical Alerts Pipeline)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-ink-soft mb-1.5">Emergency Contact Name</label>
                <input
                  type="text" required placeholder="Jane Doe (Spouse)"
                  value={formData.emergencyName} onChange={e => setFormData({...formData, emergencyName: e.target.value})}
                  className="w-full px-4 py-2.5 bg-canvas border border-line rounded-md text-ink text-sm placeholder-faint focus:outline-none focus:border-teal-400 transition-all font-light"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-soft mb-1.5">Emergency Phone (SMS Targets)</label>
                <input
                  type="tel" required placeholder="+919876543211"
                  value={formData.emergencyPhone} onChange={e => setFormData({...formData, emergencyPhone: e.target.value})}
                  className="w-full px-4 py-2.5 bg-canvas border border-line rounded-md text-ink text-sm placeholder-faint focus:outline-none focus:border-teal-400 transition-all font-light"
                />
              </div>
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full py-3 px-4 bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-xl shadow-glow hover:shadow-glow-hover transition-all duration-200 text-sm flex items-center justify-center disabled:opacity-50 mt-4 cursor-pointer"
            >
              {loading ? 'Initializing Core...' : 'Generate Profile & Send Verification Email'}
            </button>

            <p className="text-center text-xs text-muted font-light mt-4">
              Already have an account?{' '}
              <button type="button" onClick={() => router.push('/auth/sign-in')} className="text-teal-600 hover:text-teal-500 font-medium transition-colors">
                Sign in
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP} className="space-y-5">
            <div className="p-3.5 rounded-sm bg-status-warning-bg text-status-warning text-xs font-medium border border-status-warning/10 text-center">
              A temporary secure registration code has been dispatched to your email address.
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-soft tracking-wideish uppercase mb-1.5 text-center">
                Enter Email Verification Token
              </label>
              <input
                type="text" required maxLength={6} placeholder="••••••"
                value={verificationCode} onChange={e => setVerificationCode(e.target.value)}
                className="w-full px-4 py-3 bg-canvas border border-line rounded-md text-ink text-center tracking-widest text-xl font-semibold focus:outline-none focus:border-teal-400 transition-all"
              />
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full py-3 px-4 bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-xl shadow-glow hover:shadow-glow-hover transition-all text-sm cursor-pointer"
            >
              {loading ? 'Confirming System Access...' : 'Finalize Activation'}
            </button>

            <button
              type="button"
              onClick={() => setStep('FIELDS')}
              className="w-full text-center text-xs text-muted font-light hover:text-teal-500 transition-colors pt-2"
            >
              ← Edit details or fix email address
            </button>
          </form>
        )}
      </div>
    </div>
  );
}