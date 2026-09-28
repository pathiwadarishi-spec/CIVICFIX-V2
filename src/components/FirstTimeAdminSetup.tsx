import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { ShieldCheck, Plus, Trash2, AlertCircle, CheckCircle2, Lock, ArrowRight } from 'lucide-react';

export const FirstTimeAdminSetup: React.FC = () => {
  const { user, completeInitialSetup } = useAuth();
  const [emails, setEmails] = useState<string[]>([user?.email || 'pathiwadarishi@gmail.com']);
  const [newEmail, setNewEmail] = useState('');
  const [step, setStep] = useState<'input' | 'confirm'>('input');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleAddEmail = () => {
    setError(null);
    const clean = newEmail.trim().toLowerCase();
    if (!clean) return;
    if (!emailRegex.test(clean)) {
      setError(`"${newEmail}" is not a valid email address.`);
      return;
    }
    if (emails.includes(clean)) {
      setError(`"${clean}" has already been added.`);
      return;
    }
    setEmails([...emails, clean]);
    setNewEmail('');
  };

  const handleRemoveEmail = (index: number) => {
    if (emails.length === 1) {
      setError('At least one administrator email address is required.');
      return;
    }
    setEmails(emails.filter((_, i) => i !== index));
  };

  const handleProceedToConfirm = () => {
    setError(null);
    if (emails.length === 0) {
      setError('Please add at least one administrator email address.');
      return;
    }
    for (const em of emails) {
      if (!emailRegex.test(em)) {
        setError(`Invalid email address: ${em}`);
        return;
      }
    }
    setStep('confirm');
  };

  const handleFinalSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await completeInitialSetup(emails);
      if (!res.success) {
        setError(res.error || 'Failed to save administrator configuration.');
        setStep('input');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
      setStep('input');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wider">
                Initial Security Provisioning
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white mt-1">Set Up CivicFix Administrator</h1>
          </div>
        </div>

        {step === 'input' ? (
          <div>
            <p className="text-slate-300 text-sm mb-6 leading-relaxed">
              To secure the civic infrastructure platform, please designate the authorized administrator email addresses.
              Administrators hold full municipal oversight, including issue verification, crew assignment, and security audit logs.
            </p>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 mb-6">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Which email address(es) should have administrator access to CivicFix?
              </label>

              {/* Email List */}
              <div className="space-y-2 mb-4">
                {emails.map((em, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-lg px-3.5 py-2.5"
                  >
                    <div className="flex items-center gap-2 text-slate-200 text-sm font-medium">
                      <Lock className="w-4 h-4 text-emerald-400" />
                      <span>{em}</span>
                      {idx === 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-semibold">
                          Primary
                        </span>
                      )}
                    </div>
                    {emails.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveEmail(idx)}
                        className="text-slate-500 hover:text-red-400 p-1 transition-colors"
                        title="Remove email"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Input */}
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="admin@municipality.gov"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddEmail();
                    }
                  }}
                  className="flex-1 bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={handleAddEmail}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add</span>
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-6 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-400">
                Setup will lock permanently after confirmation.
              </span>
              <button
                type="button"
                onClick={handleProceedToConfirm}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm rounded-xl flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
              >
                <span>Save Administrator Emails</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm mb-3">
                <AlertCircle className="w-4 h-4" />
                <span>Please Confirm Administrator Assignment</span>
              </div>
              <p className="text-slate-300 text-sm mb-4">
                These email addresses will have administrator access to CivicFix:
              </p>
              <ul className="space-y-2 mb-2">
                {emails.map((em, idx) => (
                  <li
                    key={idx}
                    className="flex items-center gap-2 bg-slate-950/70 border border-slate-800 px-3 py-2 rounded-lg text-emerald-400 text-sm font-mono"
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{em}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-slate-400 mt-4 leading-relaxed">
                Once saved, this initial setup will be closed. Only existing administrators will be able to invite or modify administrative accounts via the secure Admin Settings panel.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-6 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep('input')}
                disabled={submitting}
                className="px-4 py-2 text-slate-400 hover:text-white text-sm font-medium transition-colors"
              >
                Back to Edit
              </button>
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={submitting}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <span>Saving Configuration...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Continue</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
