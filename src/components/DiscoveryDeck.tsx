import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  ShieldCheck,
  Users,
  Clock,
  Flag,
  Ban,
  BrainCircuit,
} from 'lucide-react';
import { FlatmateCandidate, RoomieGroup, UserProfile } from '../types';
import {
  DEFAULT_PERSONALITY,
  computeGroupCompatibility,
  getListingExpiryStatus,
} from '../utils/compatibility';
import { CostBreakdownCard } from './CostBreakdownCard';

type DeckItem =
  | { kind: 'solo'; id: string; candidate: FlatmateCandidate }
  | { kind: 'group'; id: string; group: RoomieGroup };

interface DiscoveryDeckProps {
  candidates: FlatmateCandidate[];
  groups?: RoomieGroup[];
  currentUser: UserProfile;
  matchedIds?: string[];
  interestedGroupIds?: string[];
  onConnectFlatmate: (candidate: FlatmateCandidate, isSuper: boolean) => void;
  onPassFlatmate?: (candidate: FlatmateCandidate) => void;
  onOpenChatWith: (candidate: FlatmateCandidate) => void;
  onGroupInterested?: (group: RoomieGroup) => Promise<void> | void;
  onOpenGroupChat?: (group: RoomieGroup) => void;
  onReportOrBlock?: (candidate: FlatmateCandidate, mode: 'report' | 'block') => void;
  genderFilter: 'male' | 'female' | 'all';
  onGenderFilterChange: (filter: 'male' | 'female' | 'all') => void;
}

