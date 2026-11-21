import { useState, useEffect, useMemo, useCallback } from 'react';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { Loader2, Clock, RefreshCw, ShieldAlert, X, Flag, Ban } from 'lucide-react';
import { UserProfile, FlatmateCandidate, RoomieGroup, LivingCircleId } from './types';
import { AuthScreen } from './components/AuthScreen';
import { AppHeader, AppTab } from './components/AppHeader';
import { LivingCirclesView } from './components/LivingCirclesView';
import { MatchesView } from './components/MatchesView';
import { TopPicksView } from './components/TopPicksView';
import { GroupsView } from './components/GroupsView';
import { ProfileView } from './components/ProfileView';
import { GmailView, GmailComposePrefill } from './components/GmailView';
import { ChatScreen } from './components/ChatScreen';
import { auth, clearGmailAccessToken } from './firebase';
import {
  FirestoreMatchRecord,
  blockUserInDb,
  checkUserGroupInterest,
  computeExpiryIso,
  loadUserProfileFromDb,
  recordGroupInterestAndUnlock,
  recordSwipeAndConnect,
  saveUserProfileToDb,
  submitSafetyReport,
  subscribeToCommunityProfiles,
  subscribeToSeekingGroups,
  subscribeToUserMatches,
  updateUserLivingCirclesInDb,
} from './services/roomieDb';
import {
  computeCompatibility,
  getListingExpiryStatus,
  isListingExpired,
} from './utils/compatibility';
import { getEffectiveLivingCircles } from './utils/livingCircles';

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [currentTab, setCurrentTab] = useState<AppTab>('discover');

  // Real-time community candidates synced from Firestore
  const [allCandidates, setAllCandidates] = useState<FlatmateCandidate[]>([]);

  // Real-time Duo Groups synced from Firestore
  const [roomieGroups, setRoomieGroups] = useState<RoomieGroup[]>([]);
  const [interestedGroupIds, setInterestedGroupIds] = useState<string[]>([]);
  const [initialActiveGroup, setInitialActiveGroup] = useState<RoomieGroup | null>(null);
  const [initialPartnerToFormGroup, setInitialPartnerToFormGroup] =
    useState<FlatmateCandidate | null>(null);

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

  // Listing renewal loading state
  const [renewingListing, setRenewingListing] = useState(false);

  // Safety report / block modal state
  const [safetyModal, setSafetyModal] = useState<{
    candidate: FlatmateCandidate;
    mode: 'report' | 'block';
  } | null>(null);
  const [reportReason, setReportReason] = useState('Suspicious / Fake Flat Photos');
  const [reportDetails, setReportDetails] = useState('');
  const [safetyBusy, setSafetyBusy] = useState(false);
  const [safetyError, setSafetyError] = useState('');
  const [safetyToast, setSafetyToast] = useState<string | null>(null);

  // 1. Observe Firebase Authentication state first (Auth Guard)
  useEffect(() => {
    let initialLoad = true;
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (!fbUser || !fbUser.emailVerified) {
        setCurrentUser(null);
        setAllCandidates([]);
        setRoomieGroups([]);
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
          setCurrentUser((prev) => (prev && prev.id === profile.id ? prev : profile));
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

    const unsubGroups = subscribeToSeekingGroups((groups) => {
      setRoomieGroups(groups);
    });

    return () => {
      unsubProfiles();
      unsubMatches();
      unsubGroups();
    };
  }, [authReady, firebaseUser, currentUser?.id]);

  // Keep track of which Duo Groups current user has unlocked interest on
  useEffect(() => {
    if (!currentUser || roomieGroups.length === 0) return;
    let active = true;
    Promise.all(
      roomieGroups.map(async (g) => {
        if (g.memberUids.includes(currentUser.id)) return g.groupId;
        const ok = await checkUserGroupInterest(g.groupId, currentUser.id);
        return ok ? g.groupId : null;
      })
    )
      .then((ids) => {
        if (!active) return;
        setInterestedGroupIds(ids.filter((id): id is string => Boolean(id)));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [roomieGroups, currentUser?.id]);

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
      setRoomieGroups([]);
      setMatchRecords([]);
      setInterestedIds([]);
      setInterestedGroupIds([]);
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
        setInterestedIds((prev) => prev.filter((id) => id !== candidate.id));
        setSafetyToast('Could not save your interest right now. Please try again.');
        window.setTimeout(() => setSafetyToast(null), 3500);
      });
    },
    [currentUser]
  );

  const handleToggleLivingCircle = useCallback(
    async (circleId: LivingCircleId) => {
      if (!currentUser) return;
      const current = getEffectiveLivingCircles(currentUser);
      const exists = current.includes(circleId);
      if (exists && current.length <= 1) return;

      const nextCircles = exists
        ? current.filter((c) => c !== circleId)
        : [...current, circleId].slice(0, 4);

      setCurrentUser((prev) => (prev ? { ...prev, livingCircles: nextCircles } : prev));
      try {
        try {
          const saved = await updateUserLivingCirclesInDb(currentUser.id, nextCircles);
          setCurrentUser((prev) => (prev ? { ...prev, livingCircles: saved } : prev));
        } catch {
          await saveUserProfileToDb({ ...currentUser, livingCircles: nextCircles });
        }
      } catch (err) {
        setCurrentUser((prev) => (prev ? { ...prev, livingCircles: current } : prev));
        throw err;
      }
    },
    [currentUser]
  );

  const handleGroupInterested = useCallback(
    async (group: RoomieGroup) => {
      if (!currentUser) return;
      setInterestedGroupIds((prev) =>
        prev.includes(group.groupId) ? prev : [...prev, group.groupId]
      );
      try {
        await recordGroupInterestAndUnlock(group, currentUser);
      } catch (err) {
        console.error('Failed to record group interest:', err);
        setInterestedGroupIds((prev) => prev.filter((id) => id !== group.groupId));
        setSafetyToast('Could not unlock duo group chat right now. Please try again.');
        window.setTimeout(() => setSafetyToast(null), 3500);
      }
    },
    [currentUser]
  );

  const handleOpenGroupChat = useCallback((group: RoomieGroup) => {
    setChatTarget(null);
    setInitialActiveGroup(group);
    setCurrentTab('groups');
  }, []);

  const handleFormDuoWith = useCallback((candidate: FlatmateCandidate) => {
    setChatTarget(null);
    setInitialPartnerToFormGroup(candidate);
    setCurrentTab('groups');
  }, []);

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

  const handleRenewMyListing = useCallback(async () => {
    if (!currentUser || renewingListing) return;
    setRenewingListing(true);
    try {
      const days = currentUser.listingDurationDays || 14;
      const renewed: UserProfile = {
        ...currentUser,
        expiresAt: computeExpiryIso(days),
      };
      await saveUserProfileToDb(renewed);
      setCurrentUser(renewed);
      setSafetyToast(`Listing renewed for +${days} days!`);
      window.setTimeout(() => setSafetyToast(null), 3000);
    } catch {
      setSafetyToast('Could not renew listing right now. Please try again.');
      window.setTimeout(() => setSafetyToast(null), 3500);
    } finally {
      setRenewingListing(false);
    }
  }, [currentUser, renewingListing]);

  const handleConfirmSafetyAction = async () => {
    if (!currentUser || !safetyModal || safetyBusy) return;
    setSafetyError('');
    setSafetyBusy(true);
    try {
      if (safetyModal.mode === 'report') {
        await submitSafetyReport(
          currentUser.id,
          safetyModal.candidate.id,
          reportReason,
          reportDetails
        );
        setSafetyToast(`Report submitted for ${safetyModal.candidate.name}. Thank you for keeping ROOMIE safe.`);
      } else {
        const nextBlocked = await blockUserInDb(
          currentUser.id,
          safetyModal.candidate.id,
          currentUser.blockedUids || []
        );
        setCurrentUser((prev) => (prev ? { ...prev, blockedUids: nextBlocked } : prev));
        if (chatTarget?.id === safetyModal.candidate.id) setChatTarget(null);
        setSafetyToast(`${safetyModal.candidate.name} has been blocked and hidden from your feed.`);
      }
      setSafetyModal(null);
      setReportDetails('');
      window.setTimeout(() => setSafetyToast(null), 3500);
    } catch {
      setSafetyError('Could not complete this safety action. Please try again.');
    } finally {
      setSafetyBusy(false);
    }
  };

  // Enrich candidates with dynamic Personality + Cost + Location + Identity compatibility scores
  // and exclude current user, blocked users, and automatically expired listings.
  const discoveryCandidates = useMemo(() => {
    const blockedSet = new Set(currentUser?.blockedUids || []);
    return allCandidates
      .filter(
        (c) =>
          c.id !== currentUser?.id &&
          !blockedSet.has(c.id) &&
          !isListingExpired(c.expiresAt)
      )
      .map((c) => {
        const { score, reasons } = computeCompatibility(currentUser, c);
        return {
          ...c,
          compatibilityScore: score,
          matchReasons: reasons,
        };
      });
  }, [allCandidates, currentUser]);

  // Derive matched flatmates & order directly from real-time Firestore matchRecords (filtering out blocked)
  const { matchedIds, matchedCandidates } = useMemo(() => {
    if (!currentUser) return { matchedIds: [] as string[], matchedCandidates: [] as FlatmateCandidate[] };

    const blockedSet = new Set(currentUser.blockedUids || []);
    const candidateById = new Map(allCandidates.map((c) => [c.id, c]));
    const ids: string[] = [];
    const list: FlatmateCandidate[] = [];

    for (const record of matchRecords) {
      if (record.status !== 'active') continue;
      const otherUid = record.userA === currentUser.id ? record.userB : record.userA;
      if (blockedSet.has(otherUid)) continue;
      if (!ids.includes(otherUid)) {
        ids.push(otherUid);
        const cand = candidateById.get(otherUid);
        if (cand) list.push(cand);
      }
    }

    return { matchedIds: ids, matchedCandidates: list };
  }, [allCandidates, matchRecords, currentUser]);

  const effectiveMatchedIds = useMemo(
    () => Array.from(new Set([...matchedIds, ...interestedIds])),
    [matchedIds, interestedIds]
  );

  const handleOpenChatWith = useCallback(
    (candidate: FlatmateCandidate) => {
      if (!currentUser) return;
      if (!effectiveMatchedIds.includes(candidate.id)) return;
      setActiveChatCandidate(candidate);
      setChatTarget(candidate);
    },
    [currentUser, effectiveMatchedIds]
  );

  const myExpiryStatus = currentUser ? getListingExpiryStatus(currentUser.expiresAt) : null;

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
          <AppHeader
            currentUser={currentUser}
            currentTab={currentTab}
            onTabChange={(tab) => {
              setChatTarget(null);
              setCurrentTab(tab);
              if (tab !== 'matches') setActiveChatCandidate(null);
            }}
            matchesCount={matchedCandidates.length}
            groupsCount={roomieGroups.length}
            onSignOut={handleSignOut}
          />

          {/* Safety / Renewal Toast */}
          {safetyToast && (
            <div className="fixed top-28 left-1/2 -translate-x-1/2 z-50 bg-[#303030] border border-[#FFD43B] text-[#F5F5F5] px-4 py-2 rounded-xl shadow-2xl text-xs font-semibold">
              {safetyToast}
            </div>
          )}

          {/* Auto-Expiry Alert Banner when expired or expiring within 48h */}
          {myExpiryStatus && (myExpiryStatus.expired || myExpiryStatus.expiringSoon) && !chatTarget && (
            <div className="w-full max-w-2xl mx-auto px-4 pt-3 relative z-10">
              <div
                className={`p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
                  myExpiryStatus.expired
                    ? 'bg-red-950/40 border-red-700 text-red-200'
                    : 'bg-amber-950/40 border-amber-700 text-amber-200'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Clock className="w-4 h-4 shrink-0 text-[#FFD43B]" />
                  <span className="truncate font-semibold">
                    {myExpiryStatus.expired
                      ? 'Your flatmate listing auto-expired and is hidden from others.'
                      : `Your listing ${myExpiryStatus.label.toLowerCase()} — renew to stay visible!`}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={renewingListing}
                  onClick={handleRenewMyListing}
                  className="px-3 py-1.5 rounded-lg bg-[#FFD43B] hover:bg-[#ffe066] text-[#242424] font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${renewingListing ? 'animate-spin' : ''}`} />
                  <span>Renew</span>
                </button>
              </div>
            </div>
          )}

          {/* Main App Body */}
          <main className="flex-1 pb-8 relative z-10">
            {chatTarget ? (
              <ChatScreen
                currentUser={currentUser}
                candidate={chatTarget}
                isInterested={effectiveMatchedIds.includes(chatTarget.id)}
                matchRecords={matchRecords}
                onBack={() => setChatTarget(null)}
                onEmailInvite={handleEmailInvite}
                onFormDuoWith={handleFormDuoWith}
                onReportCandidate={(cand) => setSafetyModal({ candidate: cand, mode: 'report' })}
                onBlockCandidate={(cand) => setSafetyModal({ candidate: cand, mode: 'block' })}
              />
            ) : (
              <>
                {currentTab === 'discover' && (
                  <LivingCirclesView
                    candidates={discoveryCandidates}
                    currentUser={currentUser}
                    matchedIds={effectiveMatchedIds}
                    onToggleCircle={handleToggleLivingCircle}
                    onConnectFlatmate={handleConnectFlatmate}
                    onOpenChatWith={handleOpenChatWith}
                    onReportOrBlock={(cand, mode) => setSafetyModal({ candidate: cand, mode })}
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

                {currentTab === 'groups' && (
                  <GroupsView
                    currentUser={currentUser}
                    groups={roomieGroups}
                    matchedCandidates={matchedCandidates}
                    initialActiveGroup={initialActiveGroup}
                    onConsumeInitialGroup={() => setInitialActiveGroup(null)}
                    initialPartnerToFormGroup={initialPartnerToFormGroup}
                    onConsumeInitialPartner={() => setInitialPartnerToFormGroup(null)}
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
                    onFormDuoWith={handleFormDuoWith}
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

          {/* IN-APP SAFETY REPORT / BLOCK MODAL */}
          {safetyModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className="w-full max-w-md bg-[#303030] border border-[#484848] rounded-3xl p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-extrabold text-[#F5F5F5]">
                    {safetyModal.mode === 'report' ? (
                      <Flag className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Ban className="w-4 h-4 text-red-400" />
                    )}
                    <span>
                      {safetyModal.mode === 'report'
                        ? `Report ${safetyModal.candidate.name}`
                        : `Block ${safetyModal.candidate.name}?`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSafetyModal(null);
                      setSafetyError('');
                    }}
                    className="p-1.5 rounded-full bg-[#383838] text-[#B8B8B8] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {safetyModal.mode === 'report' ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#B8B8B8] mb-1">
                        Reason
                      </label>
                      <select
                        value={reportReason}
                        onChange={(e) => setReportReason(e.target.value)}
                        className="w-full px-3 py-2 bg-[#242424] border border-[#444444] rounded-xl text-xs text-[#F5F5F5]"
                      >
                        <option value="Suspicious / Fake Flat Photos">Suspicious / Fake Flat Photos</option>
                        <option value="Asking Advance Money Before Visit">Asking Advance Money Before Visit</option>
                        <option value="Harassment or Inappropriate Messages">Harassment or Inappropriate Messages</option>
                        <option value="Fake Identity / Broker Posing as Flatmate">Fake Identity / Broker Posing as Flatmate</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#B8B8B8] mb-1">
                        Additional Details (Optional)
                      </label>
                      <textarea
                        rows={3}
                        value={reportDetails}
                        onChange={(e) => setReportDetails(e.target.value)}
                        placeholder="Describe what happened..."
                        className="w-full px-3 py-2 bg-[#242424] border border-[#444444] rounded-xl text-xs text-[#F5F5F5]"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-red-950/30 border border-red-800/70 rounded-2xl p-3.5 text-xs text-[#B8B8B8] flex items-start gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <p>
                      Blocking <span className="text-[#F5F5F5] font-bold">{safetyModal.candidate.name}</span>{' '}
                      immediately removes them from your feed and matches.
                    </p>
                  </div>
                )}

                {safetyError && (
                  <p className="text-xs text-red-400 bg-red-950/40 p-2 rounded-lg border border-red-800">
                    {safetyError}
                  </p>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={safetyBusy}
                    onClick={() => {
                      setSafetyModal(null);
                      setSafetyError('');
                    }}
                    className="flex-1 py-2.5 bg-[#383838] hover:bg-[#444444] text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={safetyBusy}
                    onClick={handleConfirmSafetyAction}
                    className={`flex-1 py-2.5 text-xs font-bold rounded-xl cursor-pointer disabled:opacity-60 ${
                      safetyModal.mode === 'report'
                        ? 'bg-[#FFD43B] hover:bg-[#ffe066] text-[#242424]'
                        : 'bg-red-500 hover:bg-red-400 text-white'
                    }`}
                  >
                    {safetyBusy
                      ? 'Submitting...'
                      : safetyModal.mode === 'report'
                      ? 'Submit Safety Report'
                      : 'Block User'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
