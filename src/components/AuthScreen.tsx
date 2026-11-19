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
  Clock,
  IndianRupee,
  BrainCircuit,
  ShieldAlert,
} from 'lucide-react';
import { UserProfile, Gender, FlatStatus, PersonalityProfile, LivingCircleId } from '../types';
import { verifyAndCompressProfilePhoto } from '../services/profilePhotoVerifier';
import { auth, googleProvider } from '../firebase';
import { computeExpiryIso, loadUserProfileFromDb, saveUserProfileToDb } from '../services/roomieDb';
import { FlatPhotoUploader } from './FlatPhotoUploader';
import { DEFAULT_PERSONALITY, formatINR, parseBudgetMonthly } from '../utils/compatibility';
import { LIVING_CIRCLES } from '../utils/livingCircles';

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

  // Skills, Hobbies, Interests & Living Circles
  const [selectedCircles, setSelectedCircles] = useState<LivingCircleId[]>([
    'it_professionals',
    'peaceful_living',
  ]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>(['Frontend Engineer', 'UI/UX Designer']);
  const [customSkill, setCustomSkill] = useState('');
  const defaultHobbies = ['Weekend Treks', 'Specialty Coffee', 'Gym'];
  const defaultInterests = ['Tech Startups', 'Board Games'];
  const [sleepSchedule, setSleepSchedule] = useState('11:00 PM – 7:00 AM (Early Riser)');
  const [kitchenDiet, setKitchenDiet] = useState('Vegetarian Friendly');
  const [workRoutine, setWorkRoutine] = useState('Hybrid (WFH 2 days/week)');
  const defaultCleanliness = 'Daily kitchen cleanup & shared maid';
  const [bio, setBio] = useState('');

  // Personality, Cost Breakdown & Listing Expiry
  const [personality, setPersonality] = useState<PersonalityProfile>({ ...DEFAULT_PERSONALITY });
  const [listingDurationDays, setListingDurationDays] = useState<7 | 14 | 30>(14);
  const [bhkType, setBhkType] = useState('2 / 3 BHK Shared Flat');
  const [securityDeposit, setSecurityDeposit] = useState(40000);
  const [maintenanceFee, setMaintenanceFee] = useState(1800);
  const [utilitiesEstimate, setUtilitiesEstimate] = useState(2800);
  const [brokerageFee, setBrokerageFee] = useState(0);

  // Photo upload states (Required for registration)
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [uploadedFlatPhotos, setUploadedFlatPhotos] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState('');
  const [isCheckingPhoto, setIsCheckingPhoto] = useState(false);

  // Prefill name and email when Google user is authenticated and completing registration
  useEffect(() => {
    if (firebaseUser) {
      setName((prev) => prev || firebaseUser.displayName || '');
      setEmail(firebaseUser.email || '');
    } else {
      setRegisterStep(1);
    }
  }, [firebaseUser]);

  // Inspect profile image with AI detector and compress to fit Firestore document & security rule limits
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
      setUploadedPhoto(result.compressedDataUrl);
    } catch (err) {
      setPhotoError(
        err instanceof Error
          ? err.message
          : 'Could not verify this profile photo right now. Please try again.'
      );
    } finally {
      setIsCheckingPhoto(false);
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
          `This domain (${host}) is not listed in Firebase Authorized Domains. Add "${host}" in Firebase Console → Authentication → Settings → Authorized domains, or use the pre-authorized AI Studio app URL.`
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
      if (existingProfile && existingProfile.photos && existingProfile.photos.length > 0) {
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
        // New user or missing profile photo -> proceed to mandatory photo & profile registration
        if (existingProfile) {
          setPhone(existingProfile.phone || '');
          setBudget(existingProfile.budget || '₹18,000 / mo');
          setBio(existingProfile.bio || '');
        }
        setName(existingProfile?.name || signedInUser.displayName || '');
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

    const monthlyRent = parseBudgetMonthly(budget);
    const newUser: UserProfile = {
      id: firebaseUser.uid,
      name: name.trim(),
      email: (firebaseUser.email || email).trim(),
      phone: phone.trim(),
      gender,
      preferredFlatmateGender,
      hasFlat,
      livingCircles: selectedCircles.length > 0 ? selectedCircles : ['it_professionals'],
      flatLocation: {
        city,
        area: area.trim(),
      },
      budget: `${formatINR(monthlyRent)} / mo`,
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
      personality,
      costBreakdown: {
        monthlyRent,
        securityDeposit: Math.max(0, securityDeposit),
        maintenanceFee: Math.max(0, maintenanceFee),
        utilitiesEstimate: Math.max(0, utilitiesEstimate),
        brokerageFee: Math.max(0, brokerageFee),
        bhkType: bhkType.trim() || '2 / 3 BHK Shared Flat',
      },
      identityVerification: {
        identityVerified: false,
        verificationMethod: 'google_only',
        verifiedAt: '',
      },
      emergencyContact: '',
      blockedUids: [],
      listingDurationDays,
      expiresAt: computeExpiryIso(listingDurationDays),
      bio:
        bio.trim() ||
        `Hi, I am ${name.trim()}! Looking for a compatible ${preferredFlatmateGender} flatmate in ${area.trim()}, ${city}.`,
      photos: [uploadedPhoto],
      flatPhotos: hasFlat === 'has_flat' ? uploadedFlatPhotos : [],
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
                      <span>Continue with Google &amp; Join Living Circles</span>
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
                              {isCheckingPhoto ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FFD43B]" />
                              ) : (
                                <Upload className="w-3.5 h-3.5 text-[#FFD43B]" />
                              )}
                              <span>{isCheckingPhoto ? 'Scanning...' : 'Change'}</span>
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                disabled={isCheckingPhoto}
                                onChange={handlePhotoUpload}
                                className="hidden"
                              />
                            </label>
                            <button
                              type="button"
                              disabled={isCheckingPhoto}
                              onClick={() => setUploadedPhoto(null)}
                              className="text-xs text-red-400 hover:text-red-300 px-2 py-1.5 font-medium cursor-pointer disabled:opacity-50"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <label
                        className={`group flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl bg-[#2a2a2a] transition-all text-center ${
                          isCheckingPhoto
                            ? 'border-[#FFD43B]/60 cursor-wait'
                            : 'border-[#555555] hover:border-[#FFD43B] hover:bg-[#323232] cursor-pointer'
                        }`}
                      >
                        <div className="w-12 h-12 rounded-full bg-[#383838] group-hover:bg-[#FFD43B]/20 text-[#FFD43B] flex items-center justify-center mb-2 transition-transform group-hover:scale-110 shadow">
                          {isCheckingPhoto ? (
                            <Loader2 className="w-6 h-6 animate-spin" />
                          ) : (
                            <Upload className="w-6 h-6 stroke-[2.2]" />
                          )}
                        </div>
                        <span className="text-xs font-bold text-[#F5F5F5] group-hover:text-[#FFD43B]">
                          {isCheckingPhoto
                            ? 'Scanning photo with AI detector...'
                            : 'Click to select your profile photo'}
                        </span>
                        <span className="text-[10px] text-[#8e8e8e] mt-1">
                          PNG, JPG, or WEBP (Max 10MB)
                        </span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          disabled={isCheckingPhoto}
                          onChange={handlePhotoUpload}
                          className="hidden"
                        />
                      </label>
                    )}

                    {/* AI-Verified Flat Photos Uploader if user has a flat */}
                    {hasFlat === 'has_flat' && (
                      <div className="mt-4 pt-3 border-t border-[#383838]">
                        <FlatPhotoUploader
                          flatPhotos={uploadedFlatPhotos}
                          onChange={(next) => setUploadedFlatPhotos(next)}
                          compact
                        />
                      </div>
                    )}

                    {photoError && (
                      <div className="text-xs text-red-300 bg-red-950/45 p-2.5 rounded-lg border border-red-800 mt-3 font-medium flex items-start gap-2">
                        <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <span>{photoError}</span>
                      </div>
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

              {/* STEP 2: Living Circles, Skills, Hobbies, Lifestyle */}
              {registerStep === 2 && (
                <form onSubmit={handleFinalRegister} className="space-y-4">
                  {/* LIVING CIRCLES */}
                  <div className="bg-[#242424] p-3.5 rounded-2xl border border-[#444444]">
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#FFD43B] mb-1">
                      Join Your Living Circles
                    </label>
                    <p className="text-[11px] text-[#B8B8B8] mb-2.5">
                      Pick circles matching your lifestyle &amp; accommodation requirements (no swiping needed):
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {LIVING_CIRCLES.map((circle) => {
                        const active = selectedCircles.includes(circle.id);
                        return (
                          <button
                            key={circle.id}
                            type="button"
                            onClick={() => {
                              setSelectedCircles((prev) => {
                                if (active && prev.length <= 1) return prev;
                                return active
                                  ? prev.filter((id) => id !== circle.id)
                                  : [...prev, circle.id];
                              });
                            }}
                            className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer flex items-start gap-2 ${
                              active
                                ? 'bg-[#353535] border-[#FFD43B] text-[#F5F5F5]'
                                : 'bg-[#1f1f1f] border-[#3a3a3a] text-[#B8B8B8] hover:border-[#555555]'
                            }`}
                          >
                            <span className="text-base leading-none mt-0.5">{circle.emoji}</span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-bold truncate">{circle.name}</span>
                                {active && <span className="text-[10px] font-bold text-[#FFD43B]">Joined</span>}
                              </div>
                              <p className="text-[10px] text-[#8e8e8e] truncate">{circle.requirementCue}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

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
                        onChange={(e) => {
                          setBudget(e.target.value);
                          setSecurityDeposit(parseBudgetMonthly(e.target.value) * 2);
                        }}
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

                  {/* PERSONALITY MATCHING PROFILE */}
                  <div className="bg-[#242424] p-3.5 rounded-2xl border border-[#444444] space-y-2.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#FFD43B] flex items-center gap-1.5">
                      <BrainCircuit className="w-4 h-4 text-[#FFD43B]" />
                      <span>Personality-Based Matching</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[10px] text-[#8e8e8e] mb-1">Social Vibe</label>
                        <select
                          value={personality.vibe}
                          onChange={(e) => setPersonality((p) => ({ ...p, vibe: e.target.value }))}
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
                          value={personality.guestPolicy}
                          onChange={(e) => setPersonality((p) => ({ ...p, guestPolicy: e.target.value }))}
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
                          value={personality.noiseTolerance}
                          onChange={(e) => setPersonality((p) => ({ ...p, noiseTolerance: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-[#303030] border border-[#444444] rounded-lg text-xs text-[#F5F5F5]"
                        >
                          <option value="Quiet Study / WFH Sanctuary">Quiet Study / WFH Sanctuary</option>
                          <option value="Moderate Ambient">Moderate Ambient</option>
                          <option value="Lively Music / Hangouts">Lively Music / Hangouts</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-[#8e8e8e] mb-1">Chore &amp; Cleaning Style</label>
                        <select
                          value={personality.choreStyle}
                          onChange={(e) => setPersonality((p) => ({ ...p, choreStyle: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-[#303030] border border-[#444444] rounded-lg text-xs text-[#F5F5F5]"
                        >
                          <option value="Shared Maid + Weekend Tidy">Shared Maid + Weekend Tidy</option>
                          <option value="Clean-as-you-go Strictly">Clean-as-you-go Strictly</option>
                          <option value="Weekly Cleaning Schedule">Weekly Cleaning Schedule</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* COMPLETE COST BREAKDOWN & AUTO-EXPIRY */}
                  <div className="bg-[#242424] p-3.5 rounded-2xl border border-[#444444] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-[#FFD43B] flex items-center gap-1.5">
                        <IndianRupee className="w-3.5 h-3.5 text-[#FFD43B]" />
                        <span>Cost Breakdown &amp; Listing Expiry</span>
                      </label>
                      <span className="text-[10px] text-emerald-400 font-semibold inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Auto-expires in {listingDurationDays}d</span>
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] text-[#8e8e8e] mb-0.5">Deposit (₹)</label>
                        <input
                          type="number"
                          min={0}
                          value={securityDeposit}
                          onChange={(e) => setSecurityDeposit(Number(e.target.value) || 0)}
                          className="w-full px-2.5 py-1.5 bg-[#303030] border border-[#444444] rounded-lg text-xs text-[#F5F5F5]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-[#8e8e8e] mb-0.5">Maint. / mo (₹)</label>
                        <input
                          type="number"
                          min={0}
                          value={maintenanceFee}
                          onChange={(e) => setMaintenanceFee(Number(e.target.value) || 0)}
                          className="w-full px-2.5 py-1.5 bg-[#303030] border border-[#444444] rounded-lg text-xs text-[#F5F5F5]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-[#8e8e8e] mb-0.5">Utilities Est. (₹)</label>
                        <input
                          type="number"
                          min={0}
                          value={utilitiesEstimate}
                          onChange={(e) => setUtilitiesEstimate(Number(e.target.value) || 0)}
                          className="w-full px-2.5 py-1.5 bg-[#303030] border border-[#444444] rounded-lg text-xs text-[#F5F5F5]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-[#8e8e8e] mb-0.5">Brokerage (₹)</label>
                        <input
                          type="number"
                          min={0}
                          value={brokerageFee}
                          onChange={(e) => setBrokerageFee(Number(e.target.value) || 0)}
                          className="w-full px-2.5 py-1.5 bg-[#303030] border border-[#444444] rounded-lg text-xs text-[#F5F5F5]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-[#8e8e8e] mb-0.5">Flat Type</label>
                        <input
                          type="text"
                          value={bhkType}
                          onChange={(e) => setBhkType(e.target.value)}
                          placeholder="2 / 3 BHK"
                          className="w-full px-2.5 py-1.5 bg-[#303030] border border-[#444444] rounded-lg text-xs text-[#F5F5F5]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-[#8e8e8e] mb-0.5">Auto-Expiry</label>
                        <select
                          value={listingDurationDays}
                          onChange={(e) => setListingDurationDays(Number(e.target.value) as 7 | 14 | 30)}
                          className="w-full px-2.5 py-1.5 bg-[#303030] border border-[#444444] rounded-lg text-xs text-[#F5F5F5]"
                        >
                          <option value={7}>7 Days</option>
                          <option value={14}>14 Days</option>
                          <option value={30}>30 Days</option>
                        </select>
                      </div>
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
      </div>
    </div>
  );
};
