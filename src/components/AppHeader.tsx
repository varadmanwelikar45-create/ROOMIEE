import React from 'react';
import { Flame, Star, MessageSquare, User, LogOut, Home, Search, Mail } from 'lucide-react';
import { UserProfile } from '../types';

interface AppHeaderProps {
  currentUser: UserProfile;
  currentTab: 'discover' | 'top_picks' | 'matches' | 'gmail' | 'profile';
  onTabChange: (tab: 'discover' | 'top_picks' | 'matches' | 'gmail' | 'profile') => void;
  matchesCount: number;
  onSignOut: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  currentUser,
  currentTab,
  onTabChange,
  matchesCount,
  onSignOut,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-[#242424]/95 backdrop-blur-md border-b border-[#383838]">
      <div className="max-w-md sm:max-w-xl mx-auto px-4">
        
        {/* Top Strip: Brand & User Flat Status */}
        <div className="flex items-center justify-between pt-3 pb-2 border-b border-[#333333]">
          
          {/* ROOMIE Logo */}
          <div className="flex items-center gap-1.5">
            <span className="text-xl font-extrabold tracking-tight text-[#F5F5F5]">
              ROOMIE<span className="text-[#FFD43B]">.</span>
            </span>
            <span className="text-[10px] text-[#FFD43B] bg-[#303030] px-2 py-0.5 rounded-full font-bold border border-[#444444]">
              {currentUser.gender === 'male' ? '👦 Boy' : currentUser.gender === 'female' ? '👧 Girl' : '👤 Roomie'}
            </span>
          </div>

          {/* Current Flat Status Badge */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-[11px] text-[#B8B8B8] bg-[#303030] px-2.5 py-1 rounded-full border border-[#444444] max-w-[190px] truncate">
              {currentUser.hasFlat === 'has_flat' ? (
                <Home className="w-3 h-3 text-emerald-400 shrink-0" />
              ) : (
                <Search className="w-3 h-3 text-amber-400 shrink-0" />
              )}
              <span className="truncate">
                {currentUser.hasFlat === 'has_flat' ? 'Has Flat: ' : 'Needs Flat: '}
                <span className="text-[#F5F5F5] font-semibold">{currentUser.flatLocation.area}</span>
              </span>
            </div>

            <button
              onClick={onSignOut}
              className="p-1.5 rounded-lg text-[#8e8e8e] hover:text-red-400 hover:bg-[#303030] transition-colors cursor-pointer"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>

        {/* Tinder-Style Icon Navigation Bar */}
        <div className="flex items-center justify-around py-2">
          
          {/* 1. FLAME (Discover Cards) */}
          <button
            onClick={() => onTabChange('discover')}
            className={`p-2.5 rounded-2xl transition-all flex flex-col items-center gap-1 cursor-pointer ${
              currentTab === 'discover'
                ? 'text-[#FFD43B] bg-[#303030] shadow-md scale-105'
                : 'text-[#8e8e8e] hover:text-[#F5F5F5]'
            }`}
            title="Discover Flatmates (Cards)"
          >
            <Flame className="w-6 h-6 stroke-[2.2] fill-current" />
            <span className="text-[10px] font-bold">Discover</span>
          </button>

          {/* 2. STAR (Top Roomie Picks) */}
          <button
            onClick={() => onTabChange('top_picks')}
            className={`p-2.5 rounded-2xl transition-all flex flex-col items-center gap-1 cursor-pointer ${
              currentTab === 'top_picks'
                ? 'text-sky-400 bg-[#303030] shadow-md scale-105'
                : 'text-[#8e8e8e] hover:text-[#F5F5F5]'
            }`}
            title="Top Roomie Picks"
          >
            <Star className="w-6 h-6 stroke-[2.2] fill-current" />
            <span className="text-[10px] font-bold">Top Picks</span>
          </button>

          {/* 3. CHAT (Matches & Conversations) */}
          <button
            onClick={() => onTabChange('matches')}
            className={`p-2.5 rounded-2xl transition-all flex flex-col items-center gap-1 cursor-pointer relative ${
              currentTab === 'matches'
                ? 'text-emerald-400 bg-[#303030] shadow-md scale-105'
                : 'text-[#8e8e8e] hover:text-[#F5F5F5]'
            }`}
            title="Matches & Messages"
          >
            <MessageSquare className="w-6 h-6 stroke-[2.2] fill-current" />
            <span className="text-[10px] font-bold">Matches</span>
            {matchesCount > 0 && (
              <span className="absolute top-1 right-2 text-[10px] font-bold bg-[#FFD43B] text-[#242424] px-1.5 py-0.5 rounded-full shadow leading-none">
                {matchesCount}
              </span>
            )}
          </button>

          {/* 4. GMAIL (Flatmate Outreach & Inbox) */}
          <button
            onClick={() => onTabChange('gmail')}
            className={`p-2.5 rounded-2xl transition-all flex flex-col items-center gap-1 cursor-pointer ${
              currentTab === 'gmail'
                ? 'text-[#FFD43B] bg-[#303030] shadow-md scale-105'
                : 'text-[#8e8e8e] hover:text-[#F5F5F5]'
            }`}
            title="Gmail Inbox & Outreach"
          >
            <Mail className="w-6 h-6 stroke-[2.2]" />
            <span className="text-[10px] font-bold">Gmail</span>
          </button>

          {/* 5. PROFILE (My Profile & Settings) */}
          <button
            onClick={() => onTabChange('profile')}
            className={`p-2.5 rounded-2xl transition-all flex flex-col items-center gap-1 cursor-pointer ${
              currentTab === 'profile'
                ? 'text-[#F5F5F5] bg-[#303030] shadow-md scale-105'
                : 'text-[#8e8e8e] hover:text-[#F5F5F5]'
            }`}
            title="My Profile"
          >
            <User className="w-6 h-6 stroke-[2.2]" />
            <span className="text-[10px] font-bold">Profile</span>
          </button>

        </div>

      </div>
    </header>
  );
};
