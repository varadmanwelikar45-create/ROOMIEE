import React from 'react';
import { FlatmateCandidate } from '../types';
import { Star, Heart, MapPin, Briefcase, Home, Search, MessageSquare, Lock, ShieldCheck } from 'lucide-react';
import { CostBreakdownCard } from './CostBreakdownCard';

interface TopPicksViewProps {
  candidates: FlatmateCandidate[];
  matchedIds?: string[];
  onConnectFlatmate: (candidate: FlatmateCandidate, isSuper: boolean) => void;
  onSelectCandidate: (candidate: FlatmateCandidate) => void;
}

export const TopPicksView: React.FC<TopPicksViewProps> = ({
  candidates,
  matchedIds = [],
  onConnectFlatmate,
  onSelectCandidate,
}) => {
  // Sort by compatibility score
  const topPicks = [...candidates].sort((a, b) => (b.compatibilityScore || 0) - (a.compatibilityScore || 0));

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6">
      
      {/* Top Picks Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-[#383838]">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sky-400 mb-1">
            <Star className="w-3.5 h-3.5 fill-current" />
            <span>Top Compatibility Picks</span>
          </div>
          <h2 className="text-2xl font-extrabold text-[#F5F5F5]">
            Best Matched Flatmates Near You
          </h2>
          <p className="text-xs text-[#B8B8B8] mt-0.5">
            Updated daily based on your sleep routine, cooking preferences, and target flat location.
          </p>
        </div>
      </div>

      {/* Top Picks Container / Empty State */}
      {topPicks.length === 0 ? (
        <div className="w-full bg-[#303030] border border-[#444444] rounded-3xl p-10 text-center shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-[#FFD43B]/10 border border-[#FFD43B]/30 text-[#FFD43B] flex items-center justify-center mx-auto mb-4">
            <Star className="w-8 h-8 stroke-[2.2]" />
          </div>
          <h3 className="text-xl font-bold text-[#F5F5F5] mb-2">
            Waiting for Flatmates to Register
          </h3>
          <p className="text-xs text-[#B8B8B8] max-w-sm mx-auto">
            Only real users with uploaded photos appear in discovery. As other flatmates register their profiles with habits and locations, your top picks will appear here!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
        {topPicks.map((candidate) => {
          const isInterested = matchedIds.includes(candidate.id);
          return (
          <div
            key={candidate.id}
            onClick={() => {
              if (isInterested) {
                onSelectCandidate(candidate);
              }
            }}
            className={`group relative bg-[#303030] border rounded-3xl overflow-hidden shadow-xl transition-all duration-200 flex flex-col justify-between ${
              isInterested
                ? 'border-emerald-500/60 hover:border-emerald-400 hover:-translate-y-1 cursor-pointer'
                : 'border-[#444444] hover:border-[#FFD43B]/60'
            }`}
          >
            <div>
              {/* Photo Viewport */}
              <div className="relative aspect-[4/4.5] w-full bg-[#242424] overflow-hidden flex items-center justify-center">
                {candidate.photos && candidate.photos[0] ? (
                  <img
                    src={candidate.photos[0]}
                    alt={candidate.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-5xl font-extrabold text-[#FFD43B]">
                    {candidate.name.charAt(0).toUpperCase()}
                  </span>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/30" />

                {/* Match Score Badge */}
                <div className="absolute top-3 right-3 bg-[#FFD43B] text-[#242424] text-[11px] font-extrabold px-2.5 py-0.5 rounded-full shadow">
                  {candidate.compatibilityScore || 90}% Fit
                </div>

                {/* Has Flat / Needs Flat Badge */}
                <div className="absolute top-3 left-3">
                  {candidate.hasFlat === 'has_flat' ? (
                    <span className="text-[10px] font-bold bg-emerald-500/90 text-white px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow">
                      <Home className="w-3 h-3" />
                      <span>Has Flat</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold bg-amber-500/90 text-[#242424] px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow">
                      <Search className="w-3 h-3" />
                      <span>Needs Flat</span>
                    </span>
                  )}
                </div>

                {/* Overlay Name & Location */}
                <div className="absolute bottom-3 left-3 right-3 text-[#F5F5F5]">
                  <h3 className="text-xl font-bold flex items-center gap-1.5">
                    <span>{candidate.name}</span>
                    <span className="text-base font-normal text-[#B8B8B8]">{candidate.age}</span>
                    {candidate.identityVerification?.identityVerified && (
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    )}
                  </h3>
                  <p className="text-xs text-[#FFD43B] font-medium flex items-center gap-1 mt-0.5">
                    <Briefcase className="w-3 h-3" />
                    <span className="truncate">{candidate.profession}</span>
                  </p>
                  <p className="text-[11px] text-[#B8B8B8] flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-[#FFD43B]" />
                    <span className="truncate">{candidate.area} · {candidate.budget}</span>
                  </p>
                </div>
              </div>

              {/* Skills & Compatibility Reasons */}
              <div className="p-3.5 space-y-2">
                {candidate.matchReasons && candidate.matchReasons.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {candidate.matchReasons.slice(0, 2).map((reason) => (
                      <span
                        key={reason}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFD43B]/15 text-[#FFD43B] border border-[#FFD43B]/30"
                      >
                        ✓ {reason}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-1">
                  {candidate.skills.slice(0, 3).map((s) => (
                    <span key={s} className="text-[10px] px-2 py-0.5 rounded bg-[#383838] text-[#F5F5F5] border border-[#484848]">
                      {s}
                    </span>
                  ))}
                </div>

                <CostBreakdownCard
                  costBreakdown={candidate.costBreakdown}
                  fallbackBudget={candidate.budget}
                  hasFlat={candidate.hasFlat}
                  compact
                />

                <p className="text-[11px] text-[#B8B8B8] line-clamp-2 italic">
                  &ldquo;{candidate.bio}&rdquo;
                </p>
                {candidate.hasFlat === 'has_flat' &&
                  candidate.flatPhotos &&
                  candidate.flatPhotos.length > 0 && (
                    <div className="pt-1.5 space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-emerald-300 inline-flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          <span>Verified Flat Pics ({candidate.flatPhotos.length})</span>
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {candidate.flatPhotos.slice(0, 3).map((src, idx) => (
                          <div
                            key={idx}
                            className="aspect-[4/3] rounded-lg overflow-hidden border border-[#484848] bg-[#242424]"
                          >
                            <img
                              src={src}
                              alt={`${candidate.name} flat ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            </div>

            {/* Quick Connect Action Bar */}
            <div className="p-3 pt-0 flex flex-col gap-1.5">
              {isInterested ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectCandidate(candidate);
                  }}
                  className="w-full py-2.5 px-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Say Hello · Open Chat</span>
                </button>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onConnectFlatmate(candidate, false);
                      }}
                      className="flex-1 py-2.5 px-3 bg-[#FFD43B] hover:bg-[#ffe066] text-[#242424] font-bold text-xs rounded-xl transition-all shadow flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Heart className="w-3.5 h-3.5 fill-current" />
                      <span>I&apos;m Interested</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onConnectFlatmate(candidate, true);
                      }}
                      className="p-2.5 bg-[#383838] hover:bg-sky-500 hover:text-white text-sky-400 rounded-xl transition-colors cursor-pointer"
                      title="Super Interested"
                    >
                      <Star className="w-4 h-4 fill-current" />
                    </button>
                  </div>
                  <p className="text-[10px] text-[#8e8e8e] flex items-center justify-center gap-1 pt-0.5">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Click &ldquo;I&apos;m Interested&rdquo; to unlock Say Hello chat</span>
                  </p>
                </>
              )}
            </div>
          </div>
          );
        })}
        </div>
      )}

    </div>
  );
};
