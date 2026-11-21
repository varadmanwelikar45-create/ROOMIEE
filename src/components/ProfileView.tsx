import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Phone, 
  Moon, 
  Utensils, 
  CheckCircle2, 
  Edit3, 
  Save, 
  Home, 
  Search,
  Upload,
  Clock,
  RefreshCw,
  BrainCircuit,
  ShieldCheck,
  IndianRupee,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import {
  UserProfile,
  FlatStatus,
  LivingCircleId,
  PersonalityProfile,
  CostBreakdown,
  IdentityVerificationInfo,
} from '../types';
import { verifyAndCompressProfilePhoto } from '../services/profilePhotoVerifier';
import { FlatPhotoUploader } from './FlatPhotoUploader';
import { CostBreakdownCard } from './CostBreakdownCard';
import { IdentityTrustPanel } from './IdentityTrustPanel';
import {
  DEFAULT_COST_BREAKDOWN,
  DEFAULT_PERSONALITY,
  formatINR,
  getListingExpiryStatus,
} from '../utils/compatibility';
import { computeExpiryIso } from '../services/roomieDb';
import {
  LIVING_CIRCLES,
  getEffectiveLivingCircles,
  getLivingCircleMeta,
} from '../utils/livingCircles';

interface ProfileViewProps {
  currentUser: UserProfile;
  onUpdateProfile: (updated: UserProfile) => Promise<void> | void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ currentUser, onUpdateProfile }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedBio, setEditedBio] = useState(currentUser.bio);
  const [editedSleep, setEditedSleep] = useState(currentUser.lifestyle.sleepSchedule);
  const [editedDiet, setEditedDiet] = useState(currentUser.lifestyle.kitchenDiet);
  const [editedWork, setEditedWork] = useState(currentUser.lifestyle.workRoutine);
  const [editedArea, setEditedArea] = useState(currentUser.flatLocation.area);
  const [editedCity, setEditedCity] = useState(currentUser.flatLocation.city);
  const [editedHasFlat, setEditedHasFlat] = useState<FlatStatus>(currentUser.hasFlat);
  const [editedCircles, setEditedCircles] = useState<LivingCircleId[]>(
    getEffectiveLivingCircles(currentUser)
  );
  const [editedPhotos, setEditedPhotos] = useState<string[]>(currentUser.photos || []);
  const [editedFlatPhotos, setEditedFlatPhotos] = useState<string[]>(currentUser.flatPhotos || []);
  const [editedPersonality, setEditedPersonality] = useState<PersonalityProfile>(
    currentUser.personality || { ...DEFAULT_PERSONALITY }
  );
  const [editedCost, setEditedCost] = useState<CostBreakdown>(
    currentUser.costBreakdown || { ...DEFAULT_COST_BREAKDOWN }
  );
  const [editedDuration, setEditedDuration] = useState<7 | 14 | 30>(
    currentUser.listingDurationDays || 14
  );
  const [photoError, setPhotoError] = useState('');
  const [isCheckingPhoto, setIsCheckingPhoto] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const resetDraftFromUser = (u: UserProfile) => {
    setEditedBio(u.bio);
    setEditedSleep(u.lifestyle.sleepSchedule);
    setEditedDiet(u.lifestyle.kitchenDiet);
    setEditedWork(u.lifestyle.workRoutine);
    setEditedArea(u.flatLocation.area);
    setEditedCity(u.flatLocation.city);
    setEditedHasFlat(u.hasFlat);
    setEditedCircles(getEffectiveLivingCircles(u));
    setEditedPhotos(u.photos || []);
    setEditedFlatPhotos(u.flatPhotos || []);
    setEditedPersonality(u.personality || { ...DEFAULT_PERSONALITY });
    setEditedCost(u.costBreakdown || { ...DEFAULT_COST_BREAKDOWN });
    setEditedDuration(u.listingDurationDays || 14);
    setPhotoError('');
    setSaveError('');
  };

  useEffect(() => {
    resetDraftFromUser(currentUser);
  }, [currentUser]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || isCheckingPhoto) return;

    setPhotoError('');
    setIsCheckingPhoto(true);
    try {
      const result = await verifyAndCompressProfilePhoto(file);
      if (!result.accepted || !result.compressedDataUrl) {
        setPhotoError(
          result.reason ||
            'AI or stock photo rejected. Please upload a real camera photograph of yourself.'
        );
        return;
      }
      setEditedPhotos([result.compressedDataUrl, ...editedPhotos.slice(1)]);
    } catch (err) {
      setPhotoError(
        err instanceof Error
          ? err.message
          : 'Could not verify this image right now. Please try again.'
      );
    } finally {
      setIsCheckingPhoto(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError('');
    setIsSaving(true);
    const updated: UserProfile = {
      ...currentUser,
      bio: editedBio.trim() || currentUser.bio,
      hasFlat: editedHasFlat,
      livingCircles: editedCircles.length > 0 ? editedCircles : getEffectiveLivingCircles(currentUser),
      flatLocation: {
        city: editedCity.trim() || currentUser.flatLocation.city,
        area: editedArea.trim() || currentUser.flatLocation.area,
      },
      budget: `${formatINR(editedCost.monthlyRent)} / mo`,
      photos: editedPhotos.length > 0 ? editedPhotos : currentUser.photos,
      flatPhotos: editedHasFlat === 'has_flat' ? editedFlatPhotos : [],
      lifestyle: {
        ...currentUser.lifestyle,
        sleepSchedule: editedSleep,
        kitchenDiet: editedDiet,
        workRoutine: editedWork,
      },
      personality: editedPersonality,
      costBreakdown: editedCost,
      listingDurationDays: editedDuration,
      expiresAt:
        editedDuration !== currentUser.listingDurationDays
          ? computeExpiryIso(editedDuration)
          : currentUser.expiresAt,
    };
    try {
      await onUpdateProfile(updated);
      setIsEditing(false);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch {
      setSaveError('Could not save profile updates. Please verify your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRenewListing = async (days: 7 | 14 | 30 = currentUser.listingDurationDays || 14) => {
    setSaveError('');
    setIsSaving(true);
    try {
      await onUpdateProfile({
        ...currentUser,
        listingDurationDays: days,
        expiresAt: computeExpiryIso(days),
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch {
      setSaveError('Could not renew listing expiry. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleIdentityVerified = async (nextInfo: IdentityVerificationInfo) => {
    await onUpdateProfile({
      ...currentUser,
      identityVerification: nextInfo,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleSaveEmergencyContact = async (contact: string) => {
    await onUpdateProfile({
      ...currentUser,
      emergencyContact: contact,
    });
  };

  const handleInstantFlatPhotosChange = async (nextFlatPhotos: string[]) => {
    setEditedFlatPhotos(nextFlatPhotos);
    setSaveError('');
    setIsSaving(true);
    try {
      await onUpdateProfile({
        ...currentUser,
        flatPhotos: nextFlatPhotos,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch {
      setSaveError('Could not update shared flat photos. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const expiryStatus = getListingExpiryStatus(currentUser.expiresAt);

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6">
      
      {savedSuccess && (
        <div className="mb-4 bg-[#303030] border border-[#FFD43B] text-[#F5F5F5] px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-[#FFD43B]" />
          <span>Flatmate profile &amp; flat location updated!</span>
        </div>
      )}

      {/* Main Profile Card */}
      <div className="bg-[#303030] border border-[#444444] rounded-3xl shadow-xl overflow-hidden">
        
        {/* Banner with Profile Photo & Flat Status */}
        <div className="p-6 border-b border-[#3d3d3d] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#2c2c2c]">
          <div className="flex items-center gap-4">
            <div className="relative w-18 h-18 rounded-2xl overflow-hidden border-2 border-[#FFD43B] shrink-0 bg-[#242424] flex items-center justify-center">
              {currentUser.photos && currentUser.photos[0] ? (
                <img
                  src={currentUser.photos[0]}
                  alt={currentUser.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-[#383838] flex items-center justify-center text-[#FFD43B] font-extrabold text-2xl">
                  {currentUser.name.charAt(0)}
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl sm:text-2xl font-bold text-[#F5F5F5]">{currentUser.name}</h2>
                {currentUser.identityVerification?.identityVerified && (
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
              </div>

              <div className="flex items-center gap-1.5 text-xs text-[#B8B8B8]">
                {currentUser.hasFlat === 'has_flat' ? (
                  <Home className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <Search className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                )}
                <span>
                  {currentUser.hasFlat === 'has_flat' ? 'Has Flat' : 'Needs Flat'} · {currentUser.flatLocation.area}, {currentUser.flatLocation.city}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              if (isEditing) {
                resetDraftFromUser(currentUser);
                setIsEditing(false);
              } else {
                setIsEditing(true);
              }
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#383838] hover:bg-[#444444] text-[#F5F5F5] border border-[#484848] transition-colors cursor-pointer"
          >
            {isEditing ? <Save className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5 text-[#FFD43B]" />}
            <span>{isEditing ? 'Cancel' : 'Edit Profile'}</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-6">
          
          {isEditing ? (
            <form onSubmit={handleSave} className="space-y-4">
              
              {/* Change Profile Photo */}
              <div className="bg-[#242424] p-3.5 rounded-2xl border border-[#444444] flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl overflow-hidden border border-[#FFD43B] bg-[#1e1e1e] shrink-0">
                    {editedPhotos[0] ? (
                      <img src={editedPhotos[0]} alt="Profile preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#FFD43B] font-bold">
                        <Upload className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#F5F5F5]">Update Profile Photo</p>
                    <p className="text-[11px] text-[#B8B8B8]">Upload a new real picture from your device</p>
                  </div>
                </div>

                <label
                  className={`py-1.5 px-3 bg-[#383838] hover:bg-[#444444] text-[#FFD43B] font-semibold text-xs rounded-xl border border-[#484848] transition-colors flex items-center gap-1.5 ${
                    isCheckingPhoto ? 'opacity-70 cursor-wait' : 'cursor-pointer'
                  }`}
                >
                  {isCheckingPhoto ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  <span>{isCheckingPhoto ? 'Scanning...' : 'Choose Photo'}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={isCheckingPhoto}
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
              </div>
              {photoError && (
                <div className="text-xs text-red-300 bg-red-950/45 p-2.5 rounded-lg border border-red-800 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{photoError}</span>
                </div>
              )}

              {/* Flat Status Yes / No */}
              <div className="bg-[#242424] p-3.5 rounded-2xl border border-[#444444]">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#FFD43B] mb-2">
                  Do you have a flat already?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditedHasFlat('has_flat')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      editedHasFlat === 'has_flat'
                        ? 'bg-[#FFD43B] text-[#242424] border-[#FFD43B]'
                        : 'bg-[#303030] text-[#B8B8B8] border-[#444444]'
                    }`}
                  >
                    🏠 Yes, I have a flat
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditedHasFlat('needs_flat')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      editedHasFlat === 'needs_flat'
                        ? 'bg-[#FFD43B] text-[#242424] border-[#FFD43B]'
                        : 'bg-[#303030] text-[#B8B8B8] border-[#444444]'
                    }`}
                  >
                    🔍 No, looking for flat
                  </button>
                </div>
              </div>

              {editedHasFlat === 'has_flat' && (
                <FlatPhotoUploader
                  flatPhotos={editedFlatPhotos}
                  onChange={(next) => setEditedFlatPhotos(next)}
                  disabled={isSaving}
                />
              )}

              {/* Living Circles Membership Editor */}
              <div className="bg-[#242424] p-3.5 rounded-2xl border border-[#444444]">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#FFD43B] mb-2">
                  Your Living Circles
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {LIVING_CIRCLES.map((circle) => {
                    const active = editedCircles.includes(circle.id);
                    return (
                      <button
                        key={circle.id}
                        type="button"
                        onClick={() => {
                          setEditedCircles((prev) => {
                            if (active && prev.length <= 1) return prev;
                            return active
                              ? prev.filter((id) => id !== circle.id)
                              : [...prev, circle.id];
                          });
                        }}
                        className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                          active
                            ? 'bg-[#353535] border-[#FFD43B] text-[#F5F5F5]'
                            : 'bg-[#1f1f1f] border-[#3a3a3a] text-[#B8B8B8]'
                        }`}
                      >
                        <span className="text-xs font-bold flex items-center gap-2">
                          <span>{circle.emoji}</span>
                          <span>{circle.name}</span>
                        </span>
                        <span className="text-[10px] font-bold text-[#FFD43B]">
                          {active ? 'Joined ✓' : 'Join'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Location of Flat */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[#B8B8B8] mb-1">City</label>
                  <input
                    type="text"
                    value={editedCity}
                    onChange={(e) => setEditedCity(e.target.value)}
                    className="w-full px-3 py-2 bg-[#242424] border border-[#444444] rounded-lg text-xs text-[#F5F5F5]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#B8B8B8] mb-1">Location / Area of Flat</label>
                  <input
                    type="text"
                    value={editedArea}
                    onChange={(e) => setEditedArea(e.target.value)}
                    className="w-full px-3 py-2 bg-[#242424] border border-[#444444] rounded-lg text-xs text-[#F5F5F5]"
                  />
                </div>
              </div>

              {/* Habits */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-[#B8B8B8] mb-1">Sleep Clock</label>
                  <input
                    type="text"
                    value={editedSleep}
                    onChange={(e) => setEditedSleep(e.target.value)}
                    className="w-full px-3 py-2 bg-[#242424] border border-[#444444] rounded-lg text-xs text-[#F5F5F5]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#B8B8B8] mb-1">Kitchen / Diet</label>
                  <input
                    type="text"
                    value={editedDiet}
                    onChange={(e) => setEditedDiet(e.target.value)}
                    className="w-full px-3 py-2 bg-[#242424] border border-[#444444] rounded-lg text-xs text-[#F5F5F5]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#B8B8B8] mb-1">Work Routine</label>
                  <input
                    type="text"
                    value={editedWork}
                    onChange={(e) => setEditedWork(e.target.value)}
                    className="w-full px-3 py-2 bg-[#242424] border border-[#444444] rounded-lg text-xs text-[#F5F5F5]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-[#B8B8B8] mb-1">Bio / Living Expectations</label>
                <textarea
                  rows={3}
                  value={editedBio}
                  onChange={(e) => setEditedBio(e.target.value)}
                  className="w-full px-3 py-2 bg-[#242424] border border-[#444444] rounded-lg text-xs text-[#F5F5F5]"
                />
              </div>

              {/* Personality Preferences Editor */}
              <div className="bg-[#242424] p-3.5 rounded-2xl border border-[#444444] space-y-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-[#FFD43B] flex items-center gap-1.5">
                  <BrainCircuit className="w-4 h-4" />
                  <span>Personality Matching Preferences</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div>
                    <label className="block text-[10px] text-[#8e8e8e] mb-1">Social Vibe</label>
                    <select
                      value={editedPersonality.vibe}
                      onChange={(e) => setEditedPersonality((p) => ({ ...p, vibe: e.target.value }))}
                      className="w-full px-2.5 py-1.5 bg-[#303030] border border-[#444444] rounded-lg text-xs text-[#F5F5F5]"
                    >
                      <option value="Introvert · Calm & Private">Introvert · Calm &amp; Private</option>
                      <option value="Ambivert · Balanced Social">Ambivert · Balanced Social</option>
                      <option value="Extrovert · Lively & Friendly">Extrovert · Lively &amp; Friendly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#8e8e8e] mb-1">Guest Policy</label>
                    <select
                      value={editedPersonality.guestPolicy}
                      onChange={(e) => setEditedPersonality((p) => ({ ...p, guestPolicy: e.target.value }))}
                      className="w-full px-2.5 py-1.5 bg-[#303030] border border-[#444444] rounded-lg text-xs text-[#F5F5F5]"
                    >
                      <option value="Rare Overnight Guests">Rare Overnight Guests</option>
                      <option value="Occasional Guests (Inform First)">Occasional Guests (Inform First)</option>
                      <option value="Friends Welcome Anytime">Friends Welcome Anytime</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#8e8e8e] mb-1">Noise Preference</label>
                    <select
                      value={editedPersonality.noiseTolerance}
                      onChange={(e) => setEditedPersonality((p) => ({ ...p, noiseTolerance: e.target.value }))}
                      className="w-full px-2.5 py-1.5 bg-[#303030] border border-[#444444] rounded-lg text-xs text-[#F5F5F5]"
                    >
                      <option value="Quiet Study / WFH Sanctuary">Quiet Study / WFH Sanctuary</option>
                      <option value="Moderate Ambient">Moderate Ambient</option>
                      <option value="Lively Music / Hangouts">Lively Music / Hangouts</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#8e8e8e] mb-1">Chore Style</label>
                    <select
                      value={editedPersonality.choreStyle}
                      onChange={(e) => setEditedPersonality((p) => ({ ...p, choreStyle: e.target.value }))}
                      className="w-full px-2.5 py-1.5 bg-[#303030] border border-[#444444] rounded-lg text-xs text-[#F5F5F5]"
                    >
                      <option value="Shared Maid + Weekend Tidy">Shared Maid + Weekend Tidy</option>
                      <option value="Clean-as-you-go Strictly">Clean-as-you-go Strictly</option>
                      <option value="Weekly Cleaning Schedule">Weekly Cleaning Schedule</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Cost Breakdown & Auto-Expiry Editor */}
              <div className="bg-[#242424] p-3.5 rounded-2xl border border-[#444444] space-y-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-[#FFD43B] flex items-center gap-1.5">
                  <IndianRupee className="w-4 h-4" />
                  <span>Complete Cost Breakdown &amp; Expiry</span>
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] text-[#8e8e8e] mb-0.5">Monthly Rent (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={editedCost.monthlyRent}
                      onChange={(e) => setEditedCost((c) => ({ ...c, monthlyRent: Number(e.target.value) || 0 }))}
                      className="w-full px-2.5 py-1.5 bg-[#303030] border border-[#444444] rounded-lg text-xs text-[#F5F5F5]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#8e8e8e] mb-0.5">Security Deposit (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={editedCost.securityDeposit}
                      onChange={(e) => setEditedCost((c) => ({ ...c, securityDeposit: Number(e.target.value) || 0 }))}
                      className="w-full px-2.5 py-1.5 bg-[#303030] border border-[#444444] rounded-lg text-xs text-[#F5F5F5]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#8e8e8e] mb-0.5">Maintenance / mo (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={editedCost.maintenanceFee}
                      onChange={(e) => setEditedCost((c) => ({ ...c, maintenanceFee: Number(e.target.value) || 0 }))}
                      className="w-full px-2.5 py-1.5 bg-[#303030] border border-[#444444] rounded-lg text-xs text-[#F5F5F5]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#8e8e8e] mb-0.5">Utilities Est. (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={editedCost.utilitiesEstimate}
                      onChange={(e) => setEditedCost((c) => ({ ...c, utilitiesEstimate: Number(e.target.value) || 0 }))}
                      className="w-full px-2.5 py-1.5 bg-[#303030] border border-[#444444] rounded-lg text-xs text-[#F5F5F5]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#8e8e8e] mb-0.5">Brokerage (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={editedCost.brokerageFee}
                      onChange={(e) => setEditedCost((c) => ({ ...c, brokerageFee: Number(e.target.value) || 0 }))}
                      className="w-full px-2.5 py-1.5 bg-[#303030] border border-[#444444] rounded-lg text-xs text-[#F5F5F5]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#8e8e8e] mb-0.5">Auto-Expiry Window</label>
                    <select
                      value={editedDuration}
                      onChange={(e) => setEditedDuration(Number(e.target.value) as 7 | 14 | 30)}
                      className="w-full px-2.5 py-1.5 bg-[#303030] border border-[#444444] rounded-lg text-xs text-[#F5F5F5]"
                    >
                      <option value={7}>7 Days</option>
                      <option value={14}>14 Days</option>
                      <option value={30}>30 Days</option>
                    </select>
                  </div>
                </div>
              </div>

              {saveError && (
                <p className="text-xs text-red-400 bg-red-950/40 p-2.5 rounded-lg border border-red-800">
                  {saveError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    resetDraftFromUser(currentUser);
                    setIsEditing(false);
                  }}
                  className="px-4 py-2 text-xs bg-[#383838] hover:bg-[#444444] text-[#F5F5F5] rounded-lg disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 text-xs font-bold text-[#242424] bg-[#FFD43B] hover:bg-[#ffe066] rounded-lg shadow disabled:opacity-60 cursor-pointer"
                >
                  {isSaving ? 'Saving to Cloud...' : 'Save Changes'}
                </button>
              </div>

            </form>
          ) : (
            <>
              {/* Contact */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-[#242424] p-3 rounded-xl border border-[#3d3d3d] flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-[#8e8e8e] shrink-0" />
                  <span className="text-[#F5F5F5] font-medium truncate">{currentUser.email}</span>
                </div>

                <div className="bg-[#242424] p-3 rounded-xl border border-[#3d3d3d] flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-[#8e8e8e] shrink-0" />
                  <span className="text-[#F5F5F5] font-medium truncate">{currentUser.phone}</span>
                </div>
              </div>

              {currentUser.hasFlat === 'has_flat' && (
                <div className="space-y-2">
                  <FlatPhotoUploader
                    flatPhotos={currentUser.flatPhotos || []}
                    onChange={handleInstantFlatPhotosChange}
                    disabled={isSaving}
                  />
                  {saveError && (
                    <p className="text-xs text-red-400 bg-red-950/40 p-2.5 rounded-lg border border-red-800">
                      {saveError}
                    </p>
                  )}
                </div>
              )}

              {/* Living Circles */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#FFD43B] mb-2">
                  Living Circles
                </h3>
                <div className="flex flex-wrap gap-2">
                  {getEffectiveLivingCircles(currentUser).map((cid) => {
                    const meta = getLivingCircleMeta(cid);
                    return (
                      <span
                        key={cid}
                        className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-[#242424] border border-[#3d3d3d] text-[#F5F5F5] inline-flex items-center gap-1.5"
                      >
                        <span>{meta.emoji}</span>
                        <span>{meta.name}</span>
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* About & Habits */}
              <div className="pt-2 border-t border-[#383838] space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#FFD43B]">
                  About &amp; Habits
                </h3>
                <p className="text-xs text-[#D0D0D0] leading-relaxed">
                  {currentUser.bio}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-[#242424] p-3 rounded-xl border border-[#3d3d3d] flex items-center gap-2">
                    <Moon className="w-4 h-4 text-[#FFD43B] shrink-0" />
                    <div>
                      <span className="text-[10px] text-[#8e8e8e] block">Sleep</span>
                      <span className="text-[#F5F5F5] font-semibold">{currentUser.lifestyle.sleepSchedule}</span>
                    </div>
                  </div>

                  <div className="bg-[#242424] p-3 rounded-xl border border-[#3d3d3d] flex items-center gap-2">
                    <Utensils className="w-4 h-4 text-[#FFD43B] shrink-0" />
                    <div>
                      <span className="text-[10px] text-[#8e8e8e] block">Diet</span>
                      <span className="text-[#F5F5F5] font-semibold">{currentUser.lifestyle.kitchenDiet}</span>
                    </div>
                  </div>
                </div>

                {currentUser.skills.length > 0 && (
                  <p className="text-xs text-[#B8B8B8]">
                    <span className="text-[#8e8e8e]">Profession / Skills: </span>
                    <span className="text-[#F5F5F5]">{currentUser.skills.join(' · ')}</span>
                  </p>
                )}
              </div>

              {/* Preferences */}
              <div className="pt-2 border-t border-[#383838]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#FFD43B] mb-2.5 flex items-center gap-1.5">
                  <BrainCircuit className="w-4 h-4" />
                  <span>Living Preferences</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="bg-[#242424] p-2.5 rounded-xl border border-[#3d3d3d]">
                    <span className="text-[10px] text-[#8e8e8e] block">Social Vibe</span>
                    <span className="text-[#F5F5F5] font-semibold">
                      {(currentUser.personality || DEFAULT_PERSONALITY).vibe}
                    </span>
                  </div>
                  <div className="bg-[#242424] p-2.5 rounded-xl border border-[#3d3d3d]">
                    <span className="text-[10px] text-[#8e8e8e] block">Guest Policy</span>
                    <span className="text-[#F5F5F5] font-semibold">
                      {(currentUser.personality || DEFAULT_PERSONALITY).guestPolicy}
                    </span>
                  </div>
                  <div className="bg-[#242424] p-2.5 rounded-xl border border-[#3d3d3d]">
                    <span className="text-[10px] text-[#8e8e8e] block">Noise</span>
                    <span className="text-[#F5F5F5] font-semibold">
                      {(currentUser.personality || DEFAULT_PERSONALITY).noiseTolerance}
                    </span>
                  </div>
                  <div className="bg-[#242424] p-2.5 rounded-xl border border-[#3d3d3d]">
                    <span className="text-[10px] text-[#8e8e8e] block">Chores</span>
                    <span className="text-[#F5F5F5] font-semibold">
                      {(currentUser.personality || DEFAULT_PERSONALITY).choreStyle}
                    </span>
                  </div>
                </div>
              </div>

              <CostBreakdownCard
                costBreakdown={currentUser.costBreakdown}
                fallbackBudget={currentUser.budget}
                hasFlat={currentUser.hasFlat}
              />

              {/* Listing Status */}
              <div
                className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                  expiryStatus.expired
                    ? 'bg-red-950/30 border-red-700'
                    : expiryStatus.expiringSoon
                    ? 'bg-amber-950/30 border-amber-700'
                    : 'bg-[#242424] border-[#3d3d3d]'
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-[#F5F5F5]">
                  <Clock className={`w-4 h-4 ${expiryStatus.expired ? 'text-red-400' : 'text-[#FFD43B]'}`} />
                  <span>Listing · {expiryStatus.label}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleRenewListing(14)}
                    className="px-3 py-1.5 rounded-xl bg-[#FFD43B] hover:bg-[#ffe066] text-[#242424] font-bold text-xs inline-flex items-center gap-1 cursor-pointer disabled:opacity-60"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Renew +14d</span>
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleRenewListing(30)}
                    className="px-2.5 py-1.5 rounded-xl bg-[#383838] hover:bg-[#444444] text-[#F5F5F5] font-semibold text-xs border border-[#484848] cursor-pointer disabled:opacity-60"
                  >
                    +30d
                  </button>
                </div>
              </div>

              {/* STRONG IDENTITY VERIFICATION & SAFETY CONTACTS */}
              <IdentityTrustPanel
                identityVerification={
                  currentUser.identityVerification || {
                    identityVerified: false,
                    verificationMethod: 'google_only',
                    verifiedAt: '',
                  }
                }
                emergencyContact={currentUser.emergencyContact}
                onVerified={handleIdentityVerified}
                onSaveEmergencyContact={handleSaveEmergencyContact}
              />
            </>
          )}

        </div>

      </div>

    </div>
  );
};
