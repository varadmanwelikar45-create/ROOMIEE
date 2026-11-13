import React, { useState, useEffect } from 'react';
import { User as FirebaseUser, signInWithPopup } from 'firebase/auth';
import {
  Users2,
  ArrowRight,
  Home,
  Search,
  MapPin,
  Mail,
  Phone,
  User,
  ShieldCheck,
  CheckCircle2,
  Upload,
  Camera,
  Loader2,
  LogOut,
  ExternalLink,
} from 'lucide-react';
import { UserProfile, Gender, FlatStatus } from '../types';
import { compressImageFile } from '../utils/storage';
import { auth, googleProvider } from '../firebase';
import { loadUserProfileFromDb, saveUserProfileToDb } from '../services/roomieDb';

interface AuthScreenProps {
  firebaseUser: FirebaseUser | null;
  onLoginSuccess: (user: UserProfile) => void;
  onSignOutAuth: () => Promise<void>;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  firebaseUser,
  onLoginSuccess,
  onSignOutAuth,
}) => {
  const [registerStep, setRegisterStep] = useState<1 | 2>(1);

  // Common Flat Status & Location (required at login/register)
  const [hasFlat, setHasFlat] = useState<FlatStatus>('has_flat');
  const [city, setCity] = useState('Bengaluru');
  const [area, setArea] = useState('Koramangala 4th Block');
  const [gender, setGender] = useState<Gender>('male');
  const [preferredFlatmateGender, setPreferredFlatmateGender] = useState<'male' | 'female' | 'any'>('male');

  // Auth loading & error state
  const [authLoading, setAuthLoading] = useState(false);
  const [signinError, setSigninError] = useState('');
  const [showNewTabHint, setShowNewTabHint] = useState(false);

  // Register fields (populated once Google Auth succeeds for a new user)
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [budget, setBudget] = useState('₹18,000 / mo');
  const [step1Error, setStep1Error] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Skills, Hobbies, Interests
  const [selectedSkills, setSelectedSkills] = useState<string[]>(['Frontend Engineer', 'UI/UX Designer']);
  const [customSkill, setCustomSkill] = useState('');
  const defaultHobbies = ['Weekend Treks', 'Specialty Coffee', 'Gym'];
  const defaultInterests = ['Tech Startups', 'Board Games'];
  const [sleepSchedule, setSleepSchedule] = useState('11:00 PM – 7:00 AM (Early Riser)');
  const [kitchenDiet, setKitchenDiet] = useState('Vegetarian Friendly');
  const [workRoutine, setWorkRoutine] = useState('Hybrid (WFH 2 days/week)');
  const defaultCleanliness = 'Daily kitchen cleanup & shared maid';
  const [bio, setBio] = useState('');

  // Photo upload states (Required for registration)
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [uploadedFlatPhoto, setUploadedFlatPhoto] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState('');

  // Prefill name and email when Google user is authenticated and completing registration
  useEffect(() => {
    if (firebaseUser) {
      setName((prev) => prev || firebaseUser.displayName || '');
      setEmail(firebaseUser.email || '');
    } else {
      setRegisterStep(1);
    }
  }, [firebaseUser]);

  // Handle local image file upload & compress to fit Firestore document & security rule limits
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, isFlatPhoto = false) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPhotoError('Please select a valid image file (PNG, JPG, JPEG, WEBP).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setPhotoError('Image size should be under 10MB.');
      return;
    }

    setPhotoError('');
    try {
      const compressedDataUrl = await compressImageFile(file, 520, 0.72);
      if (isFlatPhoto) {
        setUploadedFlatPhoto(compressedDataUrl);
      } else {
        setUploadedPhoto(compressedDataUrl);
      }
    } catch (err) {
      setPhotoError(
        err instanceof Error
          ? err.message
          : 'Could not process this image. Please try another PNG or JPG file.'
      );
    }
  };

  // Update preferred flatmate gender when user gender changes (Boy matches with Boy, Girl with Girl)
  const handleGenderChange = (newGender: Gender) => {
    setGender(newGender);
    setPreferredFlatmateGender(newGender === 'male' ? 'male' : 'female');
  };

  const handleGoogleAuth = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (authLoading) return;
    setSigninError('');
    setShowNewTabHint(false);

    if (!area.trim()) {
      setSigninError('Please enter the location/area of your flat before continuing.');
      return;
    }

    setAuthLoading(true);
    let signedInUser: FirebaseUser;
    try {
      const result = await signInWithPopup(auth, googleProvider);
      signedInUser = result.user;
    } catch (err) {
      console.error('Google Sign-In error:', err);
      const code = (err as { code?: string })?.code || '';
      const rawMessage = err instanceof Error ? err.message : '';
      const inIframe = typeof window !== 'undefined' && window.self !== window.top;

      if (code === 'auth/popup-closed-by-user') {
        setSigninError('Sign-in popup was closed before completing login. Please try again.');
      } else if (code === 'auth/cancelled-popup-request') {
        setSigninError('Sign-in request was cancelled. Please click once and complete the Google sign-in window.');
      } else if (code === 'auth/popup-blocked') {
        setSigninError('Pop-up was blocked by your browser. Please allow pop-ups for this site and try again.');
        if (inIframe) setShowNewTabHint(true);
      } else if (code === 'auth/unauthorized-domain') {
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        setSigninError(
          `This domain (${host}) is not authorized for Google Sign-In. Please open the app from the authorized preview URL.`
        );
      } else if (code === 'auth/operation-not-allowed') {
        setSigninError('Google Sign-In is currently disabled in Firebase Authentication settings.');
      } else if (code === 'auth/internal-error' || code === 'auth/web-storage-unsupported') {
        setSigninError(
          'Your browser blocked Google Sign-In storage inside this embedded frame. Allow third-party cookies or open the app in a new tab.'
        );
        if (inIframe) setShowNewTabHint(true);
      } else if (code === 'auth/network-request-failed') {
        setSigninError(
          'Network error reaching Google Sign-In. Please check your connection or ad-blocker and try again.'
        );
        if (inIframe) setShowNewTabHint(true);
      } else {
        setSigninError(
          `Google Sign-In error (${code || 'auth-error'}): ${rawMessage || 'Please try again.'}`
        );
        if (inIframe) setShowNewTabHint(true);
      }
      setAuthLoading(false);
      return;
    }

    if (!signedInUser.emailVerified) {
      setSigninError('Please use a verified Google account to access ROOMIE.');
      setAuthLoading(false);
      return;
    }

    try {
      // Check if this user already has a profile in Firestore
      const existingProfile = await loadUserProfileFromDb(signedInUser.uid);
      if (existingProfile) {
        const updatedProfile: UserProfile = {
          ...existingProfile,
          hasFlat,
          flatLocation: {
            city,
            area: area.trim(),
          },
          gender,
          preferredFlatmateGender,
        };
        await saveUserProfileToDb(updatedProfile);
        onLoginSuccess(updatedProfile);
      } else {
        // New user -> proceed to mandatory photo & profile registration
        setName(signedInUser.displayName || '');
        setEmail(signedInUser.email || '');
        setRegisterStep(1);
      }
    } catch (dbErr) {
      console.error('Database check error after sign-in:', dbErr);
      setSigninError(
        'Signed in with Google, but failed to load your ROOMIE database profile. Please try again.'
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegisterStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setPhotoError('');
    setStep1Error('');

    if (!area.trim()) {
      setStep1Error('Please enter your flat location or preferred area.');
      return;
    }
    if (!name.trim() || name.trim().length < 2) {
      setStep1Error('Please enter your full name (at least 2 characters).');
      return;
    }
    if (!phone.trim() || phone.trim().length < 6) {
      setStep1Error('Please enter a valid phone number.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setStep1Error('Please enter a valid email address.');
      return;
    }
    if (!uploadedPhoto) {
      setPhotoError('Please upload your photo to register. A real photo is required for flatmate discovery.');
      return;
    }

    setRegisterStep(2);
  };

  const handleFinalRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!firebaseUser) {
      setSubmitError('Authentication session expired. Please sign in with Google again.');
      return;
    }

    if (!uploadedPhoto) {
      setRegisterStep(1);
      setPhotoError('Please upload your profile photo first.');
      return;
    }

    const photoList: string[] = [uploadedPhoto];
    if (uploadedFlatPhoto) {
      photoList.push(uploadedFlatPhoto);
    }

    const newUser: UserProfile = {
      id: firebaseUser.uid,
      name: name.trim(),
      email: (firebaseUser.email || email).trim(),
      phone: phone.trim(),
      gender,
      preferredFlatmateGender,
      hasFlat,
      flatLocation: {
        city,
        area: area.trim(),
      },
      budget,
      skills: selectedSkills.length > 0 ? selectedSkills : ['Software Engineering', 'Problem Solving'],
      hobbies: defaultHobbies,
      interests: defaultInterests,
      lifestyle: {
        sleepSchedule,
        kitchenDiet,
        workRoutine,
        cleanliness: defaultCleanliness,
        smoking: 'Non-smoker',
        pets: 'Friendly with pets',
      },
      bio:
        bio.trim() ||
        `Hi, I am ${name.trim()}! Looking for a compatible ${preferredFlatmateGender} flatmate in ${area.trim()}, ${city}.`,
      photos: photoList,
      registeredAt: new Date().toISOString(),
    };

    setIsSavingProfile(true);
    try {
      await saveUserProfileToDb(newUser);
      onLoginSuccess(newUser);
    } catch (err) {
      setSubmitError(
        err instanceof Error && !err.message.startsWith('{')
          ? err.message
          : 'Could not save your profile to the database. Please try again.'
      );
    } finally {
      setIsSavingProfile(false);
    }
  };

  const isRegistrationMode = Boolean(firebaseUser);

  return (
    <div className="flex-1 flex flex-col justify-center py-10 pb-20 sm:pb-12 px-4 sm:px-6 lg:px-8 relative z-10">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[380px] bg-[#FFD43B]/6 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-xl relative z-10">
        {/* ROOMIE Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center gap-2.5 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-[#383838] border border-[#484848] flex items-center justify-center text-[#FFD43B] shadow-lg">
              <Users2 className="w-6 h-6 stroke-[2.2]" />
            </div>
            <span className="text-3xl font-extrabold tracking-tight text-[#F5F5F5]">
              ROOMIE<span className="text-[#FFD43B]">.</span>
            </span>
          </div>
        </div>

        {/* Auth Box */}
        <div className="bg-[#303030] border border-[#484848] rounded-3xl shadow-2xl p-6 sm:p-8">
          {/* ===================== SIGN IN LANDING ===================== */}
          {!isRegistrationMode && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-extrabold text-[#F5F5F5] tracking-tight">
                  Log in to ROOMIE
                </h2>
                <p className="text-xs text-[#B8B8B8] mt-1">
                  Enter your flat status and location, then sign in with Google to see real flatmates live.
                </p>
              </div>

              <form onSubmit={handleGoogleAuth} className="space-y-4">
                {/* 1. DO YOU HAVE A FLAT? (YES / NO) */}
                <div className="bg-[#242424] p-3.5 rounded-2xl border border-[#444444]">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#FFD43B] mb-2 flex items-center gap-1.5">
                    <Home className="w-4 h-4 text-[#FFD43B]" />
                    <span>Do you have a flat already?</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setHasFlat('has_flat')}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        hasFlat === 'has_flat'
                          ? 'bg-[#FFD43B] text-[#242424] border-[#FFD43B] shadow-md'
                          : 'bg-[#303030] text-[#B8B8B8] border-[#444444] hover:text-[#F5F5F5]'
                      }`}
                    >
                      <span>🏠 Yes, I have a flat</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setHasFlat('needs_flat')}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        hasFlat === 'needs_flat'
                          ? 'bg-[#FFD43B] text-[#242424] border-[#FFD43B] shadow-md'
                          : 'bg-[#303030] text-[#B8B8B8] border-[#444444] hover:text-[#F5F5F5]'
                      }`}
                    >
                      <span>🔍 No, looking for flat</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-[#8e8e8e] mt-2">
                    {hasFlat === 'has_flat'
                      ? 'You have a room/flat and are seeking a compatible flatmate to move in.'
                      : 'You are searching for a room or looking to team up to rent a new flat together.'}
                  </p>
                </div>

                {/* 2. FLAT LOCATION & CITY */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#B8B8B8] mb-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#FFD43B]" />
                      <span>City</span>
                    </label>
                    <select
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3 py-2.5 bg-[#242424] border border-[#444444] rounded-xl text-xs text-[#F5F5F5] focus:outline-none focus:border-[#FFD43B]"
                    >
                      <option value="Bengaluru">Bengaluru</option>
                      <option value="Mumbai">Mumbai</option>
                      <option value="Delhi NCR">Delhi NCR</option>
                      <option value="Pune">Pune</option>
                      <option value="Hyderabad">Hyderabad</option>
                      <option value="Chennai">Chennai</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#B8B8B8] mb-1 flex items-center gap-1">
                      <Search className="w-3.5 h-3.5 text-[#FFD43B]" />
                      <span>Location / Area of Flat</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      placeholder="e.g. Koramangala 4th Block"
                      className="w-full px-3 py-2.5 bg-[#242424] border border-[#444444] rounded-xl text-xs text-[#F5F5F5] placeholder-[#666666] focus:outline-none focus:border-[#FFD43B]"
                    />
                  </div>
                </div>

                {/* 3. GENDER */}
                <div className="bg-[#242424] p-3.5 rounded-2xl border border-[#444444]">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#FFD43B] mb-2">
                    Your Gender
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleGenderChange('male')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        gender === 'male'
                          ? 'bg-[#383838] text-[#FFD43B] border-[#FFD43B]'
                          : 'bg-[#1e1e1e] text-[#8e8e8e] border-[#383838]'
                      }`}
                    >
                      <span>👦 I am a Boy</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleGenderChange('female')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        gender === 'female'
                          ? 'bg-[#383838] text-[#FFD43B] border-[#FFD43B]'
                          : 'bg-[#1e1e1e] text-[#8e8e8e] border-[#383838]'
                      }`}
                    >
                      <span>👧 I am a Girl</span>
                    </button>
                  </div>
                </div>

                {signinError && (
                  <div className="text-xs text-red-400 bg-red-950/40 p-2.5 rounded-lg border border-red-800 space-y-2">
                    <p>{signinError}</p>
                    {showNewTabHint && typeof window !== 'undefined' && (
                      <a
                        href={window.location.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[#FFD43B] font-bold hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open App in New Tab to Sign In</span>
                      </a>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3.5 px-4 bg-[#FFD43B] hover:bg-[#ffe066] text-[#242424] font-bold text-sm rounded-xl transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2.5 cursor-pointer mt-2 disabled:opacity-60"
                >
                  {authLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Signing in with Google...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue with Google &amp; Start Swapping</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="pt-4 border-t border-[#383838] text-center text-sm text-[#B8B8B8]">
                  <span>Don&apos;t have an account? </span>
                  <button
                    type="button"
                    disabled={authLoading}
                    onClick={() => handleGoogleAuth()}
                    className="text-[#FFD43B] hover:underline font-bold cursor-pointer transition-colors disabled:opacity-60"
                  >
                    Register
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ===================== COMPLETE PROFILE REGISTRATION ===================== */}
          {isRegistrationMode && firebaseUser && (
            <div>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#383838]">
                <div>
                  <h2 className="text-xl font-extrabold text-[#F5F5F5] tracking-tight">
                    Complete Your Profile
                  </h2>
                  <p className="text-xs text-[#B8B8B8] mt-0.5">
                    {registerStep === 1
                      ? 'Step 1 of 2: Upload your photo & flat details'
                      : 'Step 2 of 2: Skills, hobbies & living habits'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onSignOutAuth}
                  className="text-xs text-[#B8B8B8] hover:text-[#FFD43B] font-semibold cursor-pointer inline-flex items-center gap-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Switch Account</span>
                </button>
              </div>

              {registerStep === 1 && (
                <form onSubmit={handleRegisterStep1} className="space-y-4">
                  {/* DO YOU HAVE A FLAT? */}
                  <div className="bg-[#242424] p-3 rounded-2xl border border-[#444444]">
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#FFD43B] mb-2 flex items-center gap-1.5">
                      <Home className="w-4 h-4 text-[#FFD43B]" />
                      <span>Do you have a flat already?</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setHasFlat('has_flat')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          hasFlat === 'has_flat'
                            ? 'bg-[#FFD43B] text-[#242424] border-[#FFD43B]'
                            : 'bg-[#303030] text-[#B8B8B8] border-[#444444]'
                        }`}
                      >
                        <span>🏠 Yes, I have a flat</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setHasFlat('needs_flat')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          hasFlat === 'needs_flat'
                            ? 'bg-[#FFD43B] text-[#242424] border-[#FFD43B]'
                            : 'bg-[#303030] text-[#B8B8B8] border-[#444444]'
                        }`}
                      >
                        <span>🔍 No, looking for flat</span>
                      </button>
                    </div>
                  </div>

                  {/* FLAT LOCATION */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#B8B8B8] mb-1">
                        City
                      </label>
                      <select
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full px-3 py-2 bg-[#242424] border border-[#444444] rounded-xl text-xs text-[#F5F5F5] focus:outline-none focus:border-[#FFD43B]"
                      >
                        <option value="Bengaluru">Bengaluru</option>
                        <option value="Mumbai">Mumbai</option>
                        <option value="Delhi NCR">Delhi NCR</option>
                        <option value="Pune">Pune</option>
                        <option value="Hyderabad">Hyderabad</option>
                        <option value="Chennai">Chennai</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#B8B8B8] mb-1">
                        Location / Area of Flat
                      </label>
                      <input
                        type="text"
                        required
                        value={area}
                        onChange={(e) => setArea(e.target.value)}
                        placeholder="e.g. Indiranagar / HSR Sector 1"
                        className="w-full px-3 py-2 bg-[#242424] border border-[#444444] rounded-xl text-xs text-[#F5F5F5] placeholder-[#666666] focus:outline-none focus:border-[#FFD43B]"
                      />
                    </div>
                  </div>

                  {/* GENDER */}
                  <div className="bg-[#242424] p-3 rounded-2xl border border-[#444444]">
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#FFD43B] mb-2">
                      Your Gender
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleGenderChange('male')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          gender === 'male'
                            ? 'bg-[#383838] text-[#FFD43B] border-[#FFD43B]'
                            : 'bg-[#1e1e1e] text-[#8e8e8e] border-[#383838]'
                        }`}
                      >
                        👦 Male (Boy)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGenderChange('female')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          gender === 'female'
                            ? 'bg-[#383838] text-[#FFD43B] border-[#FFD43B]'
                            : 'bg-[#1e1e1e] text-[#8e8e8e] border-[#383838]'
                        }`}
                      >
                        👧 Female (Girl)
                      </button>
                    </div>
                  </div>

                  {/* BASIC DETAILS */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#B8B8B8] mb-1">
                        Full Name
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-[#8e8e8e] absolute left-3 top-2.5" />
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g. Varun Sharma"
                          className="w-full pl-9 pr-3 py-2 bg-[#242424] border border-[#444444] rounded-xl text-xs text-[#F5F5F5] placeholder-[#666666] focus:outline-none focus:border-[#FFD43B]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#B8B8B8] mb-1">
                        Phone Number (+91)
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-[#8e8e8e] absolute left-3 top-2.5" />
                        <input
                          type="tel"
                          required
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          className="w-full pl-9 pr-3 py-2 bg-[#242424] border border-[#444444] rounded-xl text-xs text-[#F5F5F5] placeholder-[#666666] focus:outline-none focus:border-[#FFD43B]"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-[#B8B8B8] mb-1">
                        Verified Google Email
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-[#8e8e8e] absolute left-3 top-2.5" />
                        <input
                          type="email"
                          readOnly
                          value={firebaseUser.email || email}
                          className="w-full pl-9 pr-3 py-2 bg-[#1f1f1f] border border-[#3d3d3d] rounded-xl text-xs text-[#B8B8B8] cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>

                  {/* PHOTO UPLOAD (REQUIRED: REAL PHOTO MANDATORY) */}
                  <div className="bg-[#242424] p-4 rounded-2xl border-2 border-[#FFD43B]/40 shadow-inner">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-[#FFD43B] flex items-center gap-1.5">
                        <Camera className="w-4 h-4 text-[#FFD43B]" />
                        <span>
                          Upload Your Photo <span className="text-red-400">*</span>
                        </span>
                      </label>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFD43B]/20 text-[#FFD43B] border border-[#FFD43B]/30">
                        Mandatory
                      </span>
                    </div>

                    <p className="text-[11px] text-[#B8B8B8] mb-3">
                      Real photo is required so other real flatmates can see you. No AI or stock photos allowed.
                    </p>

                    {uploadedPhoto ? (
                      <div className="flex items-center gap-4 bg-[#303030] p-3 rounded-xl border border-[#484848]">
                        <div className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-[#FFD43B] shrink-0 bg-[#1e1e1e] shadow-md">
                          <img
                            src={uploadedPhoto}
                            alt="Uploaded profile preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 mb-1">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Photo Verified &amp; Attached</span>
                          </div>
                          <p className="text-[11px] text-[#B8B8B8] truncate mb-2">
                            Ready for your flatmate card
                          </p>
                          <div className="flex items-center gap-2">
                            <label className="text-xs bg-[#383838] hover:bg-[#444444] text-[#F5F5F5] font-semibold px-3 py-1.5 rounded-lg border border-[#484848] cursor-pointer transition-colors inline-flex items-center gap-1">
                              <Upload className="w-3.5 h-3.5 text-[#FFD43B]" />
                              <span>Change</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handlePhotoUpload(e, false)}
                                className="hidden"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => setUploadedPhoto(null)}
                              className="text-xs text-red-400 hover:text-red-300 px-2 py-1.5 font-medium cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <label className="group flex flex-col items-center justify-center p-6 border-2 border-dashed border-[#555555] hover:border-[#FFD43B] rounded-2xl bg-[#2a2a2a] hover:bg-[#323232] transition-all cursor-pointer text-center">
                        <div className="w-12 h-12 rounded-full bg-[#383838] group-hover:bg-[#FFD43B]/20 text-[#FFD43B] flex items-center justify-center mb-2 transition-transform group-hover:scale-110 shadow">
                          <Upload className="w-6 h-6 stroke-[2.2]" />
                        </div>
                        <span className="text-xs font-bold text-[#F5F5F5] group-hover:text-[#FFD43B]">
                          Click to select your profile photo
                        </span>
                        <span className="text-[10px] text-[#8e8e8e] mt-1">
                          PNG, JPG, JPEG or WEBP (Max 10MB)
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handlePhotoUpload(e, false)}
                          className="hidden"
                        />
                      </label>
                    )}

                    {/* Optional flat photo if user has flat */}
                    {hasFlat === 'has_flat' && (
                      <div className="mt-4 pt-3 border-t border-[#383838]">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-semibold text-[#B8B8B8] flex items-center gap-1.5">
                            <Home className="w-3.5 h-3.5 text-[#FFD43B]" />
                            <span>Flat / Room Photo (Optional)</span>
                          </label>
                          <span className="text-[10px] text-[#8e8e8e]">Optional</span>
                        </div>

                        {uploadedFlatPhoto ? (
                          <div className="flex items-center gap-3 bg-[#303030] p-2.5 rounded-xl border border-[#484848]">
                            <img
                              src={uploadedFlatPhoto}
                              alt="Flat preview"
                              className="w-14 h-14 rounded-lg object-cover border border-[#484848]"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-[#F5F5F5] font-medium truncate">Flat Photo Added</p>
                              <button
                                type="button"
                                onClick={() => setUploadedFlatPhoto(null)}
                                className="text-[11px] text-red-400 hover:underline mt-0.5 cursor-pointer"
                              >
                                Remove flat photo
                              </button>
                            </div>
                          </div>
                        ) : (
                          <label className="flex items-center justify-center gap-2 py-2 px-3 border border-dashed border-[#484848] hover:border-[#FFD43B] rounded-xl bg-[#2a2a2a] text-xs text-[#B8B8B8] hover:text-[#FFD43B] cursor-pointer transition-colors">
                            <Upload className="w-3.5 h-3.5" />
                            <span>Add a photo of your flat or room</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handlePhotoUpload(e, true)}
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>
                    )}

                    {photoError && (
                      <p className="text-xs text-red-400 bg-red-950/40 p-2 rounded-lg border border-red-800 mt-3 font-medium">
                        {photoError}
                      </p>
                    )}
                  </div>

                  {step1Error && (
                    <p className="text-xs text-red-400 bg-red-950/40 p-2.5 rounded-lg border border-red-800 font-medium">
                      {step1Error}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="w-full py-3 px-4 bg-[#FFD43B] hover:bg-[#ffe066] text-[#242424] font-bold text-sm rounded-xl transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer mt-2"
                  >
                    <span>Next: Add Skills, Hobbies &amp; Habits</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}

              {/* STEP 2: Skills, Hobbies, Lifestyle */}
              {registerStep === 2 && (
                <form onSubmit={handleFinalRegister} className="space-y-4">
                  {/* SKILLS */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#FFD43B] mb-1">
                      Your Skills &amp; Profession
                    </label>
                    <p className="text-[11px] text-[#B8B8B8] mb-2">
                      These will be showcased prominently on your flatmate card:
                    </p>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {[
                        'Frontend Engineer',
                        'UI/UX Designer',
                        'Product Manager',
                        'Data Scientist',
                        'Financial Analyst',
                        'Architect',
                        'Marketer',
                      ].map((s) => {
                        const active = selectedSkills.includes(s);
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() =>
                              setSelectedSkills((prev) =>
                                active ? prev.filter((x) => x !== s) : [...prev, s]
                              )
                            }
                            className={`text-xs px-2.5 py-1 rounded-md border cursor-pointer ${
                              active
                                ? 'bg-[#FFD43B] text-[#242424] border-[#FFD43B] font-bold'
                                : 'bg-[#242424] text-[#B8B8B8] border-[#444444]'
                            }`}
                          >
                            {s} {active && '✓'}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customSkill}
                        onChange={(e) => setCustomSkill(e.target.value)}
                        placeholder="Add another skill..."
                        className="flex-1 px-3 py-1.5 bg-[#242424] border border-[#444444] rounded-lg text-xs text-[#F5F5F5]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (customSkill.trim()) {
                            setSelectedSkills((prev) => [...prev, customSkill.trim()]);
                            setCustomSkill('');
                          }
                        }}
                        className="px-3 py-1.5 bg-[#383838] text-xs font-semibold rounded-lg text-[#F5F5F5] cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {/* HOBBIES, BUDGET & LIFESTYLE */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#383838]">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#B8B8B8] mb-1">
                        Sleep Routine
                      </label>
                      <select
                        value={sleepSchedule}
                        onChange={(e) => setSleepSchedule(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-[#242424] border border-[#444444] rounded-lg text-xs text-[#F5F5F5]"
                      >
                        <option value="11:00 PM – 7:00 AM (Early Riser)">11:00 PM – 7:00 AM (Early Riser)</option>
                        <option value="1:00 AM – 9:00 AM (Night Owl)">1:00 AM – 9:00 AM (Night Owl)</option>
                        <option value="Flexible Schedule">Flexible Schedule</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#B8B8B8] mb-1">
                        Kitchen &amp; Food Habits
                      </label>
                      <select
                        value={kitchenDiet}
                        onChange={(e) => setKitchenDiet(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-[#242424] border border-[#444444] rounded-lg text-xs text-[#F5F5F5]"
                      >
                        <option value="Vegetarian Friendly">Vegetarian Friendly</option>
                        <option value="Strictly Veg / Jain">Strictly Veg / Jain</option>
                        <option value="Non-Veg Foodie">Non-Veg Foodie</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#B8B8B8] mb-1">
                        Work Routine
                      </label>
                      <select
                        value={workRoutine}
                        onChange={(e) => setWorkRoutine(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-[#242424] border border-[#444444] rounded-lg text-xs text-[#F5F5F5]"
                      >
                        <option value="Hybrid (WFH 2 days/week)">Hybrid (WFH 2 days/week)</option>
                        <option value="Work From Office (Daily)">Work From Office (Daily)</option>
                        <option value="Fully Remote / WFH">Fully Remote / WFH</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#B8B8B8] mb-1">
                        Monthly Rent Share Budget
                      </label>
                      <select
                        value={budget}
                        onChange={(e) => setBudget(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-[#242424] border border-[#444444] rounded-lg text-xs text-[#F5F5F5]"
                      >
                        <option value="₹12,000 / mo">₹12,000 / mo</option>
                        <option value="₹15,000 / mo">₹15,000 / mo</option>
                        <option value="₹18,000 / mo">₹18,000 / mo</option>
                        <option value="₹22,000 / mo">₹22,000 / mo</option>
                        <option value="₹28,000 / mo">₹28,000 / mo</option>
                        <option value="₹35,000+ / mo">₹35,000+ / mo</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#B8B8B8] mb-1">
                      Short Bio / Living Note
                    </label>
                    <textarea
                      rows={2}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="e.g. Quiet workhours, love pour-over coffee, tidy kitchen habits."
                      className="w-full px-3 py-1.5 bg-[#242424] border border-[#444444] rounded-xl text-xs text-[#F5F5F5]"
                    />
                  </div>

                  {submitError && (
                    <p className="text-xs text-red-400 bg-red-950/40 p-2.5 rounded-lg border border-red-800 font-medium">
                      {submitError}
                    </p>
                  )}

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      disabled={isSavingProfile}
                      onClick={() => setRegisterStep(1)}
                      className="py-2.5 px-4 bg-[#383838] hover:bg-[#444444] text-xs font-semibold rounded-xl cursor-pointer disabled:opacity-50"
                    >
                      &larr; Back
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingProfile}
                      className="flex-1 py-3 px-4 bg-[#FFD43B] hover:bg-[#ffe066] text-[#242424] font-bold text-xs rounded-xl shadow-md cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {isSavingProfile ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Saving Profile to Cloud...</span>
                        </>
                      ) : (
                        <span>
                          Complete Registration &amp; Discover{' '}
                          {preferredFlatmateGender === 'male' ? 'Male' : 'Female'} Flatmates
                        </span>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Real Person Registry indicator */}
        <div className="mt-4 text-center text-xs text-[#8e8e8e] flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#FFD43B]" />
          <span>Real-time verified flatmate discovery synced across devices</span>
        </div>
      </div>
    </div>
  );
};
