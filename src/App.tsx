import { useState, useEffect, useMemo, useCallback } from 'react';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { Loader2 } from 'lucide-react';
import { UserProfile, FlatmateCandidate } from './types';
import { AuthScreen } from './components/AuthScreen';
import { AppHeader } from './components/AppHeader';
import { DiscoveryDeck } from './components/DiscoveryDeck';
import { MatchesView } from './components/MatchesView';
import { TopPicksView } from './components/TopPicksView';
import { ProfileView } from './components/ProfileView';
import { GmailView, GmailComposePrefill } from './components/GmailView';
import { ChatScreen } from './components/ChatScreen';
import { CityBuildings } from './components/CityBuildings';
import { auth, clearGmailAccessToken } from './firebase';
import {
  FirestoreMatchRecord,
  loadUserProfileFromDb,
  recordSwipeAndConnect,
  saveUserProfileToDb,
  subscribeToCommunityProfiles,
  subscribeToUserMatches,
} from './services/roomieDb';

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [currentTab, setCurrentTab] = useState<'discover' | 'top_picks' | 'matches' | 'gmail' | 'profile'>('discover');

  // Real-time community candidates synced from Firestore
  const [allCandidates, setAllCandidates] = useState<FlatmateCandidate[]>([]);

  // Real-time matches synced from Firestore
  const [matchRecords, setMatchRecords] = useState<FirestoreMatchRecord[]>([]);

  // Profiles on which the current user has explicitly clicked "I'm Interested"
  const [interestedIds, setInterestedIds] = useState<string[]>([]);

  // Dedicated full-panel Chat Screen target (ONLY accessible for Interested profiles)
  const [chatTarget, setChatTarget] = useState<FlatmateCandidate | null>(null);

  // Active chat target inside MatchesView tab
  const [activeChatCandidate, setActiveChatCandidate] = useState<FlatmateCandidate | null>(null);

  // Prefill payload when jumping from chat to Gmail Compose
  const [gmailPrefill, setGmailPrefill] = useState<GmailComposePrefill | null>(null);

  // Gender match filter: Defaults to matching Boys with Boys, Girls with Girls
  const [genderFilter, setGenderFilter] = useState<'male' | 'female' | 'all'>('male');

  // 1. Observe Firebase Authentication state first (Auth Guard)
  useEffect(() => {
    let initialLoad = true;
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (!fbUser || !fbUser.emailVerified) {
        setCurrentUser(null);
        setAllCandidates([]);
        setMatchRecords([]);
        setProfileLoading(false);
        setAuthReady(true);
        initialLoad = false;
        return;
      }

      if (initialLoad) {
        setProfileLoading(true);
      }
      try {
        const profile = await loadUserProfileFromDb(fbUser.uid);
        if (profile) {
          setCurrentUser((prev) => prev || profile);
          setGenderFilter(
            profile.preferredFlatmateGender === 'any' ? 'all' : profile.preferredFlatmateGender
          );
        } else {
          setCurrentUser(null);
        }
      } catch (err) {
        console.error('Failed to load user profile:', err);
        setCurrentUser(null);
      } finally {
        setProfileLoading(false);
        setAuthReady(true);
        initialLoad = false;
      }
    });

    return () => unsubscribe();
  }, []);

  // 2. Attach real-time Firestore listeners ONLY after authReady & signed-in profile exists
  useEffect(() => {
    if (!authReady || !firebaseUser || !firebaseUser.emailVerified || !currentUser) {
      return;
    }

    const unsubProfiles = subscribeToCommunityProfiles((candidates) => {
      setAllCandidates(candidates);
    });

    const unsubMatches = subscribeToUserMatches(firebaseUser.uid, (records) => {
      setMatchRecords(records);
    });

    return () => {
      unsubProfiles();
      unsubMatches();
    };
  }, [authReady, firebaseUser, currentUser?.id]);

  // Callback when AuthScreen finishes sign-in or new user registration in Firestore
  const handleLoginSuccess = useCallback((user: UserProfile) => {
    setCurrentUser(user);
    setGenderFilter(
      user.preferredFlatmateGender === 'any' ? 'all' : user.preferredFlatmateGender
    );
    setCurrentTab('discover');
  }, []);

  const handleSignOut = useCallback(async () => {
    clearGmailAccessToken();
    try {
      await signOut(auth);
    } finally {
      setCurrentUser(null);
      setAllCandidates([]);
      setMatchRecords([]);
      setInterestedIds([]);
      setChatTarget(null);
      setActiveChatCandidate(null);
      setGmailPrefill(null);
      setCurrentTab('discover');
    }
  }, []);

  const handleConnectFlatmate = useCallback(
    (candidate: FlatmateCandidate, isSuper: boolean) => {
      if (!currentUser) return;
      setInterestedIds((prev) => (prev.includes(candidate.id) ? prev : [...prev, candidate.id]));
      recordSwipeAndConnect(currentUser.id, candidate, isSuper ? 'super' : 'like').catch((err) => {
        console.error('Failed to record interest:', err);
      });
    },
    [currentUser]
  );

  const handlePassFlatmate = useCallback(
    (candidate: FlatmateCandidate) => {
      if (!currentUser) return;
      recordSwipeAndConnect(currentUser.id, candidate, 'pass').catch((err) => {
        console.error('Failed to record pass:', err);
      });
    },
    [currentUser]
  );

  const handleEmailInvite = useCallback(
    (candidate: FlatmateCandidate) => {
      if (!currentUser) return;
      setChatTarget(null);
      setGmailPrefill({
        to: '',
        subject: `ROOMIE Flatmate Visit — ${candidate.area}, ${candidate.city}`,
        body: `Hi ${candidate.name},\n\nWe connected on ROOMIE! I'm ${currentUser.name} (${currentUser.hasFlat === 'has_flat' ? 'I have a flat' : 'looking for a flat'} in ${currentUser.flatLocation.area}, ${currentUser.flatLocation.city}).\n\nWould you like to schedule a quick call or flat visit this week?\n\nBest,\n${currentUser.name}`,
      });
      setCurrentTab('gmail');
    },
    [currentUser]
  );

  const handleUpdateProfile = useCallback(async (updated: UserProfile) => {
    await saveUserProfileToDb(updated);
    setCurrentUser(updated);
  }, []);

  // Exclude current user from the discovery deck so they don't swipe on themselves
  const discoveryCandidates = useMemo(
    () => allCandidates.filter((c) => c.id !== currentUser?.id),
    [allCandidates, currentUser?.id]
  );

  // Derive matched flatmates & order directly from real-time Firestore matchRecords
  const { matchedIds, matchedCandidates } = useMemo(() => {
    if (!currentUser) return { matchedIds: [] as string[], matchedCandidates: [] as FlatmateCandidate[] };

    const candidateById = new Map(allCandidates.map((c) => [c.id, c]));
    const ids: string[] = [];
    const list: FlatmateCandidate[] = [];

    for (const record of matchRecords) {
      if (record.status !== 'active') continue;
      const otherUid = record.userA === currentUser.id ? record.userB : record.userA;
      if (!ids.includes(otherUid)) {
        ids.push(otherUid);
        const cand = candidateById.get(otherUid);
        if (cand) list.push(cand);
      }
    }

    return { matchedIds: ids, matchedCandidates: list };
  }, [allCandidates, matchRecords, currentUser]);

  // Combined set of Interested profile IDs (Firestore matchRecords + optimistic interestedIds)
  const effectiveMatchedIds = useMemo(
    () => Array.from(new Set([...matchedIds, ...interestedIds])),
    [matchedIds, interestedIds]
  );

  // Strictly only allow opening the dedicated ChatScreen if the user has clicked Interested
  const handleOpenChatWith = useCallback(
    (candidate: FlatmateCandidate) => {
      if (!currentUser) return;
      if (!effectiveMatchedIds.includes(candidate.id)) return;
      setActiveChatCandidate(candidate);
      setChatTarget(candidate);
    },
    [currentUser, effectiveMatchedIds]
  );

  return (
    <div className="min-h-screen bg-[#242424] text-[#F5F5F5] font-sans selection:bg-[#FFD43B] selection:text-[#242424] flex flex-col relative overflow-x-hidden">
      {!authReady || profileLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center relative z-10 gap-3 px-4">
          <Loader2 className="w-8 h-8 text-[#FFD43B] animate-spin" />
          <p className="text-xs text-[#B8B8B8] font-medium">
            Connecting to ROOMIE community database...
          </p>
        </div>
      ) : !currentUser ? (
        <div className="relative z-10 flex-1 flex flex-col">
          <AuthScreen
            firebaseUser={firebaseUser}
            onLoginSuccess={handleLoginSuccess}
            onSignOutAuth={handleSignOut}
          />
        </div>
      ) : (
        <>
          {/* Top Tinder-Style Header */}
          <AppHeader
            currentUser={currentUser}
            currentTab={currentTab}
            onTabChange={(tab) => {
              setChatTarget(null);
              setCurrentTab(tab);
              if (tab !== 'matches') setActiveChatCandidate(null);
            }}
            matchesCount={matchedCandidates.length}
            onSignOut={handleSignOut}
          />

          {/* Main App Body */}
          <main className="flex-1 pb-12 relative z-10">
            {chatTarget ? (
              <ChatScreen
                currentUser={currentUser}
                candidate={chatTarget}
                isInterested={effectiveMatchedIds.includes(chatTarget.id)}
                matchRecords={matchRecords}
                onBack={() => setChatTarget(null)}
                onEmailInvite={handleEmailInvite}
              />
            ) : (
              <>
                {currentTab === 'discover' && (
                  <DiscoveryDeck
                    candidates={discoveryCandidates}
                    currentUser={currentUser}
                    matchedIds={effectiveMatchedIds}
                    onConnectFlatmate={handleConnectFlatmate}
                    onPassFlatmate={handlePassFlatmate}
                    onOpenChatWith={handleOpenChatWith}
                    genderFilter={genderFilter}
                    onGenderFilterChange={setGenderFilter}
                  />
                )}

                {currentTab === 'top_picks' && (
                  <TopPicksView
                    candidates={discoveryCandidates.filter(
                      (c) => genderFilter === 'all' || c.gender === genderFilter
                    )}
                    matchedIds={effectiveMatchedIds}
                    onConnectFlatmate={handleConnectFlatmate}
                    onSelectCandidate={handleOpenChatWith}
                  />
                )}

                {currentTab === 'matches' && (
                  <MatchesView
                    currentUserId={currentUser.id}
                    matchedCandidates={matchedCandidates}
                    matchRecords={matchRecords}
                    initialChatCandidate={activeChatCandidate}
                    onExploreMore={() => setCurrentTab('discover')}
                    onEmailInvite={handleEmailInvite}
                    onOpenFullChat={handleOpenChatWith}
                  />
                )}

                {currentTab === 'gmail' && (
                  <GmailView
                    currentUser={currentUser}
                    prefillCompose={gmailPrefill}
                    onConsumePrefill={() => setGmailPrefill(null)}
                  />
                )}

                {currentTab === 'profile' && (
                  <ProfileView
                    currentUser={currentUser}
                    onUpdateProfile={handleUpdateProfile}
                  />
                )}
              </>
            )}
          </main>
        </>
      )}

      {/* Modern Skyline Buildings at Bottom Right & Left */}
      <CityBuildings />
    </div>
  );
}
