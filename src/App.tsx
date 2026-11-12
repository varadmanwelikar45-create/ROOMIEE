import { useState, useEffect } from 'react';
import { UserProfile, FlatmateCandidate } from './types';
import { AuthScreen } from './components/AuthScreen';
import { AppHeader } from './components/AppHeader';
import { DiscoveryDeck } from './components/DiscoveryDeck';
import { MatchesView } from './components/MatchesView';
import { TopPicksView } from './components/TopPicksView';
import { ProfileView } from './components/ProfileView';
import { CityBuildings } from './components/CityBuildings';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [currentTab, setCurrentTab] = useState<'discover' | 'top_picks' | 'matches' | 'profile'>('discover');
  
  // Community candidates containing only real registered people
  const [allCandidates, setAllCandidates] = useState<FlatmateCandidate[]>([]);
  
  // Matched flatmate IDs
  const [matchedIds, setMatchedIds] = useState<string[]>([]);

  // Active chat target for direct transition from Match modal
  const [activeChatCandidate, setActiveChatCandidate] = useState<FlatmateCandidate | null>(null);

  // Gender match filter: Defaults to matching Boys with Boys, Girls with Girls
  const [genderFilter, setGenderFilter] = useState<'male' | 'female' | 'all'>('male');

  // Load registered community and saved session
  useEffect(() => {
    // 1. Load community users (only real registered people, no AI profiles)
    const communityRaw = localStorage.getItem('roomie_community_candidates');
    let communityList: FlatmateCandidate[] = [];
    if (communityRaw) {
      try {
        const parsed: FlatmateCandidate[] = JSON.parse(communityRaw);
        // Exclude any legacy AI profiles
        communityList = parsed.filter(c => !c.id.startsWith('male-') && !c.id.startsWith('female-'));
      } catch {
        // Fallback
      }
    }
    setAllCandidates(communityList);
    localStorage.setItem('roomie_community_candidates', JSON.stringify(communityList));

    // 2. Load current user session
    const savedUser = localStorage.getItem('roomie_user_session');
    if (savedUser) {
      try {
        const parsed: UserProfile = JSON.parse(savedUser);
        setCurrentUser(parsed);
        // Set gender match filter based on logged-in user
        setGenderFilter(parsed.preferredFlatmateGender === 'any' ? 'all' : parsed.preferredFlatmateGender);
      } catch {
        // Fallback
      }
    }

    // 3. Load matched IDs
    const savedMatches = localStorage.getItem('roomie_matched_ids');
    if (savedMatches) {
      try {
        const parsed: string[] = JSON.parse(savedMatches);
        const filtered = parsed.filter(id => !id.startsWith('male-') && !id.startsWith('female-'));
        setMatchedIds(filtered);
        localStorage.setItem('roomie_matched_ids', JSON.stringify(filtered));
      } catch {
        // Fallback
      }
    }
  }, []);

  // When a real person signs in or registers
  const handleLoginSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    localStorage.setItem('roomie_user_session', JSON.stringify(user));

    // Default to same-gender matching (Boys with Boys, Girls with Girls)
    const targetFilter = user.preferredFlatmateGender === 'any' ? 'all' : user.preferredFlatmateGender;
    setGenderFilter(targetFilter);

    // Save this real logged-in user into the community candidate pool so other users see them!
    const userAsCandidate: FlatmateCandidate = {
      id: user.id,
      name: user.name,
      age: 26,
      gender: user.gender,
      profession: user.skills[0] || 'Urban Professional',
      hasFlat: user.hasFlat,
      city: user.flatLocation.city,
      area: user.flatLocation.area,
      budget: user.budget,
      photos: user.photos || [],
      skills: user.skills,
      hobbies: user.hobbies,
      interests: user.interests,
      bio: user.bio,
      lifestyle: {
        sleepSchedule: user.lifestyle.sleepSchedule,
        kitchenDiet: user.lifestyle.kitchenDiet,
        workRoutine: user.lifestyle.workRoutine,
        cleanliness: user.lifestyle.cleanliness,
        smoking: user.lifestyle.smoking,
        pets: user.lifestyle.pets,
      },
      compatibilityScore: 95,
      flatDetails: user.hasFlat === 'has_flat' ? {
        bhk: '2/3 BHK Apartment',
        deposit: '₹50,000',
        amenities: ['Power Backup', 'Wi-Fi 300 Mbps', 'Washing Machine', 'Daily Housekeeper'],
      } : undefined,
    };

    // Update community candidates
    setAllCandidates((prev) => {
      const filtered = prev.filter(c => c.id !== user.id);
      const updated = [userAsCandidate, ...filtered];
      localStorage.setItem('roomie_community_candidates', JSON.stringify(updated));
      return updated;
    });

    setCurrentTab('discover');
  };

  const handleSignOut = () => {
    setCurrentUser(null);
    localStorage.removeItem('roomie_user_session');
    setCurrentTab('discover');
  };

  const handleConnectFlatmate = (candidate: FlatmateCandidate, isSuper: boolean) => {
    if (!matchedIds.includes(candidate.id)) {
      const updated = [candidate.id, ...matchedIds];
      setMatchedIds(updated);
      localStorage.setItem('roomie_matched_ids', JSON.stringify(updated));
    }
  };

  const handleOpenChatWith = (candidate: FlatmateCandidate) => {
    if (!matchedIds.includes(candidate.id)) {
      const updated = [candidate.id, ...matchedIds];
      setMatchedIds(updated);
      localStorage.setItem('roomie_matched_ids', JSON.stringify(updated));
    }
    setActiveChatCandidate(candidate);
    setCurrentTab('matches');
  };

  const handleUpdateProfile = (updated: UserProfile) => {
    setCurrentUser(updated);
    localStorage.setItem('roomie_user_session', JSON.stringify(updated));
    
    // Also update in community registry
    setAllCandidates(prev => prev.map(c => {
      if (c.id === updated.id) {
        return {
          ...c,
          hasFlat: updated.hasFlat,
          city: updated.flatLocation.city,
          area: updated.flatLocation.area,
          bio: updated.bio,
          lifestyle: {
            ...c.lifestyle,
            sleepSchedule: updated.lifestyle.sleepSchedule,
            kitchenDiet: updated.lifestyle.kitchenDiet,
            workRoutine: updated.lifestyle.workRoutine,
          }
        };
      }
      return c;
    }));
  };

  // Exclude current user from the discovery deck so they don't swipe on themselves
  const discoveryCandidates = allCandidates.filter(c => c.id !== currentUser?.id);
  const matchedCandidates = allCandidates.filter(c => matchedIds.includes(c.id));

  return (
    <div className="min-h-screen bg-[#242424] text-[#F5F5F5] font-sans selection:bg-[#FFD43B] selection:text-[#242424] flex flex-col relative overflow-x-hidden">
      {!currentUser ? (
        <div className="relative z-10 flex-1 flex flex-col">
          <AuthScreen
            onLoginSuccess={handleLoginSuccess}
            registeredUsersCount={allCandidates.length}
          />
        </div>
      ) : (
        <>
          {/* Top Tinder-Style Header */}
          <AppHeader
            currentUser={currentUser}
            currentTab={currentTab}
            onTabChange={(tab) => {
              setCurrentTab(tab);
              if (tab !== 'matches') setActiveChatCandidate(null);
            }}
            matchesCount={matchedCandidates.length}
            onSignOut={handleSignOut}
          />

          {/* Main App Body */}
          <main className="flex-1 pb-12 relative z-10">
            {currentTab === 'discover' && (
              <DiscoveryDeck
                candidates={discoveryCandidates}
                currentUser={currentUser}
                onConnectFlatmate={handleConnectFlatmate}
                onOpenChatWith={handleOpenChatWith}
                genderFilter={genderFilter}
                onGenderFilterChange={setGenderFilter}
              />
            )}

            {currentTab === 'top_picks' && (
              <TopPicksView
                candidates={discoveryCandidates.filter(c => genderFilter === 'all' || c.gender === genderFilter)}
                onConnectFlatmate={handleConnectFlatmate}
                onSelectCandidate={handleOpenChatWith}
              />
            )}

            {currentTab === 'matches' && (
              <MatchesView
                matchedCandidates={matchedCandidates}
                initialChatCandidate={activeChatCandidate}
                onExploreMore={() => setCurrentTab('discover')}
              />
            )}

            {currentTab === 'profile' && (
              <ProfileView
                currentUser={currentUser}
                onUpdateProfile={handleUpdateProfile}
              />
            )}
          </main>
        </>
      )}

      {/* Modern Skyline Buildings at Bottom Right & Left */}
      <CityBuildings />
    </div>
  );
}
