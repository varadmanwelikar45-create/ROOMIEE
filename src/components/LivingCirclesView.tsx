import React, { useMemo, useState } from 'react';
import {
  Ban,
  BrainCircuit,
  Briefcase,
  Check,
  ChevronLeft,
  ChevronRight,
  Flag,
  Heart,
  Home,
  Info,
  MapPin,
  MessageSquare,
  Plus,
  ShieldCheck,
  Star,
  X,
} from 'lucide-react';
import {
  FlatmateCandidate,
  LivingCircleId,
  UserProfile,
} from '../types';
import {
  DEFAULT_PERSONALITY,
  computeCostTotals,
  formatINR,
} from '../utils/compatibility';
import {
  LIVING_CIRCLES,
  getEffectiveLivingCircles,
  getLivingCircleMeta,
} from '../utils/livingCircles';
import { CostBreakdownCard } from './CostBreakdownCard';

interface LivingCirclesViewProps {
  candidates: FlatmateCandidate[];
  currentUser: UserProfile;
  matchedIds?: string[];
  onToggleCircle: (circleId: LivingCircleId) => Promise<void> | void;
  onConnectFlatmate: (candidate: FlatmateCandidate, isSuper: boolean) => void;
  onOpenChatWith: (candidate: FlatmateCandidate) => void;
  onReportOrBlock?: (candidate: FlatmateCandidate, mode: 'report' | 'block') => void;
  genderFilter: 'male' | 'female' | 'all';
  onGenderFilterChange: (filter: 'male' | 'female' | 'all') => void;
}

type RequirementFilter = 'all' | 'similar' | 'has_flat' | 'needs_flat';

