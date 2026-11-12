import React from 'react';
import { FlatmateCandidate } from '../types';
import { Star, Heart, MapPin, Briefcase, Sparkles, Home, Search } from 'lucide-react';

interface TopPicksViewProps {
  candidates: FlatmateCandidate[];
  onConnectFlatmate: (candidate: FlatmateCandidate, isSuper: boolean) => void;
  onSelectCandidate: (candidate: FlatmateCandidate) => void;
}

export const TopPicksView: React.FC<TopPicksViewProps> = ({
  candidates,
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
            Handpicked Flatmates Near You
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
        {topPicks.map((candidate) => (
          <div
            key={candidate.id}
            onClick={() => onSelectCandidate(candidate)}
            className="group relative bg-[#303030] border border-[#444444] hover:border-[#FFD43B] rounded-3xl overflow-hidden shadow-xl transition-all duration-200 hover:-translate-y-1 cursor-pointer flex flex-col justify-between"
          >
            <div>
              {/* Photo Viewport */}
              <div className="relative aspect-[4/4.5] w-full bg-[#242424] overflow-hidden">
                <img
                  src={candidate.photos[0]}
                  alt={candidate.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />

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

              {/* Skills Snippet */}
              <div className="p-3.5 space-y-2">
                <div className="flex flex-wrap gap-1">
                  {candidate.skills.slice(0, 3).map((s) => (
                    <span key={s} className="text-[10px] px-2 py-0.5 rounded bg-[#383838] text-[#F5F5F5] border border-[#484848]">
                      {s}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-[#B8B8B8] line-clamp-2 italic">
                  &ldquo;{candidate.bio}&rdquo;
                </p>
              </div>
            </div>

            {/* Quick Connect Action Bar */}
            <div className="p-3 pt-0 flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onConnectFlatmate(candidate, false);
                }}
                className="flex-1 py-2 px-3 bg-[#FFD43B] hover:bg-[#ffe066] text-[#242424] font-bold text-xs rounded-xl transition-all shadow flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Heart className="w-3.5 h-3.5 fill-current" />
                <span>Connect</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onConnectFlatmate(candidate, true);
                }}
                className="p-2 bg-[#383838] hover:bg-sky-500 hover:text-white text-sky-400 rounded-xl transition-colors cursor-pointer"
                title="Super Roomie"
              >
                <Star className="w-4 h-4 fill-current" />
              </button>
            </div>
          </div>
        ))}
        </div>
      )}

    </div>
  );
};
