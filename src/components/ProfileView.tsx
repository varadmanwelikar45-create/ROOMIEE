import React, { useState, useEffect } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  Sparkles, 
  Heart, 
  Moon, 
  Utensils, 
  CheckCircle2, 
  Edit3, 
  Save, 
  Home, 
  Search,
  Camera,
  Upload
} from 'lucide-react';
import { UserProfile, FlatStatus } from '../types';
import { compressImageFile } from '../utils/storage';
import { FlatPhotoUploader } from './FlatPhotoUploader';

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
  const [editedPhotos, setEditedPhotos] = useState<string[]>(currentUser.photos || []);
  const [editedFlatPhotos, setEditedFlatPhotos] = useState<string[]>(currentUser.flatPhotos || []);
  const [photoError, setPhotoError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setEditedBio(currentUser.bio);
    setEditedSleep(currentUser.lifestyle.sleepSchedule);
    setEditedDiet(currentUser.lifestyle.kitchenDiet);
    setEditedWork(currentUser.lifestyle.workRoutine);
    setEditedArea(currentUser.flatLocation.area);
    setEditedCity(currentUser.flatLocation.city);
    setEditedHasFlat(currentUser.hasFlat);
    setEditedPhotos(currentUser.photos || []);
    setEditedFlatPhotos(currentUser.flatPhotos || []);
  }, [currentUser]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoError('Please select a valid image file.');
      return;
    }
    setPhotoError('');
    try {
      const dataUrl = await compressImageFile(file, 520, 0.72);
      setEditedPhotos([dataUrl, ...editedPhotos.slice(1)]);
    } catch {
      setPhotoError('Could not process this image. Please try another PNG or JPG file.');
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
      flatLocation: {
        city: editedCity.trim() || currentUser.flatLocation.city,
        area: editedArea.trim() || currentUser.flatLocation.area,
      },
      photos: editedPhotos.length > 0 ? editedPhotos : currentUser.photos,
      flatPhotos: editedHasFlat === 'has_flat' ? editedFlatPhotos : [],
      lifestyle: {
        ...currentUser.lifestyle,
        sleepSchedule: editedSleep,
        kitchenDiet: editedDiet,
        workRoutine: editedWork,
      },
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
        <div className="p-6 sm:p-8 border-b border-[#3d3d3d] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-[#282828] to-[#343434]">
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-[#FFD43B] shrink-0 bg-[#242424] shadow-md flex items-center justify-center">
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
                <h2 className="text-2xl font-bold text-[#F5F5F5]">{currentUser.name}</h2>
                <span className="text-xs bg-[#FFD43B] text-[#242424] font-extrabold px-2 py-0.5 rounded-full">
                  {currentUser.gender === 'male' ? '👦 Boy' : '👧 Girl'}
                </span>
              </div>

              {/* Has Flat Yes/No Tag */}
              <div className="flex items-center gap-2 flex-wrap">
                {currentUser.hasFlat === 'has_flat' ? (
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-800 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                    <Home className="w-3.5 h-3.5" />
                    <span>Has Flat in {currentUser.flatLocation.area}</span>
                  </span>
                ) : (
                  <span className="text-xs font-bold text-amber-400 bg-amber-950/40 border border-amber-800 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                    <Search className="w-3.5 h-3.5" />
                    <span>Looking for Flat in {currentUser.flatLocation.area}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsEditing(!isEditing)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#383838] hover:bg-[#444444] text-[#F5F5F5] border border-[#484848] transition-colors cursor-pointer"
          >
            {isEditing ? <Save className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5 text-[#FFD43B]" />}
            <span>{isEditing ? 'Cancel' : 'Edit Flat & Habits'}</span>
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
                        <Camera className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#F5F5F5]">Update Profile Photo</p>
                    <p className="text-[11px] text-[#B8B8B8]">Upload a new real picture from your device</p>
                  </div>
                </div>

                <label className="py-1.5 px-3 bg-[#383838] hover:bg-[#444444] text-[#FFD43B] font-semibold text-xs rounded-xl border border-[#484848] transition-colors cursor-pointer flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Choose Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
              </div>
              {photoError && (
                <p className="text-xs text-red-400 bg-red-950/40 p-2 rounded-lg border border-red-800">
                  {photoError}
                </p>
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

              {saveError && (
                <p className="text-xs text-red-400 bg-red-950/40 p-2.5 rounded-lg border border-red-800">
                  {saveError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setIsEditing(false)}
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
              {/* Account Credentials */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-[#242424] p-3 rounded-xl border border-[#3d3d3d] flex items-center gap-2.5">
                  <User className="w-4 h-4 text-[#8e8e8e] shrink-0" />
                  <div className="truncate">
                    <span className="text-[10px] text-[#8e8e8e] block">Full Name</span>
                    <span className="text-[#F5F5F5] font-semibold truncate block">{currentUser.name}</span>
                  </div>
                </div>

                <div className="bg-[#242424] p-3 rounded-xl border border-[#3d3d3d] flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-[#8e8e8e] shrink-0" />
                  <div className="truncate">
                    <span className="text-[10px] text-[#8e8e8e] block">Email</span>
                    <span className="text-[#F5F5F5] font-semibold truncate block">{currentUser.email}</span>
                  </div>
                </div>

                <div className="bg-[#242424] p-3 rounded-xl border border-[#3d3d3d] flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-[#8e8e8e] shrink-0" />
                  <div className="truncate">
                    <span className="text-[10px] text-[#8e8e8e] block">Phone</span>
                    <span className="text-[#F5F5F5] font-semibold truncate block">{currentUser.phone}</span>
                  </div>
                </div>
              </div>

              {/* SHARE REAL FLAT PHOTOS SECTION (for users who have a flat) */}
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

              {/* SKILLS */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#FFD43B] mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Your Skills (Showcased on Card)</span>
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {currentUser.skills.map((skill) => (
                    <span
                      key={skill}
                      className="text-xs font-medium px-2.5 py-1 rounded-lg bg-[#383838] border border-[#484848] text-[#F5F5F5]"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* HOBBIES & INTERESTS */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#B8B8B8] mb-2 flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-[#FFD43B]" />
                  <span>Hobbies &amp; Interests</span>
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {currentUser.hobbies.map((h) => (
                    <span key={h} className="text-xs px-2.5 py-0.5 rounded-lg bg-[#242424] text-[#B8B8B8] border border-[#3d3d3d]">
                      {h}
                    </span>
                  ))}
                  {currentUser.interests.map((i) => (
                    <span key={i} className="text-xs px-2.5 py-0.5 rounded-lg bg-[#242424] text-[#B8B8B8] border border-[#3d3d3d]">
                      {i}
                    </span>
                  ))}
                </div>
              </div>

              {/* LIFESTYLE */}
              <div className="pt-2 border-t border-[#383838]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#FFD43B] mb-3">
                  Everyday Living Habits
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                  <div className="bg-[#242424] p-3 rounded-xl border border-[#3d3d3d] flex items-center gap-2">
                    <Moon className="w-4 h-4 text-[#FFD43B] shrink-0" />
                    <div>
                      <span className="text-[10px] text-[#8e8e8e] block">Sleep Clock</span>
                      <span className="text-[#F5F5F5] font-semibold">{currentUser.lifestyle.sleepSchedule}</span>
                    </div>
                  </div>

                  <div className="bg-[#242424] p-3 rounded-xl border border-[#3d3d3d] flex items-center gap-2">
                    <Utensils className="w-4 h-4 text-[#FFD43B] shrink-0" />
                    <div>
                      <span className="text-[10px] text-[#8e8e8e] block">Food &amp; Kitchen</span>
                      <span className="text-[#F5F5F5] font-semibold">{currentUser.lifestyle.kitchenDiet}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#242424] p-3.5 rounded-xl border border-[#3d3d3d]">
                  <span className="text-[10px] uppercase font-bold text-[#FFD43B] block mb-1">
                    Your Living Bio
                  </span>
                  <p className="text-xs text-[#B8B8B8] italic leading-relaxed">
                    &ldquo;{currentUser.bio}&rdquo;
                  </p>
                </div>
              </div>
            </>
          )}

        </div>

      </div>

    </div>
  );
};
