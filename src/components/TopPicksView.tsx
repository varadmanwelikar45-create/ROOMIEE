import React from 'react';
import { FlatmateCandidate } from '../types';
import { Star, Heart, MapPin, Briefcase, MessageSquare, ShieldCheck } from 'lucide-react';
import { computeCostTotals, formatINR } from '../utils/compatibility';

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
  const topPicks = [...candidates].sort((a, b) => (b.compatibilityScore || 0) - (a.compatibilityScore || 0));

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between gap-3 mb-5 pb-3 border-b border-[#383838]">
        <h2 className="text-2xl font-extrabold text-[#F5F5F5]">Top Picks</h2>
        {topPicks.length > 0 && (
          <span className="text-xs text-[#8e8e8e] font-semibold">
            {topPicks.length} matches
          </span>
        )}
      </div>

      {topPicks.length === 0 ? (
        <div className="w-full bg-[#303030] border border-[#444444] rounded-3xl p-10 text-center">
          <Star className="w-8 h-8 text-[#FFD43B] mx-auto mb-3" />
          <h3 className="text-lg font-bold text-[#F5F5F5] mb-1">No Top Picks Yet</h3>
          <p className="text-xs text-[#B8B8B8] max-w-sm mx-auto">
            Compatible flatmates near your target area will show up here as they join.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {topPicks.map((candidate) => {
            const isInterested = matchedIds.includes(candidate.id);
            const costTotals = computeCostTotals(candidate.costBreakdown, candidate.budget);

            return (
              <div
                key={candidate.id}
                onClick={() => {
                  if (isInterested) onSelectCandidate(candidate);
                }}
                className={`group bg-[#303030] border rounded-3xl overflow-hidden shadow-lg transition-colors flex flex-col justify-between ${
                  isInterested
                    ? 'border-emerald-500/60 hover:border-emerald-400 cursor-pointer'
                    : 'border-[#444444] hover:border-[#FFD43B]/60'
                }`}
              >
                <div>
                  <div className="relative aspect-[4/3.8] w-full bg-[#242424] overflow-hidden flex items-center justify-center">
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

                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/35" />

                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-[11px] font-bold">
                      <span className="text-[#F5F5F5] drop-shadow">
                        {candidate.hasFlat === 'has_flat' ? 'Has Flat' : 'Needs Flat'}
                      </span>
                      <span className="text-[#FFD43B] drop-shadow">
                        {candidate.compatibilityScore || 90}% Match
                      </span>
                    </div>

                    <div className="absolute bottom-3 left-3.5 right-3.5 text-[#F5F5F5]">
                      <h3 className="text-xl font-bold flex items-center gap-1.5 truncate">
                        <span className="truncate">{candidate.name}</span>
                        <span className="text-base font-normal text-[#B8B8B8]">{candidate.age}</span>
                        {candidate.identityVerification?.identityVerified && (
                          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                        )}
                      </h3>
                      <p className="text-xs text-[#FFD43B] font-medium flex items-center gap-1 mt-0.5 truncate">
                        <Briefcase className="w-3 h-3 shrink-0" />
                        <span className="truncate">{candidate.profession}</span>
                      </p>
                      <p className="text-[11px] text-[#D0D0D0] flex items-center gap-1 mt-0.5 truncate">
                        <MapPin className="w-3 h-3 text-[#FFD43B] shrink-0" />
                        <span className="truncate">
                          {candidate.area}, {candidate.city} · {candidate.budget}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="p-4 space-y-2.5">
                    <p className="text-xs text-[#B8B8B8] line-clamp-2 leading-relaxed">
                      {candidate.bio}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-[#8e8e8e] pt-1 border-t border-[#3b3b3b]">
                      <span>{costTotals.bhkType}</span>
                      <span className="text-[#F5F5F5] font-semibold">
                        {formatINR(costTotals.totalMonthly)}/mo
                        {costTotals.brokerageFee === 0 ? ' · Zero Brokerage' : ''}
                      </span>
                    </div>

                    {candidate.hasFlat === 'has_flat' &&
                      candidate.flatPhotos &&
                      candidate.flatPhotos.length > 0 && (
                        <div className="grid grid-cols-3 gap-1.5 pt-1">
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
                      )}
                  </div>
                </div>

                <div className="p-4 pt-0">
                  {isInterested ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCandidate(candidate);
                      }}
                      className="w-full min-h-[44px] px-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>Open Chat</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onConnectFlatmate(candidate, false);
                        }}
                        className="flex-1 min-h-[44px] px-3 bg-[#FFD43B] hover:bg-[#ffe066] text-[#242424] font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Heart className="w-4 h-4 fill-current" />
                        <span>Connect</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onConnectFlatmate(candidate, true);
                        }}
                        className="min-h-[44px] px-3 bg-[#383838] hover:bg-sky-500 hover:text-white text-sky-400 rounded-xl transition-colors cursor-pointer"
                        title="Priority Connect"
                        aria-label={`Priority connect with ${candidate.name}`}
                      >
                        <Star className="w-4 h-4 fill-current" />
                      </button>
                    </div>
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