export const LivingCirclesView: React.FC<LivingCirclesViewProps> = ({
  candidates,
  currentUser,
  matchedIds = [],
  onToggleCircle,
  onConnectFlatmate,
  onOpenChatWith,
  onReportOrBlock,
  genderFilter,
  onGenderFilterChange,
}) => {
  const myJoinedCircles = useMemo(
    () => getEffectiveLivingCircles(currentUser),
    [currentUser]
  );

  const [activeCircleId, setActiveCircleId] = useState<LivingCircleId>(
    myJoinedCircles[0] || 'it_professionals'
  );
  const [requirementFilter, setRequirementFilter] = useState<RequirementFilter>('all');
  const [cityScope, setCityScope] = useState<'all' | 'my_city'>('all');
  const [togglingCircleId, setTogglingCircleId] = useState<LivingCircleId | null>(null);
  const [detailCandidate, setDetailCandidate] = useState<FlatmateCandidate | null>(null);
  const [justConnectedCandidate, setJustConnectedCandidate] =
    useState<FlatmateCandidate | null>(null);
  const [cardPhotoIndexes, setCardPhotoIndexes] = useState<Record<string, number>>({});
  const [circleToast, setCircleToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setCircleToast(msg);
    window.setTimeout(() => {
      setCircleToast((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  const genderFilteredCandidates = useMemo(
    () =>
      candidates.filter((c) => {
        if (genderFilter === 'all') return true;
        return c.gender === genderFilter;
      }),
    [candidates, genderFilter]
  );

  const circleCounts = useMemo(() => {
    const counts: Record<LivingCircleId, number> = {
      college_students: 0,
      it_professionals: 0,
      budget_living: 0,
      peaceful_living: 0,
    };
    for (const c of genderFilteredCandidates) {
      const circles = getEffectiveLivingCircles(c);
      for (const id of circles) {
        counts[id] += 1;
      }
    }
    return counts;
  }, [genderFilteredCandidates]);

  const activeCircleMembers = useMemo(() => {
    const myCity = currentUser.flatLocation.city.toLowerCase();
    const myRent = computeCostTotals(
      currentUser.costBreakdown,
      currentUser.budget
    ).monthlyRent;

    return genderFilteredCandidates
      .filter((c) => {
        const circles = getEffectiveLivingCircles(c);
        if (!circles.includes(activeCircleId)) return false;

        if (cityScope === 'my_city' && c.city.toLowerCase() !== myCity) {
          return false;
        }

        if (requirementFilter === 'has_flat' && c.hasFlat !== 'has_flat') {
          return false;
        }
        if (requirementFilter === 'needs_flat' && c.hasFlat !== 'needs_flat') {
          return false;
        }
        if (requirementFilter === 'similar') {
          const candRent = computeCostTotals(c.costBreakdown, c.budget).monthlyRent;
          const complementaryOrSameCity =
            c.hasFlat !== currentUser.hasFlat || c.city.toLowerCase() === myCity;
          const closeBudget = Math.abs(myRent - candRent) <= 7000;
          const highFit = (c.compatibilityScore || 0) >= 74;
          return (complementaryOrSameCity && closeBudget) || highFit;
        }

        return true;
      })
      .sort((a, b) => {
        const aCity = a.city.toLowerCase() === myCity ? 1 : 0;
        const bCity = b.city.toLowerCase() === myCity ? 1 : 0;
        if (aCity !== bCity) return bCity - aCity;
        return (b.compatibilityScore || 0) - (a.compatibilityScore || 0);
      });
  }, [
    genderFilteredCandidates,
    activeCircleId,
    cityScope,
    requirementFilter,
    currentUser,
  ]);

  const activeCircle = getLivingCircleMeta(activeCircleId);

  const handleToggleMembership = async (
    e: React.MouseEvent,
    circleId: LivingCircleId
  ) => {
    e.stopPropagation();
    if (togglingCircleId) return;

    const alreadyJoined = myJoinedCircles.includes(circleId);
    if (alreadyJoined && myJoinedCircles.length <= 1) {
      showToast('Keep at least 1 Living Circle active.');
      return;
    }

    setTogglingCircleId(circleId);
    try {
      await onToggleCircle(circleId);
      const meta = getLivingCircleMeta(circleId);
      showToast(
        alreadyJoined
          ? `Left ${meta.name}.`
          : `Joined ${meta.name}.`
      );
    } catch {
      showToast('Could not update circle membership.');
    } finally {
      setTogglingCircleId(null);
    }
  };

  const handleConnect = (candidate: FlatmateCandidate, isSuper: boolean) => {
    onConnectFlatmate(candidate, isSuper);
    setJustConnectedCandidate(candidate);
  };

  const stepCardPhoto = (
    e: React.MouseEvent,
    candidateId: string,
    totalPhotos: number,
    delta: number
  ) => {
    e.stopPropagation();
    if (totalPhotos <= 1) return;
    setCardPhotoIndexes((prev) => {
      const current = prev[candidateId] || 0;
      const next = (current + delta + totalPhotos) % totalPhotos;
      return { ...prev, [candidateId]: next };
    });
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {circleToast && (
        <div className="fixed top-28 left-1/2 -translate-x-1/2 z-50 bg-[#303030] border border-[#FFD43B] text-[#F5F5F5] px-4 py-2 rounded-xl shadow-2xl text-xs font-semibold">
          {circleToast}
        </div>
      )}

      {/* HEADER */}
      <div className="flex items-end justify-between gap-4 pb-3 border-b border-[#383838]">
        <div>
          <h1 className="text-2xl font-extrabold text-[#F5F5F5] tracking-tight">
            Living Circles
          </h1>
          <p className="text-xs text-[#B8B8B8] mt-0.5">
            Discover flatmates with matching living preferences inside each circle.
          </p>
        </div>
        <span className="text-xs text-[#8e8e8e] font-semibold shrink-0">
          {activeCircleMembers.length} in {activeCircle.name}
        </span>
      </div>

      {/* 4 LIVING CIRCLES */}
      <section aria-label="Living Circles">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {LIVING_CIRCLES.map((circle) => {
            const isSelected = circle.id === activeCircleId;
            const isJoined = myJoinedCircles.includes(circle.id);
            const memberCount = circleCounts[circle.id];
            const isBusy = togglingCircleId === circle.id;

            return (
              <div
                key={circle.id}
                onClick={() => setActiveCircleId(circle.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setActiveCircleId(circle.id);
                  }
                }}
                className={`rounded-2xl p-3.5 border transition-colors cursor-pointer flex flex-col justify-between gap-2.5 ${
                  isSelected
                    ? 'bg-[#323232] border-[#FFD43B]'
                    : 'bg-[#2c2c2c] border-[#404040] hover:border-[#606060]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-2xl leading-none shrink-0" aria-hidden="true">
                      {circle.emoji}
                    </span>
                    <div className="min-w-0">
                      <h2
                        className={`text-sm font-extrabold truncate ${
                          isSelected ? 'text-[#FFD43B]' : 'text-[#F5F5F5]'
                        }`}
                      >
                        {circle.name}
                      </h2>
                      <p className="text-[11px] text-[#8e8e8e]">
                        {memberCount} {memberCount === 1 ? 'member' : 'members'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={(e) => handleToggleMembership(e, circle.id)}
                    className={`px-2.5 py-1 min-h-[32px] rounded-xl text-[11px] font-bold inline-flex items-center gap-1 shrink-0 transition-colors cursor-pointer disabled:opacity-60 ${
                      isJoined
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                        : 'bg-[#3a3a3a] text-[#F5F5F5] border border-[#525252] hover:border-[#FFD43B] hover:text-[#FFD43B]'
                    }`}
                  >
                    {isJoined ? (
                      <>
                        <Check className="w-3 h-3" />
                        <span>Joined</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3 h-3" />
                        <span>Join</span>
                      </>
                    )}
                  </button>
                </div>

                <p className="text-xs text-[#B8B8B8] leading-snug line-clamp-1">
                  {circle.tagline}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* FILTER BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'similar', label: 'Similar to Me' },
              { id: 'has_flat', label: 'Has Flat' },
              { id: 'needs_flat', label: 'Needs Flat' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setRequirementFilter(opt.id)}
              className={`px-3 min-h-[38px] rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                requirementFilter === opt.id
                  ? 'bg-[#FFD43B] text-[#242424]'
                  : 'bg-[#2c2c2c] text-[#B8B8B8] border border-[#3e3e3e] hover:text-[#F5F5F5]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-[#2c2c2c] rounded-xl border border-[#3e3e3e]">
            <button
              type="button"
              onClick={() => setCityScope('all')}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${
                cityScope === 'all'
                  ? 'bg-[#383838] text-[#FFD43B]'
                  : 'text-[#8e8e8e] hover:text-[#F5F5F5]'
              }`}
            >
              All Cities
            </button>
            <button
              type="button"
              onClick={() => setCityScope('my_city')}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${
                cityScope === 'my_city'
                  ? 'bg-[#383838] text-[#FFD43B]'
                  : 'text-[#8e8e8e] hover:text-[#F5F5F5]'
              }`}
            >
              {currentUser.flatLocation.city}
            </button>
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#2c2c2c] rounded-xl border border-[#3e3e3e]">
            <button
              type="button"
              onClick={() => onGenderFilterChange('male')}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${
                genderFilter === 'male'
                  ? 'bg-[#FFD43B] text-[#242424]'
                  : 'text-[#B8B8B8] hover:text-[#F5F5F5]'
              }`}
            >
              Boys
            </button>
            <button
              type="button"
              onClick={() => onGenderFilterChange('female')}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${
                genderFilter === 'female'
                  ? 'bg-[#FFD43B] text-[#242424]'
                  : 'text-[#B8B8B8] hover:text-[#F5F5F5]'
              }`}
            >
              Girls
            </button>
            <button
              type="button"
              onClick={() => onGenderFilterChange('all')}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${
                genderFilter === 'all'
                  ? 'bg-[#FFD43B] text-[#242424]'
                  : 'text-[#B8B8B8] hover:text-[#F5F5F5]'
              }`}
            >
              All
            </button>
          </div>
        </div>
      </div>

      {/* CIRCLE MEMBERS GRID */}
      {activeCircleMembers.length === 0 ? (
        <div className="bg-[#303030] border border-[#444444] rounded-3xl p-10 text-center">
          <div className="text-4xl mb-3" aria-hidden="true">
            {activeCircle.emoji}
          </div>
          <h3 className="text-lg font-bold text-[#F5F5F5] mb-1">
            No Members Match This Filter
          </h3>
          <p className="text-xs text-[#B8B8B8] max-w-sm mx-auto mb-4">
            Try resetting filters or switching to another Living Circle above.
          </p>
          <button
            type="button"
            onClick={() => {
              setRequirementFilter('all');
              setCityScope('all');
              onGenderFilterChange('all');
            }}
            className="px-4 py-2.5 bg-[#FFD43B] hover:bg-[#ffe066] text-[#242424] font-bold text-xs rounded-xl cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {activeCircleMembers.map((candidate) => {
            const isConnected = matchedIds.includes(candidate.id);
            const gallery = [
              ...(candidate.photos || []),
              ...(candidate.hasFlat === 'has_flat' ? candidate.flatPhotos || [] : []),
            ];
            const photoIdx =
              gallery.length > 0 ? (cardPhotoIndexes[candidate.id] || 0) % gallery.length : 0;
            const profilePhotoCount = candidate.photos?.length || 0;
            const viewingFlatPhoto =
              gallery.length > 0 && photoIdx >= profilePhotoCount;
            const costTotals = computeCostTotals(
              candidate.costBreakdown,
              candidate.budget
            );

            return (
              <article
                key={candidate.id}
                className={`bg-[#303030] border rounded-3xl overflow-hidden shadow-lg flex flex-col justify-between transition-colors ${
                  isConnected
                    ? 'border-emerald-500/60'
                    : 'border-[#444444] hover:border-[#FFD43B]/65'
                }`}
              >
                <div>
                  <div
                    onClick={() => setDetailCandidate(candidate)}
                    className="relative aspect-[4/3.6] w-full bg-[#242424] overflow-hidden cursor-pointer group"
                  >
                    {gallery.length > 0 ? (
                      <img
                        src={gallery[photoIdx]}
                        alt={
                          viewingFlatPhoto
                            ? `${candidate.name}'s flat`
                            : candidate.name
                        }
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-5xl font-extrabold text-[#FFD43B]">
                        {candidate.name.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/35 pointer-events-none" />

                    {gallery.length > 1 && (
                      <>
                        <div className="absolute top-2.5 left-3 right-3 flex items-center gap-1 z-10 pointer-events-none">
                          {gallery.map((_, idx) => (
                            <span
                              key={idx}
                              className={`h-1 flex-1 rounded-full ${
                                idx === photoIdx ? 'bg-white' : 'bg-white/35'
                              }`}
                            />
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={(e) =>
                            stepCardPhoto(e, candidate.id, gallery.length, -1)
                          }
                          aria-label="Previous photo"
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/55 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer z-10"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) =>
                            stepCardPhoto(e, candidate.id, gallery.length, 1)
                          }
                          aria-label="Next photo"
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/55 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer z-10"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    <div className="absolute top-5 left-3 right-3 flex items-center justify-between gap-2 text-[11px] font-bold pointer-events-none">
                      <span className="text-[#F5F5F5] drop-shadow truncate">
                        {viewingFlatPhoto
                          ? `Flat Photo · ${candidate.area}`
                          : candidate.hasFlat === 'has_flat'
                          ? 'Has Flat'
                          : 'Needs Flat'}
                      </span>
                      <span className="text-[#FFD43B] drop-shadow shrink-0">
                        {candidate.compatibilityScore || 88}% Match
                      </span>
                    </div>

                    <div className="absolute bottom-3 left-3.5 right-3.5 flex items-end justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-xl font-extrabold text-[#F5F5F5] flex items-center gap-1.5 truncate">
                          <span className="truncate">{candidate.name}</span>
                          <span className="text-base font-normal text-[#B8B8B8]">
                            {candidate.age}
                          </span>
                          {candidate.identityVerification?.identityVerified && (
                            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                          )}
                        </h3>
                        <p className="text-xs text-[#FFD43B] font-semibold flex items-center gap-1 truncate">
                          <Briefcase className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{candidate.profession}</span>
                        </p>
                        <p className="text-[11px] text-[#D0D0D0] flex items-center gap-1 mt-0.5 truncate">
                          <MapPin className="w-3 h-3 text-[#FFD43B] shrink-0" />
                          <span className="truncate">
                            {candidate.area}, {candidate.city} · {candidate.budget}
                          </span>
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailCandidate(candidate);
                        }}
                        className="w-9 h-9 rounded-full bg-black/55 hover:bg-black/80 border border-white/25 text-white flex items-center justify-center shrink-0 cursor-pointer"
                        title="Profile Details"
                        aria-label={`View details for ${candidate.name}`}
                      >
                        <Info className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* CONCISE CARD BODY */}
                  <div className="p-4 space-y-2">
                    <p className="text-[11px] text-[#D0D0D0] font-medium truncate">
                      {candidate.lifestyle.sleepSchedule.split('(')[0].trim()} · {candidate.lifestyle.kitchenDiet} · {costTotals.bhkType}
                    </p>
                    <p className="text-xs text-[#B8B8B8] line-clamp-2 leading-relaxed">
                      {candidate.bio}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-[#8e8e8e] pt-1 border-t border-[#3b3b3b]">
                      <span>Est. Monthly</span>
                      <span className="font-bold text-[#F5F5F5]">
                        {formatINR(costTotals.totalMonthly)}/mo
                      </span>
                    </div>
                  </div>
                </div>

                {/* ACTION FOOTER */}
                <div className="p-4 pt-0 flex items-center gap-2">
                  {isConnected ? (
                    <button
                      type="button"
                      onClick={() => onOpenChatWith(candidate)}
                      className="flex-1 min-h-[44px] px-4 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>Open Chat</span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleConnect(candidate, false)}
                        className="flex-1 min-h-[44px] px-4 bg-[#FFD43B] hover:bg-[#ffe066] text-[#242424] font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Heart className="w-4 h-4 fill-current" />
                        <span>Connect &amp; Chat</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleConnect(candidate, true)}
                        className="min-h-[44px] px-3 bg-[#383838] hover:bg-sky-500 hover:text-white text-sky-400 border border-[#484848] rounded-xl flex items-center justify-center cursor-pointer transition-colors"
                        title="Priority Connect"
                        aria-label={`Priority connect with ${candidate.name}`}
                      >
                        <Star className="w-4 h-4 fill-current" />
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* FULL PROFILE & COST BREAKDOWN MODAL */}
      {detailCandidate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-[#303030] border border-[#484848] rounded-t-3xl sm:rounded-3xl max-h-[88vh] overflow-y-auto p-6 shadow-2xl text-[#F5F5F5]">
            <button
              type="button"
              onClick={() => setDetailCandidate(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-[#383838] hover:bg-[#444444] text-[#B8B8B8] hover:text-[#F5F5F5] cursor-pointer"
              aria-label="Close profile details"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-4 pr-10">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-2xl font-extrabold text-[#F5F5F5]">
                  {detailCandidate.name}, {detailCandidate.age}
                </h3>
                {detailCandidate.identityVerification?.identityVerified && (
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                )}
              </div>
              <p className="text-xs font-semibold text-[#FFD43B]">{detailCandidate.profession}</p>
              <p className="text-xs text-[#B8B8B8] mt-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#FFD43B]" />
                <span>
                  {detailCandidate.area}, {detailCandidate.city}
                </span>
              </p>
              <p className="text-xs text-[#B8B8B8] mt-1">
                {getEffectiveLivingCircles(detailCandidate)
                  .map((cid) => {
                    const meta = getLivingCircleMeta(cid);
                    return `${meta.emoji} ${meta.name}`;
                  })
                  .join(' · ')}
              </p>
            </div>

            <div className="mb-5">
              <CostBreakdownCard
                costBreakdown={detailCandidate.costBreakdown}
                fallbackBudget={detailCandidate.budget}
                hasFlat={detailCandidate.hasFlat}
              />
            </div>

            {detailCandidate.hasFlat === 'has_flat' &&
              detailCandidate.flatPhotos &&
              detailCandidate.flatPhotos.length > 0 && (
                <div className="mb-5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#FFD43B] mb-2 flex items-center gap-1.5">
                    <Home className="w-3.5 h-3.5" />
                    <span>Flat Photos</span>
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    {detailCandidate.flatPhotos.map((src, idx) => (
                      <div
                        key={idx}
                        className="aspect-[4/3] rounded-xl overflow-hidden border border-[#484848] bg-[#242424]"
                      >
                        <img
                          src={src}
                          alt={`${detailCandidate.name} flat ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

            <div className="mb-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#FFD43B] mb-2 flex items-center gap-1.5">
                <BrainCircuit className="w-3.5 h-3.5" />
                <span>Living Preferences</span>
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-[#242424] p-2.5 rounded-xl border border-[#3d3d3d]">
                  <span className="text-[10px] text-[#8e8e8e] block">Social Vibe</span>
                  <span className="text-[#F5F5F5] font-medium">
                    {(detailCandidate.personality || DEFAULT_PERSONALITY).vibe}
                  </span>
                </div>
                <div className="bg-[#242424] p-2.5 rounded-xl border border-[#3d3d3d]">
                  <span className="text-[10px] text-[#8e8e8e] block">Guest Policy</span>
                  <span className="text-[#F5F5F5] font-medium">
                    {(detailCandidate.personality || DEFAULT_PERSONALITY).guestPolicy}
                  </span>
                </div>
                <div className="bg-[#242424] p-2.5 rounded-xl border border-[#3d3d3d]">
                  <span className="text-[10px] text-[#8e8e8e] block">Noise Level</span>
                  <span className="text-[#F5F5F5] font-medium">
                    {(detailCandidate.personality || DEFAULT_PERSONALITY).noiseTolerance}
                  </span>
                </div>
                <div className="bg-[#242424] p-2.5 rounded-xl border border-[#3d3d3d]">
                  <span className="text-[10px] text-[#8e8e8e] block">Chore Style</span>
                  <span className="text-[#F5F5F5] font-medium">
                    {(detailCandidate.personality || DEFAULT_PERSONALITY).choreStyle}
                  </span>
                </div>
              </div>
            </div>

            <div className="mb-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#FFD43B] mb-2">
                About
              </h4>
              <p className="text-xs text-[#B8B8B8] leading-relaxed">
                {detailCandidate.bio}
              </p>
            </div>

            <div className="flex items-center gap-3 mb-4">
              {matchedIds.includes(detailCandidate.id) ? (
                <button
                  type="button"
                  onClick={() => {
                    const target = detailCandidate;
                    setDetailCandidate(null);
                    onOpenChatWith(target);
                  }}
                  className="flex-1 min-h-[44px] bg-emerald-400 hover:bg-emerald-300 text-[#242424] font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Open Chat</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const target = detailCandidate;
                    setDetailCandidate(null);
                    handleConnect(target, false);
                  }}
                  className="flex-1 min-h-[44px] bg-[#FFD43B] hover:bg-[#ffe066] text-[#242424] font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Heart className="w-4 h-4 fill-current" />
                  <span>Connect &amp; Chat</span>
                </button>
              )}
            </div>

            {onReportOrBlock && (
              <div className="flex items-center justify-between pt-3 border-t border-[#3d3d3d] text-[11px] text-[#8e8e8e]">
                <button
                  type="button"
                  onClick={() => {
                    const target = detailCandidate;
                    setDetailCandidate(null);
                    onReportOrBlock(target, 'report');
                  }}
                  className="inline-flex items-center gap-1 hover:text-amber-300 cursor-pointer"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>Report</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = detailCandidate;
                    setDetailCandidate(null);
                    onReportOrBlock(target, 'block');
                  }}
                  className="inline-flex items-center gap-1 hover:text-red-400 cursor-pointer"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Block</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONNECTION UNLOCKED MODAL */}
      {justConnectedCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#303030] border border-[#FFD43B] rounded-3xl p-6 text-center shadow-2xl space-y-4">
            <div className="flex items-center justify-center -space-x-3">
              <div className="w-16 h-16 rounded-full border-2 border-[#FFD43B] overflow-hidden bg-[#242424]">
                {currentUser.photos?.[0] && (
                  <img
                    src={currentUser.photos[0]}
                    alt={currentUser.name}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="w-16 h-16 rounded-full border-2 border-emerald-400 overflow-hidden bg-[#242424]">
                {justConnectedCandidate.photos?.[0] && (
                  <img
                    src={justConnectedCandidate.photos[0]}
                    alt={justConnectedCandidate.name}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            </div>

            <div>
              <h3 className="text-xl font-extrabold text-[#F5F5F5]">
                Connected with {justConnectedCandidate.name}
              </h3>
              <p className="text-xs text-[#B8B8B8] mt-1">
                You can now message each other directly.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setJustConnectedCandidate(null)}
                className="flex-1 min-h-[42px] bg-[#383838] hover:bg-[#444444] text-[#F5F5F5] text-xs font-semibold rounded-xl cursor-pointer"
              >
                Keep Browsing
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = justConnectedCandidate;
                  setJustConnectedCandidate(null);
                  onOpenChatWith(target);
                }}
                className="flex-1 min-h-[42px] bg-[#FFD43B] hover:bg-[#ffe066] text-[#242424] text-xs font-extrabold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Say Hello</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
