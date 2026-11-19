import React from 'react';
import { Compass, Star, MessageSquare, User, LogOut, Home, Search, Mail, Users, ShieldCheck } from 'lucide-react';
import { UserProfile } from '../types';

export type AppTab = 'discover' | 'top_picks' | 'groups' | 'matches' | 'gmail' | 'profile';

interface AppHeaderProps {
  currentUser: UserProfile;
  currentTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  matchesCount: number;
  groupsCount?: number;
  onSignOut: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  currentUser,
  currentTab,
  onTabChange,
  matchesCount,
  groupsCount = 0,
  onSignOut,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-[#242424]/95 backdrop-blur-md border-b border-[#383838]">
      <div className="max-w-md sm:max-w-2xl lg:max-w-6xl mx-auto px-4">
        
        {/* Top Strip: Brand & Flat Location */}
        <div className="flex items-center justify-between pt-3 pb-2 border-b border-[#333333]">
          <div className="flex items-center gap-2">
            <span className="text-xl font-extrabold tracking-tight text-[#F5F5F5]">
              ROOMIE<span className="text-[#FFD43B]">.</span>
            </span>
            {currentUser.identityVerification?.identityVerified && (
              <ShieldCheck
                className="w-4 h-4 text-emerald-400"
                aria-label="Verified Account"
              />
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-[#B8B8B8] max-w-[200px] truncate">
              {currentUser.hasFlat === 'has_flat' ? (
                <Home className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <Search className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              )}
              <span className="truncate">
                <span className="text-[#F5F5F5] font-semibold">{currentUser.flatLocation.area}</span>
              </span>
            </div>

            <button
              onClick={onSignOut}
              className="p-2 rounded-xl text-[#8e8e8e] hover:text-red-400 hover:bg-[#303030] transition-colors cursor-pointer"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Bar */}
        <div className="flex items-center justify-around py-2">
          <button
            onClick={() => onTabChange('discover')}
            className={`px-3 py-2 rounded-xl transition-colors flex flex-col items-center gap-1 cursor-pointer ${
              currentTab === 'discover'
                ? 'text-[#FFD43B] bg-[#303030]'
                : 'text-[#8e8e8e] hover:text-[#F5F5F5]'
            }`}
            title="Living Circles"
          >
            <Compass className="w-5 h-5 stroke-[2.2]" />
            <span className="text-[10px] font-bold">Circles</span>
          </button>

          <button
            onClick={() => onTabChange('top_picks')}
            className={`px-3 py-2 rounded-xl transition-colors flex flex-col items-center gap-1 cursor-pointer ${
              currentTab === 'top_picks'
                ? 'text-[#FFD43B] bg-[#303030]'
                : 'text-[#8e8e8e] hover:text-[#F5F5F5]'
            }`}
            title="Top Picks"
          >
            <Star className="w-5 h-5 stroke-[2.2]" />
            <span className="text-[10px] font-bold">Top Picks</span>
          </button>

          <button
            onClick={() => onTabChange('groups')}
            className={`px-3 py-2 rounded-xl transition-colors flex flex-col items-center gap-1 cursor-pointer relative ${
              currentTab === 'groups'
                ? 'text-[#FFD43B] bg-[#303030]'
                : 'text-[#8e8e8e] hover:text-[#F5F5F5]'
            }`}
            title="Duo Groups"
          >
            <Users className="w-5 h-5 stroke-[2.2]" />
            <span className="text-[10px] font-bold">Groups</span>
            {groupsCount > 0 && (
              <span className="absolute top-1 right-1.5 text-[9px] font-bold bg-emerald-400 text-[#1c1c1c] px-1.5 py-0.5 rounded-full leading-none">
                {groupsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onTabChange('matches')}
            className={`px-3 py-2 rounded-xl transition-colors flex flex-col items-center gap-1 cursor-pointer relative ${
              currentTab === 'matches'
                ? 'text-[#FFD43B] bg-[#303030]'
                : 'text-[#8e8e8e] hover:text-[#F5F5F5]'
            }`}
            title="Matches & Messages"
          >
            <MessageSquare className="w-5 h-5 stroke-[2.2]" />
            <span className="text-[10px] font-bold">Matches</span>
            {matchesCount > 0 && (
              <span className="absolute top-1 right-1.5 text-[9px] font-bold bg-[#FFD43B] text-[#242424] px-1.5 py-0.5 rounded-full leading-none">
                {matchesCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onTabChange('gmail')}
            className={`px-3 py-2 rounded-xl transition-colors flex flex-col items-center gap-1 cursor-pointer ${
              currentTab === 'gmail'
                ? 'text-[#FFD43B] bg-[#303030]'
                : 'text-[#8e8e8e] hover:text-[#F5F5F5]'
            }`}
            title="Gmail"
          >
            <Mail className="w-5 h-5 stroke-[2.2]" />
            <span className="text-[10px] font-bold">Gmail</span>
          </button>

          <button
            onClick={() => onTabChange('profile')}
            className={`px-3 py-2 rounded-xl transition-colors flex flex-col items-center gap-1 cursor-pointer ${
              currentTab === 'profile'
                ? 'text-[#FFD43B] bg-[#303030]'
                : 'text-[#8e8e8e] hover:text-[#F5F5F5]'
            }`}
            title="Profile"
          >
            <User className="w-5 h-5 stroke-[2.2]" />
            <span className="text-[10px] font-bold">Profile</span>
          </button>
        </div>

      </div>
    </header>
  );
};
