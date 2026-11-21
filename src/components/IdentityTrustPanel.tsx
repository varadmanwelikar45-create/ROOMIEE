import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Upload,
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

type IdVerificationMethod = 'gov_id_ai_check' | 'workplace_id_ai_check';

export const IdentityTrustPanel: React.FC<IdentityTrustPanelProps> = ({
  identityVerification,
  emergencyContact = '',
  onVerified,
  onSaveEmergencyContact,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<IdVerificationMethod>('gov_id_ai_check');
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

  const handleSelectMethod = (method: IdVerificationMethod) => {
    setSelectedMethod(method);
    setCheckError('');
    setCheckFeedback('');
  };

  const runVerification = useCallback(
    async (file: File, method: IdVerificationMethod) => {
      setCheckError('');
      setCheckFeedback('');
      setIsChecking(true);
      try {
        const result = await verifyIdentityProof(file, method);
        if (!result.verified) {
          setCheckError(
            result.reason || 'Verification did not pass. Please upload a clear photo of your ID.'
          );
          return false;
        }

        const nextInfo: IdentityVerificationInfo = {
          identityVerified: true,
          verificationMethod: method,
          verifiedAt: new Date().toISOString(),
        };
        await onVerified(nextInfo);
        setCheckFeedback(result.reason || 'Identity verified.');
        return true;
      } catch (err) {
        setCheckError(
          err instanceof Error ? err.message : 'Identity verification failed. Please try again.'
        );
        return false;
      } finally {
        setIsChecking(false);
      }
    },
    [onVerified]
  );

  const handleUploadProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || isChecking) return;

    await runVerification(file, selectedMethod);
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

  const methodLabel = (m: VerificationMethod, verified: boolean) => {
    switch (m) {
      case 'gov_id_ai_check':
        return 'Govt ID Verified';
      case 'workplace_id_ai_check':
        return 'Work / College ID Verified';
      default:
        return verified ? 'Identity Verified' : 'Not ID Verified';
    }
  };

  return (
    <div className="bg-[#242424] border border-[#3d3d3d] rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#FFD43B] flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[#FFD43B]" />
          <span>Identity &amp; Safety</span>
        </h3>
        {identityVerification.identityVerified && (
          <span className="text-xs font-semibold text-emerald-300 inline-flex items-center gap-1">
            <BadgeCheck className="w-3.5 h-3.5" />
            <span>Verified</span>
          </span>
        )}
      </div>

      {/* Verification Status */}
      <div className="bg-[#2e2e2e] border border-[#3d3d3d] rounded-xl p-3 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          {identityVerification.identityVerified ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <Lock className="w-4 h-4 text-[#8e8e8e] shrink-0" />
          )}
          <span className="font-semibold text-[#F5F5F5]">
            {methodLabel(
              identityVerification.verificationMethod,
              identityVerification.identityVerified
            )}
          </span>
        </div>
        {identityVerification.verifiedAt && (
          <span className="text-[11px] text-[#8e8e8e]">
            {new Date(identityVerification.verifiedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Verification Controls */}
      <div className="space-y-2.5">
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { id: 'gov_id_ai_check' as const, label: 'Govt ID' },
            { id: 'workplace_id_ai_check' as const, label: 'Work / College ID' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleSelectMethod(opt.id)}
              className={`min-h-[40px] py-2 px-2 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer whitespace-nowrap truncate ${
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
          className={`min-h-[44px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border-2 border-dashed text-xs font-bold transition-colors ${
            isChecking
              ? 'border-[#FFD43B]/60 bg-[#2a2a2a] text-[#FFD43B] cursor-wait'
              : 'border-[#484848] hover:border-[#FFD43B] bg-[#2a2a2a] text-[#F5F5F5] hover:text-[#FFD43B] cursor-pointer'
          }`}
        >
          {isChecking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Verifying...</span>
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 text-[#FFD43B]" />
              <span>
                {identityVerification.identityVerified
                  ? 'Update ID Photo'
                  : 'Upload ID Photo for Verification'}
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

      {/* Emergency Contact */}
      {onSaveEmergencyContact && (
        <form onSubmit={handleContactSubmit} className="pt-3 border-t border-[#383838] space-y-2">
          <label className="text-[11px] font-bold text-[#F5F5F5] flex items-center gap-1.5">
            <PhoneCall className="w-3.5 h-3.5 text-[#FFD43B]" />
            <span>Emergency Contact</span>
          </label>
          <div className="flex gap-2">
            <input
              type="tel"
              value={contactInput}
              onChange={(e) => setContactInput(e.target.value)}
              placeholder="Parent or friend phone (+91 ...)"
              className="flex-1 min-h-[42px] px-3 py-2 bg-[#303030] border border-[#444444] rounded-xl text-xs text-[#F5F5F5] placeholder-[#777777] focus:outline-none focus:border-[#FFD43B]"
            />
            <button
              type="submit"
              disabled={savingContact}
              className="px-4 min-h-[42px] py-2 bg-[#383838] hover:bg-[#444444] text-[#FFD43B] text-xs font-bold rounded-xl border border-[#484848] cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {savingContact ? 'Saving...' : contactSaved ? 'Saved' : 'Save'}
            </button>
          </div>
          {contactError && <p className="text-[11px] text-red-400">{contactError}</p>}
        </form>
      )}
    </div>
  );
};
