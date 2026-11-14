import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, 
  RotateCcw, 
  Star, 
  Heart, 
  Zap, 
  Info, 
  MapPin, 
  Home, 
  Search, 
  Briefcase, 
  Sparkles, 
  Moon, 
  Utensils, 
  CheckCircle2, 
  MessageSquare,
  Filter,
  ShieldCheck
} from 'lucide-react';
import { FlatmateCandidate, UserProfile } from '../types';

interface DiscoveryDeckProps {
  candidates: FlatmateCandidate[];
  currentUser: UserProfile;
  matchedIds?: string[];
  onConnectFlatmate: (candidate: FlatmateCandidate, isSuper: boolean) => void;
  onPassFlatmate?: (candidate: FlatmateCandidate) => void;
  onOpenChatWith: (candidate: FlatmateCandidate) => void;
  genderFilter: 'male' | 'female' | 'all';
  onGenderFilterChange: (filter: 'male' | 'female' | 'all') => void;
}

export const DiscoveryDeck: React.FC<DiscoveryDeckProps> = ({
  candidates,
  currentUser,
  matchedIds = [],
  onConnectFlatmate,
  onPassFlatmate,
  onOpenChatWith,
  genderFilter,
  onGenderFilterChange,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [swipeAction, setSwipeAction] = useState<'left' | 'right' | 'super' | null>(null);
  const [showBioModal, setShowBioModal] = useState(false);
  const [matchedCandidate, setMatchedCandidate] = useState<FlatmateCandidate | null>(null);
  const [boostActive, setBoostActive] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const swipeTimerRef = useRef<number | null>(null);
  const boostTimerRef = useRef<number | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (swipeTimerRef.current) window.clearTimeout(swipeTimerRef.current);
      if (boostTimerRef.current) window.clearTimeout(boostTimerRef.current);
    };
  }, []);

  // Filter candidates according to gender preference (Boy matches with Boy, Girl with Girl)
  const filteredCandidates = candidates.filter((c) => {
    if (genderFilter === 'all') return true;
    return c.gender === genderFilter;
  });

  const currentCandidate = filteredCandidates[currentIndex];
  const isDeckComplete = currentIndex >= filteredCandidates.length;

  const currentGallery = currentCandidate
    ? [
        ...(currentCandidate.photos || []),
        ...(currentCandidate.hasFlat === 'has_flat' ? currentCandidate.flatPhotos || [] : []),
      ]
    : [];
  const profilePhotoCount = currentCandidate?.photos?.length || 0;
  const isViewingFlatPhoto = photoIndex >= profilePhotoCount && currentGallery.length > 0;

  // Reset photo index when candidate changes
  useEffect(() => {
    setPhotoIndex(0);
    setShowBioModal(false);
  }, [currentIndex]);

  const handlePass = useCallback(() => {
    if (swipeAction || isDeckComplete || !currentCandidate) return;
    const target = currentCandidate;
    setSwipeAction('left');
    if (onPassFlatmate) onPassFlatmate(target);
    swipeTimerRef.current = window.setTimeout(() => {
      setSwipeAction(null);
      setCurrentIndex((prev) => prev + 1);
    }, 240);
  }, [swipeAction, isDeckComplete, currentCandidate, onPassFlatmate]);

  const handleLike = useCallback(() => {
    if (swipeAction || isDeckComplete || !currentCandidate) return;
    setSwipeAction('right');
    const target = currentCandidate;
    onConnectFlatmate(target, false);

    swipeTimerRef.current = window.setTimeout(() => {
      setSwipeAction(null);
      setMatchedCandidate(target);
      setCurrentIndex((prev) => prev + 1);
    }, 240);
  }, [swipeAction, isDeckComplete, currentCandidate, onConnectFlatmate]);

  const handleSuperLike = useCallback(() => {
    if (swipeAction || isDeckComplete || !currentCandidate) return;
    setSwipeAction('super');
    const target = currentCandidate;
    onConnectFlatmate(target, true);

    swipeTimerRef.current = window.setTimeout(() => {
      setSwipeAction(null);
      setMatchedCandidate(target);
      setCurrentIndex((prev) => prev + 1);
    }, 240);
  }, [swipeAction, isDeckComplete, currentCandidate, onConnectFlatmate]);

  const handleRewind = () => {
    if (swipeAction || currentIndex === 0) return;
    setCurrentIndex((prev) => prev - 1);
  };

  const handleBoost = () => {
    setBoostActive(true);
    setToastMessage(`⚡ Profile Boosted! Your flat listing in ${currentUser.flatLocation.area} is prioritized.`);
    if (boostTimerRef.current) window.clearTimeout(boostTimerRef.current);
    boostTimerRef.current = window.setTimeout(() => {
      setBoostActive(false);
      setToastMessage(null);
    }, 4500);
  };

  const handlePhotoTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentCandidate || currentGallery.length <= 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const isRightHalf = clickX > rect.width / 2;

    if (isRightHalf) {
      setPhotoIndex((prev) => (prev + 1) % currentGallery.length);
    } else {
      setPhotoIndex((prev) => (prev - 1 + currentGallery.length) % currentGallery.length);
    }
  };

  // Keyboard controls: Arrow Left (Pass), Arrow Right (Like), Arrow Up (Super Like)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }
      if (showBioModal || matchedCandidate) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePass();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleLike();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleSuperLike();
      } else if (e.key === ' ' && !isDeckComplete && currentCandidate) {
        e.preventDefault();
        setShowBioModal((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePass, handleLike, handleSuperLike, showBioModal, matchedCandidate, isDeckComplete, currentCandidate]);

  return (
    <div className="w-full max-w-md mx-auto px-4 py-4 flex flex-col items-center select-none">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 z-50 bg-[#303030] border border-[#FFD43B] text-[#F5F5F5] px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-semibold transition-all duration-200">
          <Zap className="w-4 h-4 text-[#A855F7] fill-[#A855F7]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Filter Strip: Gender Matching Filter */}
      <div className="w-full flex items-center justify-between mb-3 text-xs">
        <div className="flex items-center gap-1.5 p-1 bg-[#303030] rounded-xl border border-[#444444]">
          <span className="text-[#8e8e8e] px-2 flex items-center gap-1">
            <Filter className="w-3 h-3 text-[#FFD43B]" />
            <span className="hidden sm:inline">Gender Match:</span>
          </span>
          <button
            onClick={() => { onGenderFilterChange('male'); setCurrentIndex(0); }}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              genderFilter === 'male'
                ? 'bg-[#FFD43B] text-[#242424] shadow-sm'
                : 'text-[#B8B8B8] hover:text-[#F5F5F5]'
            }`}
          >
            👦 Boys
          </button>
          <button
            onClick={() => { onGenderFilterChange('female'); setCurrentIndex(0); }}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              genderFilter === 'female'
                ? 'bg-[#FFD43B] text-[#242424] shadow-sm'
                : 'text-[#B8B8B8] hover:text-[#F5F5F5]'
            }`}
          >
            👧 Girls
          </button>
          <button
            onClick={() => { onGenderFilterChange('all'); setCurrentIndex(0); }}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              genderFilter === 'all'
                ? 'bg-[#FFD43B] text-[#242424] shadow-sm'
                : 'text-[#B8B8B8] hover:text-[#F5F5F5]'
            }`}
          >
            All
          </button>
        </div>

        {!isDeckComplete && currentCandidate && (
          <span className="text-[11px] font-mono text-[#8e8e8e] bg-[#303030] px-2 py-1 rounded-lg border border-[#444444]">
            {currentIndex + 1} / {filteredCandidates.length}
          </span>
        )}
      </div>

      {/* MAIN TINDER-STYLE CARD */}
      {!isDeckComplete && currentCandidate ? (
        <div className="relative w-full">
          
          {/* Card Container with interactive animations */}
          <div
            className={`relative w-full aspect-[3/4.2] rounded-3xl overflow-hidden shadow-2xl border border-[#484848] bg-[#303030] transition-all duration-200 transform ${
              swipeAction === 'left'
                ? '-translate-x-32 -rotate-12 opacity-0'
                : swipeAction === 'right'
                ? 'translate-x-32 rotate-12 opacity-0'
                : swipeAction === 'super'
                ? '-translate-y-32 scale-95 opacity-0'
                : 'translate-x-0 rotate-0 opacity-100'
            }`}
          >
            {/* Stamp Overlays (NOPE in Red / ROOMIE in Green / SUPER in Blue) */}
            {swipeAction === 'left' && (
              <div className="absolute top-10 right-6 z-30 border-4 border-red-500 text-red-500 font-extrabold text-3xl px-4 py-1.5 rounded-xl rotate-12 tracking-wider bg-black/40 shadow-xl">
                NOPE
              </div>
            )}
            {swipeAction === 'right' && (
              <div className="absolute top-10 left-6 z-30 border-4 border-emerald-400 text-emerald-400 font-extrabold text-3xl px-4 py-1.5 rounded-xl -rotate-12 tracking-wider bg-black/40 shadow-xl">
                ROOMIE
              </div>
            )}
            {swipeAction === 'super' && (
              <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 border-4 border-blue-400 text-blue-400 font-extrabold text-3xl px-6 py-1.5 rounded-xl tracking-wider bg-black/50 shadow-xl">
                SUPER ROOMIE
              </div>
            )}

            {/* Photo Viewport with Tap Zones */}
            <div 
              onClick={handlePhotoTap}
              className="relative w-full h-full cursor-pointer overflow-hidden"
            >
              {currentGallery.length > 0 ? (
                <img
                  src={currentGallery[photoIndex] || currentGallery[0]}
                  alt={isViewingFlatPhoto ? `${currentCandidate.name}'s flat` : currentCandidate.name}
                  className="w-full h-full object-cover object-center"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full bg-[#2a2a2a] flex items-center justify-center text-[#FFD43B] text-6xl font-extrabold">
                  {currentCandidate.name.charAt(0).toUpperCase()}
                </div>
              )}

              {/* Gradient scrim for text readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-black/40 pointer-events-none" />

              {/* Tinder Multi-Photo Story Bars */}
              {currentGallery.length > 1 && (
                <div className="absolute top-3 left-3 right-3 flex items-center gap-1.5 z-20">
                  {currentGallery.map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-1 flex-1 rounded-full transition-all ${
                        idx === photoIndex ? 'bg-white shadow' : 'bg-white/35'
                      }`}
                    />
                  ))}
                </div>
              )}

              {/* Top Tags: Has Flat (Yes/No), Flat Photo Indicator & Location */}
              <div className="absolute top-7 left-3 right-3 flex items-center justify-between gap-2 z-10 pointer-events-none">
                {isViewingFlatPhoto ? (
                  <span className="inline-flex items-center gap-1.5 bg-sky-500/90 text-white text-[11px] font-extrabold px-3 py-1 rounded-full shadow-lg border border-sky-300">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>REAL FLAT PHOTO · {currentCandidate.area}</span>
                  </span>
                ) : currentCandidate.hasFlat === 'has_flat' ? (
                  <span className="inline-flex items-center gap-1.5 bg-emerald-500/90 text-white text-[11px] font-extrabold px-3 py-1 rounded-full shadow-lg border border-emerald-400">
                    <Home className="w-3.5 h-3.5" />
                    <span>
                      HAS FLAT · {currentCandidate.area}
                      {currentCandidate.flatPhotos && currentCandidate.flatPhotos.length > 0
                        ? ` (${currentCandidate.flatPhotos.length} Flat Pics)`
                        : ''}
                    </span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 bg-amber-500/90 text-[#242424] text-[11px] font-extrabold px-3 py-1 rounded-full shadow-lg border border-amber-300">
                    <Search className="w-3.5 h-3.5" />
                    <span>LOOKING FOR FLAT · {currentCandidate.area}</span>
                  </span>
                )}

                <span className="bg-[#242424]/90 backdrop-blur-md text-[#FFD43B] font-extrabold text-xs px-2.5 py-1 rounded-full border border-[#484848] shrink-0">
                  {currentCandidate.compatibilityScore || 92}% Match
                </span>
              </div>

              {/* Card Bottom Info Overlay */}
              <div className="absolute bottom-4 left-4 right-4 z-20 pointer-events-none">
                
                {/* Name, Age & Verified indicator */}
                <div className="flex items-end justify-between mb-1">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-[#F5F5F5] drop-shadow-md flex items-center gap-2">
                      <span>{currentCandidate.name}</span>
                      <span className="text-xl font-normal text-[#B8B8B8]">{currentCandidate.age}</span>
                      <CheckCircle2 className="w-5 h-5 text-[#FFD43B] fill-[#FFD43B]" />
                    </h2>
                    <p className="text-xs sm:text-sm font-semibold text-[#FFD43B] flex items-center gap-1.5 mt-0.5">
                      <Briefcase className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{currentCandidate.profession}</span>
                    </p>
                  </div>

                  {/* Info Open Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowBioModal(true);
                    }}
                    className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/40 flex items-center justify-center text-white pointer-events-auto cursor-pointer transition-transform hover:scale-110 active:scale-95 shadow-lg"
                    title="Open Full Profile"
                  >
                    <Info className="w-5 h-5" />
                  </button>
                </div>

                {/* Flat Location & Rent Share */}
                <div className="flex items-center justify-between text-xs text-[#F5F5F5] mb-3">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#FFD43B]" />
                    <span>{currentCandidate.city} ({currentCandidate.area})</span>
                  </span>
                  <span className="font-extrabold text-[#FFD43B] bg-[#242424]/80 px-2 py-0.5 rounded">
                    {currentCandidate.budget}
                  </span>
                </div>

                {/* SKILLS PILLS (Prominently displayed) */}
                <div className="mb-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {currentCandidate.skills.slice(0, 3).map((skill) => (
                      <span
                        key={skill}
                        className="text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/20 text-[#F5F5F5]"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Lifestyle Indicators */}
                <div className="grid grid-cols-2 gap-1.5 text-[11px] text-[#B8B8B8] bg-black/50 backdrop-blur-md p-2 rounded-xl border border-white/10">
                  <div className="flex items-center gap-1.5 truncate">
                    <Moon className="w-3.5 h-3.5 text-[#FFD43B] shrink-0" />
                    <span className="truncate">{currentCandidate.lifestyle.sleepSchedule.split('(')[0]}</span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <Utensils className="w-3.5 h-3.5 text-[#FFD43B] shrink-0" />
                    <span className="truncate">{currentCandidate.lifestyle.kitchenDiet}</span>
                  </div>
                </div>

              </div>

            </div>

          </div>

          {/* TINDER EXACT 5 ACTION BUTTONS (Rewind, Nope, Super Like, Like, Boost) */}
          <div className="flex items-center justify-center gap-3 sm:gap-4 mt-5">
            
            {/* 1. REWIND (Yellow Circular Button) */}
            <button
              onClick={handleRewind}
              disabled={currentIndex === 0}
              className={`w-12 h-12 rounded-full bg-[#303030] border-2 border-amber-400 text-amber-400 flex items-center justify-center transition-all cursor-pointer shadow-lg ${
                currentIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:scale-110 active:scale-95 hover:bg-amber-400/10'
              }`}
              title="Rewind previous candidate"
              aria-label="Rewind"
            >
              <RotateCcw className="w-5 h-5 stroke-[2.2]" />
            </button>

            {/* 2. NOPE / PASS (Red Circular Button) */}
            <button
              onClick={handlePass}
              className="w-16 h-16 rounded-full bg-[#303030] border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all duration-150 shadow-xl hover:scale-110 active:scale-95 cursor-pointer"
              title="Nope / Pass (Arrow Left)"
              aria-label="Nope"
            >
              <X className="w-8 h-8 stroke-[2.8]" />
            </button>

            {/* 3. SUPER LIKE / SUPER ROOMIE (Blue Circular Button) */}
            <button
              onClick={handleSuperLike}
              className="w-13 h-13 rounded-full bg-[#303030] border-2 border-sky-400 text-sky-400 hover:bg-sky-400 hover:text-white flex items-center justify-center transition-all duration-150 shadow-lg hover:scale-110 active:scale-95 cursor-pointer"
              title="Super Roomie Connect (Arrow Up)"
              aria-label="Super Like"
            >
              <Star className="w-6 h-6 stroke-[2.5] fill-sky-400 hover:fill-white" />
            </button>

            {/* 4. LIKE / I'M INTERESTED (Green Circular Button with Heart) */}
            <button
              onClick={handleLike}
              className="w-16 h-16 rounded-full bg-[#303030] border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-white flex items-center justify-center transition-all duration-150 shadow-xl hover:scale-110 active:scale-95 cursor-pointer"
              title="I'm Interested in This Profile (Arrow Right)"
              aria-label="I'm Interested"
            >
              <Heart className="w-8 h-8 stroke-[2.8] fill-emerald-400 hover:fill-white" />
            </button>

            {/* 5. BOOST (Purple Circular Button) */}
            <button
              onClick={handleBoost}
              className={`w-12 h-12 rounded-full bg-[#303030] border-2 border-purple-500 text-purple-400 flex items-center justify-center transition-all cursor-pointer shadow-lg ${
                boostActive ? 'bg-purple-500 text-white animate-pulse' : 'hover:scale-110 active:scale-95 hover:bg-purple-500/10'
              }`}
              title="Boost Profile in Your Flat Location"
              aria-label="Boost"
            >
              <Zap className="w-5 h-5 stroke-[2.5] fill-purple-400" />
            </button>

          </div>

          <p className="text-[11px] text-center text-[#6e6e6e] mt-3">
            Tinder flow: Tap photo sides to switch pics · Arrow keys to swipe
          </p>

        </div>
      ) : (
        /* Empty / End of Deck State */
        <div className="w-full bg-[#303030] border border-[#484848] rounded-3xl p-8 text-center shadow-2xl my-6">
          <div className="w-16 h-16 rounded-2xl bg-[#FFD43B]/10 border border-[#FFD43B]/30 text-[#FFD43B] flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 stroke-[2.2]" />
          </div>
          <h3 className="text-xl font-bold text-[#F5F5F5] mb-2">
            No More {genderFilter === 'male' ? 'Boy' : genderFilter === 'female' ? 'Girl' : ''} Profiles Right Now
          </h3>
          <p className="text-xs text-[#B8B8B8] max-w-xs mx-auto mb-6">
            You&apos;ve swiped through all available flatmates in this category. As new real users log in, they will appear here!
          </p>
          <div className="flex flex-col gap-2 max-w-xs mx-auto">
            <button
              onClick={() => setCurrentIndex(0)}
              className="py-2.5 px-4 bg-[#FFD43B] hover:bg-[#ffe066] text-[#242424] font-bold text-xs rounded-xl shadow cursor-pointer"
            >
              Review Deck Again
            </button>
            <button
              onClick={() => onGenderFilterChange(genderFilter === 'male' ? 'female' : 'male')}
              className="py-2.5 px-4 bg-[#383838] hover:bg-[#444444] text-[#F5F5F5] font-semibold text-xs rounded-xl border border-[#484848] cursor-pointer"
            >
              Switch to {genderFilter === 'male' ? 'Female' : 'Male'} Flatmates
            </button>
          </div>
        </div>
      )}

      {/* FULL BIO DETAILS DRAWER / MODAL */}
      {showBioModal && currentCandidate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm transition-opacity duration-150">
          <div className="relative w-full max-w-lg bg-[#303030] border border-[#484848] rounded-t-3xl sm:rounded-3xl max-h-[85vh] overflow-y-auto p-6 shadow-2xl text-[#F5F5F5]">
            
            {/* Close button */}
            <button
              onClick={() => setShowBioModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-[#383838] hover:bg-[#444444] text-[#B8B8B8] hover:text-[#F5F5F5]"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Profile Header */}
            <div className="mb-4 pr-10">
              <h3 className="text-2xl font-extrabold text-[#F5F5F5]">
                {currentCandidate.name}, {currentCandidate.age}
              </h3>
              <p className="text-xs font-semibold text-[#FFD43B]">
                {currentCandidate.profession}
              </p>
              <p className="text-xs text-[#B8B8B8] mt-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#FFD43B]" />
                <span>{currentCandidate.city} · {currentCandidate.area}</span>
              </p>
            </div>

            {/* Flat Status Card */}
            <div className={`p-4 rounded-2xl border mb-5 ${
              currentCandidate.hasFlat === 'has_flat'
                ? 'bg-emerald-950/30 border-emerald-800'
                : 'bg-amber-950/30 border-amber-800'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-extrabold flex items-center gap-1.5 text-[#F5F5F5]">
                  {currentCandidate.hasFlat === 'has_flat' ? '🏠 Has a Flat (Looking for Flatmate)' : '🔍 Looking for a Flat / Room'}
                </span>
                <span className="text-xs font-bold text-[#FFD43B]">
                  {currentCandidate.budget}
                </span>
              </div>
              {currentCandidate.flatDetails && (
                <div className="text-xs text-[#B8B8B8] space-y-1 pt-2 border-t border-white/10">
                  <p>Type: <span className="text-[#F5F5F5] font-semibold">{currentCandidate.flatDetails.bhk}</span> · Deposit: <span className="text-[#F5F5F5] font-semibold">{currentCandidate.flatDetails.deposit}</span></p>
                  <p>Amenities: {currentCandidate.flatDetails.amenities.join(' · ')}</p>
                </div>
              )}
            </div>

            {/* Verified Real Flat Photos Gallery */}
            {currentCandidate.hasFlat === 'has_flat' &&
              currentCandidate.flatPhotos &&
              currentCandidate.flatPhotos.length > 0 && (
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#FFD43B] flex items-center gap-1.5">
                      <Home className="w-3.5 h-3.5" />
                      <span>Shared Flat Photos</span>
                    </h4>
                    <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/35 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      <span>AI-Verified Real</span>
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {currentCandidate.flatPhotos.map((src, idx) => (
                      <div
                        key={idx}
                        className="aspect-[4/3] rounded-xl overflow-hidden border border-[#484848] bg-[#242424]"
                      >
                        <img
                          src={src}
                          alt={`${currentCandidate.name} flat ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* About Me Bio */}
            <div className="mb-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#FFD43B] mb-2">
                About Me &amp; Living Style
              </h4>
              <p className="text-xs text-[#B8B8B8] leading-relaxed bg-[#242424] p-3.5 rounded-xl border border-[#3d3d3d]">
                &ldquo;{currentCandidate.bio}&rdquo;
              </p>
            </div>

            {/* Skills */}
            <div className="mb-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#FFD43B] mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Skills &amp; Technical Strengths</span>
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {currentCandidate.skills.map((skill) => (
                  <span
                    key={skill}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg bg-[#383838] border border-[#484848] text-[#F5F5F5]"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {/* Lifestyle Specs */}
            <div className="mb-6">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#FFD43B] mb-2">
                Living Preferences
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-[#242424] p-2.5 rounded-xl border border-[#3d3d3d]">
                  <span className="text-[10px] text-[#8e8e8e] block">Sleeping Clock</span>
                  <span className="text-[#F5F5F5] font-medium">{currentCandidate.lifestyle.sleepSchedule}</span>
                </div>
                <div className="bg-[#242424] p-2.5 rounded-xl border border-[#3d3d3d]">
                  <span className="text-[10px] text-[#8e8e8e] block">Kitchen / Food</span>
                  <span className="text-[#F5F5F5] font-medium">{currentCandidate.lifestyle.kitchenDiet}</span>
                </div>
                <div className="bg-[#242424] p-2.5 rounded-xl border border-[#3d3d3d]">
                  <span className="text-[10px] text-[#8e8e8e] block">Work Schedule</span>
                  <span className="text-[#F5F5F5] font-medium">{currentCandidate.lifestyle.workRoutine}</span>
                </div>
                <div className="bg-[#242424] p-2.5 rounded-xl border border-[#3d3d3d]">
                  <span className="text-[10px] text-[#8e8e8e] block">Smoking / Pets</span>
                  <span className="text-[#F5F5F5] font-medium">{currentCandidate.lifestyle.smoking} · {currentCandidate.lifestyle.pets}</span>
                </div>
              </div>
            </div>

            {/* Quick Action Footer */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setShowBioModal(false);
                  handlePass();
                }}
                className="flex-1 py-3 bg-[#383838] hover:bg-[#444444] text-[#F5F5F5] font-bold text-xs rounded-xl cursor-pointer"
              >
                Pass
              </button>
              {matchedIds.includes(currentCandidate.id) ? (
                <button
                  onClick={() => {
                    setShowBioModal(false);
                    onOpenChatWith(currentCandidate);
                  }}
                  className="flex-1 py-3 bg-emerald-400 hover:bg-emerald-300 text-[#242424] font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Say Hello</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    setShowBioModal(false);
                    handleLike();
                  }}
                  className="flex-1 py-3 bg-[#FFD43B] hover:bg-[#ffe066] text-[#242424] font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Heart className="w-4 h-4 fill-current" />
                  <span>I&apos;m Interested in This Profile</span>
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* TINDER-STYLE MATCH CELEBRATION MODAL ("It's a Roomie Match!") */}
      {matchedCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md transition-opacity duration-200">
          <div className="relative w-full max-w-sm bg-[#303030] border border-[#FFD43B] rounded-3xl p-6 sm:p-8 text-center shadow-2xl text-[#F5F5F5]">
            
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-1">
              Chat Unlocked
            </p>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-[#F5F5F5] mb-6">
              You&apos;re Interested!
            </h3>

            {/* Two Overlapping Profile Photos */}
            <div className="flex items-center justify-center mb-6">
              <div className="w-20 h-20 rounded-full border-4 border-[#FFD43B] overflow-hidden -mr-4 shadow-xl z-10 bg-[#242424] flex items-center justify-center">
                {currentUser.photos && currentUser.photos[0] ? (
                  <img
                    src={currentUser.photos[0]}
                    alt={currentUser.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xl font-extrabold text-[#FFD43B]">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="w-20 h-20 rounded-full border-4 border-emerald-400 overflow-hidden shadow-xl z-20 bg-[#242424] flex items-center justify-center">
                {matchedCandidate.photos && matchedCandidate.photos[0] ? (
                  <img
                    src={matchedCandidate.photos[0]}
                    alt={matchedCandidate.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xl font-extrabold text-emerald-400">
                    {matchedCandidate.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            </div>

            <p className="text-xs text-[#B8B8B8] leading-relaxed mb-6">
              You marked interest in <span className="text-[#F5F5F5] font-bold">{matchedCandidate.name}</span> in <span className="text-[#FFD43B] font-semibold">{matchedCandidate.area}</span>. Click <span className="text-[#F5F5F5] font-semibold">Say Hello</span> below to open your private chat screen.
            </p>

            <div className="space-y-2.5">
              <button
                onClick={() => {
                  const target = matchedCandidate;
                  setMatchedCandidate(null);
                  onOpenChatWith(target);
                }}
                className="w-full py-3.5 px-4 bg-[#FFD43B] hover:bg-[#ffe066] text-[#242424] font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Say Hello</span>
              </button>

              <button
                onClick={() => setMatchedCandidate(null)}
                className="w-full py-2.5 px-4 bg-[#383838] hover:bg-[#444444] text-[#B8B8B8] hover:text-[#F5F5F5] font-semibold text-xs rounded-xl cursor-pointer"
              >
                Keep Browsing
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