export const DiscoveryDeck: React.FC<DiscoveryDeckProps> = ({
  candidates,
  groups = [],
  currentUser,
  matchedIds = [],
  interestedGroupIds = [],
  onConnectFlatmate,
  onPassFlatmate,
  onOpenChatWith,
  onGroupInterested,
  onOpenGroupChat,
  onReportOrBlock,
  genderFilter,
  onGenderFilterChange,
}) => {
  const [deckMode, setDeckMode] = useState<'all' | 'solo' | 'groups'>('all');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [swipeAction, setSwipeAction] = useState<'left' | 'right' | 'super' | null>(null);
  const [showBioModal, setShowBioModal] = useState(false);
  const [matchedCandidate, setMatchedCandidate] = useState<FlatmateCandidate | null>(null);
  const [matchedGroup, setMatchedGroup] = useState<RoomieGroup | null>(null);
  const [boostActive, setBoostActive] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const swipeTimerRef = useRef<number | null>(null);
  const boostTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (swipeTimerRef.current) window.clearTimeout(swipeTimerRef.current);
      if (boostTimerRef.current) window.clearTimeout(boostTimerRef.current);
    };
  }, []);

  const filteredCandidates = useMemo(
    () =>
      candidates.filter((c) => {
        if (genderFilter === 'all') return true;
        return c.gender === genderFilter;
      }),
    [candidates, genderFilter]
  );

  // Groups visible while swapping (exclude groups the current user is already a member of)
  const swappableGroups = useMemo(
    () =>
      groups.filter((g) => {
        if (g.memberUids.includes(currentUser.id)) return false;
        if (genderFilter === 'all' || g.gender === 'mixed') return true;
        return g.gender === genderFilter;
      }),
    [groups, currentUser.id, genderFilter]
  );

  // Interleave Duo Groups right into the swap deck (1 group after every 2 solo profiles)
  const deckItems = useMemo<DeckItem[]>(() => {
    if (deckMode === 'solo') {
      return filteredCandidates.map((c) => ({ kind: 'solo', id: `solo_${c.id}`, candidate: c }));
    }
    if (deckMode === 'groups') {
      return swappableGroups.map((g) => ({ kind: 'group', id: `grp_${g.groupId}`, group: g }));
    }

    const items: DeckItem[] = [];
    let gIdx = 0;
    filteredCandidates.forEach((c, idx) => {
      items.push({ kind: 'solo', id: `solo_${c.id}`, candidate: c });
      if ((idx + 1) % 2 === 0 && gIdx < swappableGroups.length) {
        const g = swappableGroups[gIdx++];
        items.push({ kind: 'group', id: `grp_${g.groupId}`, group: g });
      }
    });
    while (gIdx < swappableGroups.length) {
      const g = swappableGroups[gIdx++];
      items.push({ kind: 'group', id: `grp_${g.groupId}`, group: g });
    }
    return items;
  }, [deckMode, filteredCandidates, swappableGroups]);

  useEffect(() => {
    if (currentIndex > deckItems.length) {
      setCurrentIndex(0);
    }
  }, [deckItems.length, currentIndex]);

  const currentItem = deckItems[currentIndex];
  const isDeckComplete = currentIndex >= deckItems.length;

  const currentCandidate = currentItem?.kind === 'solo' ? currentItem.candidate : null;
  const currentGroup = currentItem?.kind === 'group' ? currentItem.group : null;

  const currentGallery = useMemo(() => {
    if (currentCandidate) {
      return [
        ...(currentCandidate.photos || []),
        ...(currentCandidate.hasFlat === 'has_flat' ? currentCandidate.flatPhotos || [] : []),
      ];
    }
    if (currentGroup) {
      return [...(currentGroup.flatPhotos || []), ...(currentGroup.memberPhotos || [])];
    }
    return [];
  }, [currentCandidate, currentGroup]);

  const profilePhotoCount = currentCandidate?.photos?.length || 0;
  const isViewingFlatPhoto = Boolean(
    currentCandidate && photoIndex >= profilePhotoCount && currentGallery.length > 0
  );

  useEffect(() => {
    setPhotoIndex(0);
    setShowBioModal(false);
  }, [currentIndex]);

  const handlePass = useCallback(() => {
    if (swipeAction || isDeckComplete || !currentItem) return;
    setSwipeAction('left');
    if (currentItem.kind === 'solo' && onPassFlatmate) {
      onPassFlatmate(currentItem.candidate);
    }
    swipeTimerRef.current = window.setTimeout(() => {
      setSwipeAction(null);
      setCurrentIndex((prev) => prev + 1);
    }, 240);
  }, [swipeAction, isDeckComplete, currentItem, onPassFlatmate]);

  const handleLike = useCallback(() => {
    if (swipeAction || isDeckComplete || !currentItem) return;
    setSwipeAction('right');
    if (currentItem.kind === 'solo') {
      const target = currentItem.candidate;
      onConnectFlatmate(target, false);
      swipeTimerRef.current = window.setTimeout(() => {
        setSwipeAction(null);
        setMatchedCandidate(target);
        setCurrentIndex((prev) => prev + 1);
      }, 240);
    } else {
      const targetGroup = currentItem.group;
      if (onGroupInterested) {
        Promise.resolve(onGroupInterested(targetGroup)).catch(() => {});
      }
      swipeTimerRef.current = window.setTimeout(() => {
        setSwipeAction(null);
        setMatchedGroup(targetGroup);
        setCurrentIndex((prev) => prev + 1);
      }, 240);
    }
  }, [swipeAction, isDeckComplete, currentItem, onConnectFlatmate, onGroupInterested]);

  const handleSuperLike = useCallback(() => {
    if (swipeAction || isDeckComplete || !currentItem) return;
    setSwipeAction('super');
    if (currentItem.kind === 'solo') {
      const target = currentItem.candidate;
      onConnectFlatmate(target, true);
      swipeTimerRef.current = window.setTimeout(() => {
        setSwipeAction(null);
        setMatchedCandidate(target);
        setCurrentIndex((prev) => prev + 1);
      }, 240);
    } else {
      const targetGroup = currentItem.group;
      if (onGroupInterested) {
        Promise.resolve(onGroupInterested(targetGroup)).catch(() => {});
      }
      swipeTimerRef.current = window.setTimeout(() => {
        setSwipeAction(null);
        setMatchedGroup(targetGroup);
        setCurrentIndex((prev) => prev + 1);
      }, 240);
    }
  }, [swipeAction, isDeckComplete, currentItem, onConnectFlatmate, onGroupInterested]);

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
    if (!currentItem || currentGallery.length <= 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const isRightHalf = clickX > rect.width / 2;

    if (isRightHalf) {
      setPhotoIndex((prev) => (prev + 1) % currentGallery.length);
    } else {
      setPhotoIndex((prev) => (prev - 1 + currentGallery.length) % currentGallery.length);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }
      if (showBioModal || matchedCandidate || matchedGroup) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePass();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleLike();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleSuperLike();
      } else if (e.key === ' ' && !isDeckComplete && currentItem) {
        e.preventDefault();
        setShowBioModal((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePass, handleLike, handleSuperLike, showBioModal, matchedCandidate, matchedGroup, isDeckComplete, currentItem]);

  return (
    <div className="w-full max-w-md mx-auto px-4 py-4 flex flex-col items-center select-none">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 z-50 bg-[#303030] border border-[#FFD43B] text-[#F5F5F5] px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-semibold transition-all duration-200">
          <Zap className="w-4 h-4 text-[#A855F7] fill-[#A855F7]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Filter Strip: Gender & Group Feed Toggle */}
      <div className="w-full flex flex-wrap items-center justify-between gap-2 mb-3 text-xs">
        <div className="flex items-center gap-1 p-1 bg-[#303030] rounded-xl border border-[#444444]">
          <span className="text-[#8e8e8e] px-1.5 flex items-center gap-1">
            <Filter className="w-3 h-3 text-[#FFD43B]" />
          </span>
          <button
            onClick={() => {
              onGenderFilterChange('male');
              setCurrentIndex(0);
            }}
            className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              genderFilter === 'male'
                ? 'bg-[#FFD43B] text-[#242424] shadow-sm'
                : 'text-[#B8B8B8] hover:text-[#F5F5F5]'
            }`}
          >
            👦 Boys
          </button>
          <button
            onClick={() => {
              onGenderFilterChange('female');
              setCurrentIndex(0);
            }}
            className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              genderFilter === 'female'
                ? 'bg-[#FFD43B] text-[#242424] shadow-sm'
                : 'text-[#B8B8B8] hover:text-[#F5F5F5]'
            }`}
          >
            👧 Girls
          </button>
          <button
            onClick={() => {
              onGenderFilterChange('all');
              setCurrentIndex(0);
            }}
            className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              genderFilter === 'all'
                ? 'bg-[#FFD43B] text-[#242424] shadow-sm'
                : 'text-[#B8B8B8] hover:text-[#F5F5F5]'
            }`}
          >
            All
          </button>
        </div>

        {/* Feed Mode: All / Solo / Duo Groups (+1) */}
        <div className="flex items-center gap-1 p-1 bg-[#303030] rounded-xl border border-[#444444]">
          <button
            onClick={() => {
              setDeckMode('all');
              setCurrentIndex(0);
            }}
            className={`px-2 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
              deckMode === 'all' ? 'bg-[#383838] text-[#FFD43B]' : 'text-[#8e8e8e]'
            }`}
          >
            Mix
          </button>
          <button
            onClick={() => {
              setDeckMode('groups');
              setCurrentIndex(0);
            }}
            className={`px-2 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer ${
              deckMode === 'groups'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-[#8e8e8e] hover:text-[#F5F5F5]'
            }`}
          >
            <Users className="w-3 h-3" />
            <span>Duo ({swappableGroups.length})</span>
          </button>
          {!isDeckComplete && currentItem && (
            <span className="text-[10px] font-mono text-[#8e8e8e] px-1.5">
              {currentIndex + 1}/{deckItems.length}
            </span>
          )}
        </div>
      </div>

      {/* MAIN TINDER-STYLE CARD */}
      {!isDeckComplete && currentItem ? (
        <div className="relative w-full">
          <div
            className={`relative w-full aspect-[3/4.3] rounded-3xl overflow-hidden shadow-2xl border ${
              currentGroup ? 'border-emerald-500/60' : 'border-[#484848]'
            } bg-[#303030] transition-all duration-200 transform ${
              swipeAction === 'left'
                ? '-translate-x-32 -rotate-12 opacity-0'
                : swipeAction === 'right'
                ? 'translate-x-32 rotate-12 opacity-0'
                : swipeAction === 'super'
                ? '-translate-y-32 scale-95 opacity-0'
                : 'translate-x-0 rotate-0 opacity-100'
            }`}
          >
            {swipeAction === 'left' && (
              <div className="absolute top-10 right-6 z-30 border-4 border-red-500 text-red-500 font-extrabold text-3xl px-4 py-1.5 rounded-xl rotate-12 tracking-wider bg-black/40 shadow-xl">
                NOPE
              </div>
            )}
            {swipeAction === 'right' && (
              <div className="absolute top-10 left-6 z-30 border-4 border-emerald-400 text-emerald-400 font-extrabold text-3xl px-4 py-1.5 rounded-xl -rotate-12 tracking-wider bg-black/40 shadow-xl">
                {currentGroup ? 'JOIN +1' : 'ROOMIE'}
              </div>
            )}
            {swipeAction === 'super' && (
              <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 border-4 border-blue-400 text-blue-400 font-extrabold text-3xl px-6 py-1.5 rounded-xl tracking-wider bg-black/50 shadow-xl">
                SUPER ROOMIE
              </div>
            )}

            {/* SOLO PROFILE CARD CONTENT */}
            {currentCandidate && (
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

                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-black/40 pointer-events-none" />

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

                {/* Top Badges: Flat Status + Match % */}
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
                          ? ` (${currentCandidate.flatPhotos.length})`
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
                    {currentCandidate.compatibilityScore || 88}% Match
                  </span>
                </div>

                {/* Expiry & Trust Indicator */}
                <div className="absolute top-16 left-3 right-3 flex items-center justify-between gap-2 z-10 pointer-events-none">
                  {currentCandidate.identityVerification?.identityVerified ? (
                    <span className="inline-flex items-center gap-1 bg-emerald-950/85 text-emerald-300 border border-emerald-500/50 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                      <ShieldCheck className="w-3 h-3" />
                      <span>AI + ID Verified</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 bg-black/60 text-[#B8B8B8] border border-white/15 text-[10px] font-medium px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3 text-[#FFD43B]" />
                      <span>Google Verified</span>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 bg-black/60 text-[#B8B8B8] border border-white/15 text-[10px] px-2 py-0.5 rounded-full">
                    <Clock className="w-3 h-3 text-[#FFD43B]" />
                    <span>{getListingExpiryStatus(currentCandidate.expiresAt).label}</span>
                  </span>
                </div>

                {/* Bottom Card Overlay */}
                <div className="absolute bottom-4 left-4 right-4 z-20 pointer-events-none">
                  <div className="flex items-end justify-between mb-1">
                    <div>
                      <h2 className="text-2xl sm:text-3xl font-extrabold text-[#F5F5F5] drop-shadow-md flex items-center gap-2">
                        <span>{currentCandidate.name}</span>
                        <span className="text-xl font-normal text-[#B8B8B8]">{currentCandidate.age}</span>
                        {currentCandidate.identityVerification?.identityVerified && (
                          <ShieldCheck className="w-5 h-5 text-emerald-400" />
                        )}
                      </h2>
                      <p className="text-xs sm:text-sm font-semibold text-[#FFD43B] flex items-center gap-1.5 mt-0.5">
                        <Briefcase className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{currentCandidate.profession}</span>
                      </p>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowBioModal(true);
                      }}
                      className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/40 flex items-center justify-center text-white pointer-events-auto cursor-pointer transition-transform hover:scale-110 active:scale-95 shadow-lg"
                      title="Open Full Profile & Cost Breakdown"
                    >
                      <Info className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs text-[#F5F5F5] mb-2">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#FFD43B]" />
                      <span>
                        {currentCandidate.city} ({currentCandidate.area})
                      </span>
                    </span>
                    <span className="font-extrabold text-[#FFD43B] bg-[#242424]/85 px-2 py-0.5 rounded">
                      {currentCandidate.budget}
                    </span>
                  </div>

                  {/* Personality Match Reasons */}
                  {currentCandidate.matchReasons && currentCandidate.matchReasons.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {currentCandidate.matchReasons.slice(0, 2).map((reason) => (
                        <span
                          key={reason}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFD43B]/20 text-[#FFD43B] border border-[#FFD43B]/35"
                        >
                          ✓ {reason}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Skills */}
                  <div className="mb-2">
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

                  <div className="grid grid-cols-2 gap-1.5 text-[11px] text-[#B8B8B8] bg-black/55 backdrop-blur-md p-2 rounded-xl border border-white/10">
                    <div className="flex items-center gap-1.5 truncate">
                      <Moon className="w-3.5 h-3.5 text-[#FFD43B] shrink-0" />
                      <span className="truncate">
                        {currentCandidate.lifestyle.sleepSchedule.split('(')[0]}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <Utensils className="w-3.5 h-3.5 text-[#FFD43B] shrink-0" />
                      <span className="truncate">{currentCandidate.lifestyle.kitchenDiet}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* DUO GROUP CARD CONTENT WHILE SWAPPING ("2 Connected People · Need +1") */}
            {currentGroup && (
              <div
                onClick={handlePhotoTap}
                className="relative w-full h-full cursor-pointer overflow-hidden bg-gradient-to-b from-[#2c3330] via-[#262626] to-[#1e1e1e]"
              >
                {currentGallery.length > 0 && (
                  <img
                    src={currentGallery[photoIndex] || currentGallery[0]}
                    alt={currentGroup.memberNames.join(' & ')}
                    className="w-full h-full object-cover object-center opacity-50"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-black/65 pointer-events-none" />

                {/* Top Duo Header Pill */}
                <div className="absolute top-6 left-3 right-3 flex items-center justify-between gap-2 z-10 pointer-events-none">
                  <span className="inline-flex items-center gap-1.5 bg-emerald-500 text-[#1c1c1c] text-[11px] font-extrabold px-3 py-1 rounded-full shadow-lg">
                    <Users className="w-3.5 h-3.5" />
                    <span>2 TOGETHER · NEED +1 FLATMATE</span>
                  </span>
                  <span className="bg-[#242424]/90 backdrop-blur-md text-[#FFD43B] font-extrabold text-xs px-2.5 py-1 rounded-full border border-[#484848] shrink-0">
                    {computeGroupCompatibility(currentUser, currentGroup)}% Fit
                  </span>
                </div>

                {/* Twin Avatars Centerpiece showing 2 Connected Users */}
                <div className="absolute inset-x-0 top-20 flex flex-col items-center justify-center px-4 z-10 pointer-events-none">
                  <div className="flex items-center justify-center -space-x-5 mb-3">
                    {currentGroup.memberPhotos.slice(0, 2).map((photo, idx) => (
                      <div
                        key={idx}
                        className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-emerald-400 overflow-hidden bg-[#242424] shadow-2xl"
                      >
                        <img
                          src={photo}
                          alt={currentGroup.memberNames[idx] || 'Member'}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-black/70 text-emerald-300 border border-emerald-500/40">
                    Connected Duo Looking for 3rd Member
                  </span>
                </div>

                {/* Bottom Info Overlay for Duo Group */}
                <div className="absolute bottom-4 left-4 right-4 z-20 pointer-events-none">
                  <div className="flex items-end justify-between mb-1">
                    <div>
                      <h2 className="text-2xl font-extrabold text-[#F5F5F5] drop-shadow-md">
                        {currentGroup.memberNames.join(' & ')}
                      </h2>
                      <p className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5 mt-0.5">
                        <Home className="w-3.5 h-3.5 shrink-0" />
                        <span>{currentGroup.bhkType}</span>
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowBioModal(true);
                      }}
                      className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/40 flex items-center justify-center text-white pointer-events-auto cursor-pointer transition-transform hover:scale-110 active:scale-95 shadow-lg"
                      title="Open Duo Details & Cost Breakdown"
                    >
                      <Info className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs text-[#F5F5F5] mb-2">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#FFD43B]" />
                      <span>
                        {currentGroup.city} ({currentGroup.area})
                      </span>
                    </span>
                    <span className="font-extrabold text-[#FFD43B] bg-[#242424]/90 px-2 py-0.5 rounded">
                      {currentGroup.budgetPerPerson} / person
                    </span>
                  </div>

                  <p className="text-xs text-[#B8B8B8] bg-black/55 backdrop-blur-md p-2.5 rounded-xl border border-white/10 line-clamp-2">
                    {currentGroup.vibeSummary} — {currentGroup.bio}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 5 ACTION BUTTONS */}
          <div className="flex items-center justify-center gap-3 sm:gap-4 mt-5">
            <button
              onClick={handleRewind}
              disabled={currentIndex === 0}
              className={`w-12 h-12 rounded-full bg-[#303030] border-2 border-amber-400 text-amber-400 flex items-center justify-center transition-all cursor-pointer shadow-lg ${
                currentIndex === 0
                  ? 'opacity-30 cursor-not-allowed'
                  : 'hover:scale-110 active:scale-95 hover:bg-amber-400/10'
              }`}
              title="Rewind previous"
              aria-label="Rewind"
            >
              <RotateCcw className="w-5 h-5 stroke-[2.2]" />
            </button>

            <button
              onClick={handlePass}
              className="w-16 h-16 rounded-full bg-[#303030] border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all duration-150 shadow-xl hover:scale-110 active:scale-95 cursor-pointer"
              title="Nope / Pass (Arrow Left)"
              aria-label="Nope"
            >
              <X className="w-8 h-8 stroke-[2.8]" />
            </button>

            <button
              onClick={handleSuperLike}
              className="w-13 h-13 rounded-full bg-[#303030] border-2 border-sky-400 text-sky-400 hover:bg-sky-400 hover:text-white flex items-center justify-center transition-all duration-150 shadow-lg hover:scale-110 active:scale-95 cursor-pointer"
              title="Super Roomie Connect (Arrow Up)"
              aria-label="Super Like"
            >
              <Star className="w-6 h-6 stroke-[2.5] fill-sky-400 hover:fill-white" />
            </button>

            <button
              onClick={handleLike}
              className="w-16 h-16 rounded-full bg-[#303030] border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-white flex items-center justify-center transition-all duration-150 shadow-xl hover:scale-110 active:scale-95 cursor-pointer"
              title={
                currentGroup
                  ? "I'm Interested in Joining Duo"
                  : "I'm Interested in This Profile (Arrow Right)"
              }
              aria-label="I'm Interested"
            >
              <Heart className="w-8 h-8 stroke-[2.8] fill-emerald-400 hover:fill-white" />
            </button>

            <button
              onClick={handleBoost}
              className={`w-12 h-12 rounded-full bg-[#303030] border-2 border-purple-500 text-purple-400 flex items-center justify-center transition-all cursor-pointer shadow-lg ${
                boostActive
                  ? 'bg-purple-500 text-white animate-pulse'
                  : 'hover:scale-110 active:scale-95 hover:bg-purple-500/10'
              }`}
              title="Boost Profile in Your Flat Location"
              aria-label="Boost"
            >
              <Zap className="w-5 h-5 stroke-[2.5] fill-purple-400" />
            </button>
          </div>

          <p className="text-[11px] text-center text-[#6e6e6e] mt-3">
            Tap photo sides to switch pics · Duo (+1) cards appear automatically while swapping
          </p>
        </div>
      ) : (
        <div className="w-full bg-[#303030] border border-[#484848] rounded-3xl p-8 text-center shadow-2xl my-6">
          <div className="w-16 h-16 rounded-2xl bg-[#FFD43B]/10 border border-[#FFD43B]/30 text-[#FFD43B] flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 stroke-[2.2]" />
          </div>
          <h3 className="text-xl font-bold text-[#F5F5F5] mb-2">
            No More {deckMode === 'groups' ? 'Duo Groups' : 'Profiles'} Right Now
          </h3>
          <p className="text-xs text-[#B8B8B8] max-w-xs mx-auto mb-6">
            You&apos;ve browsed all active listings in this filter. Expired or blocked listings are automatically hidden.
          </p>
          <div className="flex flex-col gap-2 max-w-xs mx-auto">
            <button
              onClick={() => {
                setDeckMode('all');
                setCurrentIndex(0);
              }}
              className="py-2.5 px-4 bg-[#FFD43B] hover:bg-[#ffe066] text-[#242424] font-bold text-xs rounded-xl shadow cursor-pointer"
            >
              Review Full Deck Again
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

      {/* SOLO PROFILE BIO, PERSONALITY, COST BREAKDOWN & SAFETY MODAL */}
      {showBioModal && currentCandidate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-[#303030] border border-[#484848] rounded-t-3xl sm:rounded-3xl max-h-[88vh] overflow-y-auto p-6 shadow-2xl text-[#F5F5F5]">
            <button
              onClick={() => setShowBioModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-[#383838] hover:bg-[#444444] text-[#B8B8B8] hover:text-[#F5F5F5] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-4 pr-10">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-2xl font-extrabold text-[#F5F5F5]">
                  {currentCandidate.name}, {currentCandidate.age}
                </h3>
                {currentCandidate.identityVerification?.identityVerified && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>ID Verified</span>
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-[#FFD43B]">{currentCandidate.profession}</p>
              <p className="text-xs text-[#B8B8B8] mt-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#FFD43B]" />
                <span>
                  {currentCandidate.city} · {currentCandidate.area}
                </span>
              </p>
            </div>

            {/* Compatibility Reasons */}
            {currentCandidate.matchReasons && currentCandidate.matchReasons.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-1.5">
                {currentCandidate.matchReasons.map((r) => (
                  <span
                    key={r}
                    className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#FFD43B]/15 text-[#FFD43B] border border-[#FFD43B]/30"
                  >
                    ✓ {r}
                  </span>
                ))}
              </div>
            )}

            {/* Complete Cost Breakdown */}
            <div className="mb-5">
              <CostBreakdownCard
                costBreakdown={currentCandidate.costBreakdown}
                fallbackBudget={currentCandidate.budget}
                hasFlat={currentCandidate.hasFlat}
              />
            </div>

            {/* Verified Real Flat Photos */}
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

            {/* Personality Traits */}
            <div className="mb-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#FFD43B] mb-2 flex items-center gap-1.5">
                <BrainCircuit className="w-3.5 h-3.5" />
                <span>Personality Profile</span>
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-[#242424] p-2.5 rounded-xl border border-[#3d3d3d]">
                  <span className="text-[10px] text-[#8e8e8e] block">Social Vibe</span>
                  <span className="text-[#F5F5F5] font-medium">
                    {(currentCandidate.personality || DEFAULT_PERSONALITY).vibe}
                  </span>
                </div>
                <div className="bg-[#242424] p-2.5 rounded-xl border border-[#3d3d3d]">
                  <span className="text-[10px] text-[#8e8e8e] block">Guest Policy</span>
                  <span className="text-[#F5F5F5] font-medium">
                    {(currentCandidate.personality || DEFAULT_PERSONALITY).guestPolicy}
                  </span>
                </div>
                <div className="bg-[#242424] p-2.5 rounded-xl border border-[#3d3d3d]">
                  <span className="text-[10px] text-[#8e8e8e] block">Noise Level</span>
                  <span className="text-[#F5F5F5] font-medium">
                    {(currentCandidate.personality || DEFAULT_PERSONALITY).noiseTolerance}
                  </span>
                </div>
                <div className="bg-[#242424] p-2.5 rounded-xl border border-[#3d3d3d]">
                  <span className="text-[10px] text-[#8e8e8e] block">Chore Style</span>
                  <span className="text-[#F5F5F5] font-medium">
                    {(currentCandidate.personality || DEFAULT_PERSONALITY).choreStyle}
                  </span>
                </div>
              </div>
            </div>

            <div className="mb-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#FFD43B] mb-2">
                About Me &amp; Living Style
              </h4>
              <p className="text-xs text-[#B8B8B8] leading-relaxed bg-[#242424] p-3.5 rounded-xl border border-[#3d3d3d]">
                &ldquo;{currentCandidate.bio}&rdquo;
              </p>
            </div>

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

            {/* Action Buttons */}
            <div className="flex items-center gap-3 mb-4">
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
                  <span>I&apos;m Interested</span>
                </button>
              )}
            </div>

            {/* Safety Report / Block */}
            {onReportOrBlock && (
              <div className="flex items-center justify-between pt-3 border-t border-[#3d3d3d] text-[11px] text-[#8e8e8e]">
                <button
                  type="button"
                  onClick={() => {
                    setShowBioModal(false);
                    onReportOrBlock(currentCandidate, 'report');
                  }}
                  className="inline-flex items-center gap-1 hover:text-amber-300 cursor-pointer"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>Report Suspicious Profile</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowBioModal(false);
                    onReportOrBlock(currentCandidate, 'block');
                  }}
                  className="inline-flex items-center gap-1 hover:text-red-400 cursor-pointer"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Block User</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* GROUP DETAILS MODAL */}
      {showBioModal && currentGroup && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-[#303030] border border-emerald-500/50 rounded-t-3xl sm:rounded-3xl max-h-[85vh] overflow-y-auto p-6 shadow-2xl text-[#F5F5F5]">
            <button
              onClick={() => setShowBioModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-[#383838] hover:bg-[#444444] text-[#B8B8B8] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-300 bg-emerald-500/15 border border-emerald-500/40 px-2.5 py-0.5 rounded-full mb-2">
              <Users className="w-3 h-3" />
              <span>Connected Duo · Open Spot +1</span>
            </span>
            <h3 className="text-2xl font-extrabold text-[#F5F5F5]">
              {currentGroup.memberNames.join(' & ')}
            </h3>
            <p className="text-xs text-[#FFD43B] font-semibold mt-0.5">{currentGroup.bhkType}</p>
            <p className="text-xs text-[#B8B8B8] mt-1 mb-4 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-[#FFD43B]" />
              <span>
                {currentGroup.city} · {currentGroup.area}
              </span>
            </p>

            <div className="mb-4">
              <CostBreakdownCard
                costBreakdown={currentGroup.costBreakdown}
                fallbackBudget={currentGroup.budgetPerPerson}
                hasFlat={currentGroup.hasFlat}
              />
            </div>

            <p className="text-xs text-[#B8B8B8] bg-[#242424] p-3.5 rounded-xl border border-[#3d3d3d] mb-5 leading-relaxed">
              &ldquo;{currentGroup.bio}&rdquo;
            </p>

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
              {interestedGroupIds.includes(currentGroup.groupId) && onOpenGroupChat ? (
                <button
                  onClick={() => {
                    setShowBioModal(false);
                    onOpenGroupChat(currentGroup);
                  }}
                  className="flex-1 py-3 bg-emerald-400 hover:bg-emerald-300 text-[#242424] font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Say Hello to Duo</span>
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
                  <span>I&apos;m Interested in Duo</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SOLO CHAT UNLOCKED CELEBRATION MODAL */}
      {matchedCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="relative w-full max-w-sm bg-[#303030] border border-[#FFD43B] rounded-3xl p-6 sm:p-8 text-center shadow-2xl text-[#F5F5F5]">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-1">
              Chat Unlocked
            </p>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-[#F5F5F5] mb-6">
              You&apos;re Interested!
            </h3>

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
              You marked interest in <span className="text-[#F5F5F5] font-bold">{matchedCandidate.name}</span>{' '}
              in <span className="text-[#FFD43B] font-semibold">{matchedCandidate.area}</span>. Click{' '}
              <span className="text-[#F5F5F5] font-semibold">Say Hello</span> below to open your private chat
              screen.
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

      {/* DUO GROUP INTERESTED CELEBRATION MODAL */}
      {matchedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="relative w-full max-w-sm bg-[#303030] border border-emerald-400 rounded-3xl p-6 sm:p-8 text-center shadow-2xl text-[#F5F5F5]">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-1">
              Group Chat Unlocked (+1)
            </p>
            <h3 className="text-2xl font-extrabold text-[#F5F5F5] mb-5">
              Say Hello to the Duo!
            </h3>

            <div className="flex items-center justify-center -space-x-3 mb-5">
              {matchedGroup.memberPhotos.slice(0, 2).map((p, idx) => (
                <div
                  key={idx}
                  className="w-16 h-16 rounded-full border-4 border-emerald-400 overflow-hidden bg-[#242424] shadow-xl"
                >
                  <img src={p} alt="Group member" className="w-full h-full object-cover" />
                </div>
              ))}
              {currentUser.photos?.[0] && (
                <div className="w-16 h-16 rounded-full border-4 border-[#FFD43B] overflow-hidden bg-[#242424] shadow-xl">
                  <img src={currentUser.photos[0]} alt={currentUser.name} className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            <p className="text-xs text-[#B8B8B8] leading-relaxed mb-6">
              <span className="text-[#F5F5F5] font-bold">{matchedGroup.memberNames.join(' & ')}</span> are
              looking for 1 more flatmate in{' '}
              <span className="text-[#FFD43B] font-semibold">{matchedGroup.area}</span>. Start a group chat
              now!
            </p>

            <div className="space-y-2.5">
              {onOpenGroupChat && (
                <button
                  onClick={() => {
                    const g = matchedGroup;
                    setMatchedGroup(null);
                    onOpenGroupChat(g);
                  }}
                  className="w-full py-3.5 px-4 bg-[#FFD43B] hover:bg-[#ffe066] text-[#242424] font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Say Hello in Group Chat</span>
                </button>
              )}
              <button
                onClick={() => setMatchedGroup(null)}
                className="w-full py-2.5 px-4 bg-[#383838] hover:bg-[#444444] text-[#B8B8B8] hover:text-[#F5F5F5] font-semibold text-xs rounded-xl cursor-pointer"
              >
                Keep Swapping
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
