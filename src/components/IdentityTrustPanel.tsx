import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Camera,
  BadgeCheck,
  Loader2,
  ShieldAlert,
  PhoneCall,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { IdentityVerificationInfo, VerificationMethod } from '../types';
import { verifyIdentityProof } from '../services/identityVerifier';

interface IdentityTrustPanelProps {
  identityVerification: IdentityVerificationInfo;
  emergencyContact?: string;
  onVerified: (nextVerification: IdentityVerificationInfo) => Promise<void> | void;
  onSaveEmergencyContact?: (contact: string) => Promise<void> | void;
}

export const IdentityTrustPanel: React.FC<IdentityTrustPanelProps> = ({
  identityVerification,
  emergencyContact = '',
  onVerified,
  onSaveEmergencyContact,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<Exclude<VerificationMethod, 'google_only'>>(
    'selfie_liveness'
  );
  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState('');
  const [checkFeedback, setCheckFeedback] = useState('');
  const [contactInput, setContactInput] = useState(emergencyContact);
  const [savingContact, setSavingContact] = useState(false);
  const [contactSaved, setContactSaved] = useState(false);
  const [contactError, setContactError] = useState('');

  useEffect(() => {
    setContactInput(emergencyContact);
  }, [emergencyContact]);

  const handleUploadProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || isChecking) return;

    setCheckError('');
    setCheckFeedback('');
    setIsChecking(true);
    try {
      const result = await verifyIdentityProof(file, selectedMethod);
      if (!result.verified) {
        setCheckError(result.reason || 'Verification did not pass. Please capture a clear live camera photo.');
        return;
      }

      const nextInfo: IdentityVerificationInfo = {
        identityVerified: true,
        verificationMethod: selectedMethod,
        verifiedAt: new Date().toISOString(),
      };
      await onVerified(nextInfo);
      setCheckFeedback(result.reason || 'Strong Identity Verification Completed!');
    } catch (err) {
      setCheckError(err instanceof Error ? err.message : 'Identity verification failed. Try again.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveEmergencyContact || savingContact) return;
    setContactError('');
    setSavingContact(true);
    try {
      await onSaveEmergencyContact(contactInput.trim());
      setContactSaved(true);
      setTimeout(() => setContactSaved(false), 2500);
    } catch {
      setContactError('Could not save safety contact right now. Please try again.');
    } finally {
      setSavingContact(false);
    }
  };

  const methodLabel = (m: VerificationMethod) => {
    switch (m) {
      case 'selfie_liveness':
        return 'AI Selfie Liveness Verified';
      case 'gov_id_ai_check':
        return 'Govt ID + Authenticity Verified';
      case 'workplace_id_ai_check':
        return 'Work / College ID Verified';
      default:
        return 'Google Email Verified Only';
    }
  };

  return (
    <div className="bg-[#242424] border border-[#444444] rounded-2xl p-4 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#FFD43B] flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#FFD43B]" />
            <span>Strong Identity Verification &amp; Safety</span>
          </h3>
          <p className="text-[11px] text-[#B8B8B8] mt-1">
            Boost your match trust score with AI liveness or ID card authenticity check. Raw photos are checked in-memory and never stored publicly.
          </p>
        </div>
        <span
          className={`shrink-0 text-[10px] font-extrabold px-2.5 py-1 rounded-full border inline-flex items-center gap-1 ${
            identityVerification.identityVerified
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
              : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
          }`}
        >
          <BadgeCheck className="w-3.5 h-3.5" />
          <span>{identityVerification.identityVerified ? 'ID Verified' : 'Basic Tier'}</span>
        </span>
      </div>

      {/* Verification Status Pill */}
      <div className="bg-[#2e2e2e] border border-[#3d3d3d] rounded-xl p-3 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          {identityVerification.identityVerified ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <Lock className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <span className="font-semibold text-[#F5F5F5]">
            {methodLabel(identityVerification.verificationMethod)}
          </span>
        </div>
        {identityVerification.verifiedAt && (
          <span className="text-[10px] text-[#8e8e8e]">
            {new Date(identityVerification.verifiedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Upgrade / Re-Verify Controls */}
      <div className="space-y-2.5">
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { id: 'selfie_liveness' as const, label: 'Live Selfie Check' },
            { id: 'gov_id_ai_check' as const, label: 'Govt ID Check' },
            { id: 'workplace_id_ai_check' as const, label: 'Work / College ID' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSelectedMethod(opt.id)}
              className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer ${
                selectedMethod === opt.id
                  ? 'bg-[#FFD43B] text-[#242424] border-[#FFD43B]'
                  : 'bg-[#303030] text-[#B8B8B8] border-[#444444] hover:text-[#F5F5F5]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <label
          className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border-2 border-dashed text-xs font-bold transition-colors ${
            isChecking
              ? 'border-[#FFD43B]/60 bg-[#2a2a2a] text-[#FFD43B] cursor-wait'
              : 'border-[#484848] hover:border-[#FFD43B] bg-[#2a2a2a] text-[#F5F5F5] hover:text-[#FFD43B] cursor-pointer'
          }`}
        >
          {isChecking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Verifying authenticity...</span>
            </>
          ) : (
            <>
              <Camera className="w-4 h-4 text-[#FFD43B]" />
              <span>
                {identityVerification.identityVerified
                  ? 'Re-verify / Upgrade Proof'
                  : 'Upload Live Selfie or Physical ID for Verification'}
              </span>
            </>
          )}
          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            disabled={isChecking}
            onChange={handleUploadProof}
            className="hidden"
          />
        </label>

        {checkFeedback && (
          <div className="text-xs text-emerald-300 bg-emerald-950/40 border border-emerald-700/60 p-2.5 rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{checkFeedback}</span>
          </div>
        )}

        {checkError && (
          <div className="text-xs text-red-300 bg-red-950/45 border border-red-800 p-2.5 rounded-xl flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{checkError}</span>
          </div>
        )}
      </div>

      {/* Private Trusted Emergency Contact */}
      {onSaveEmergencyContact && (
        <form onSubmit={handleContactSubmit} className="pt-3 border-t border-[#383838] space-y-2">
          <label className="text-[11px] font-bold text-[#F5F5F5] flex items-center gap-1.5">
            <PhoneCall className="w-3.5 h-3.5 text-[#FFD43B]" />
            <span>Trusted Safety Contact (Private · Stored Only for You)</span>
          </label>
          <div className="flex gap-2">
            <input
              type="tel"
              value={contactInput}
              onChange={(e) => setContactInput(e.target.value)}
              placeholder="Parent or friend phone (+91 ...)"
              className="flex-1 px-3 py-2 bg-[#303030] border border-[#444444] rounded-xl text-xs text-[#F5F5F5] placeholder-[#777777] focus:outline-none focus:border-[#FFD43B]"
            />
            <button
              type="submit"
              disabled={savingContact}
              className="px-3.5 py-2 bg-[#383838] hover:bg-[#444444] text-[#FFD43B] text-xs font-bold rounded-xl border border-[#484848] cursor-pointer disabled:opacity-50"
            >
              {savingContact ? 'Saving...' : contactSaved ? 'Saved ✓' : 'Save Contact'}
            </button>
          </div>
          {contactError && (
            <p className="text-[11px] text-red-400">{contactError}</p>
          )}
        </form>
      )}
    </div>
  );
};
