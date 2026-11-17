import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  Home,
  MapPin,
  Sparkles,
  Heart,
  MessageSquare,
  Send,
  ArrowLeft,
  ShieldCheck,
  Clock,
  CheckCircle2,
  Loader2,
  Plus,
} from 'lucide-react';
import { FlatmateCandidate, GroupMessage, RoomieGroup, UserProfile } from '../types';
import {
  checkUserGroupInterest,
  createDuoGroup,
  recordGroupInterestAndUnlock,
  sendGroupMessage,
  subscribeToGroupInterests,
  subscribeToGroupMessages,
  updateGroupStatus,
} from '../services/roomieDb';
import { computeGroupCompatibility, getListingExpiryStatus } from '../utils/compatibility';
import { CostBreakdownCard } from './CostBreakdownCard';

interface GroupsViewProps {
  currentUser: UserProfile;
  groups: RoomieGroup[];
  matchedCandidates: FlatmateCandidate[];
  initialActiveGroup?: RoomieGroup | null;
  onConsumeInitialGroup?: () => void;
  initialPartnerToFormGroup?: FlatmateCandidate | null;
  onConsumeInitialPartner?: () => void;
}

export const GroupsView: React.FC<GroupsViewProps> = ({
  currentUser,
  groups,
  matchedCandidates,
  initialActiveGroup,
  onConsumeInitialGroup,
  initialPartnerToFormGroup,
  onConsumeInitialPartner,
}) => {
  const [selectedGroupChat, setSelectedGroupChat] = useState<RoomieGroup | null>(
    initialActiveGroup || null
  );
  const [interestedGroupIds, setInterestedGroupIds] = useState<string[]>([]);
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [groupRequesters, setGroupRequesters] = useState<Array<{ uid: string; requesterName: string }>>([]);
  const [msgText, setMsgText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [markingGroupId, setMarkingGroupId] = useState<string | null>(null);
  const [markingFull, setMarkingFull] = useState(false);
  const [groupActionError, setGroupActionError] = useState('');
  const [chatError, setChatError] = useState('');

  // Form Duo Group modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(
    matchedCandidates[0]?.id || ''
  );
  const [groupArea, setGroupArea] = useState(currentUser.flatLocation.area);
  const [groupBhk, setGroupBhk] = useState('3 BHK · Seeking 3rd Flatmate');
  const [groupBudget, setGroupBudget] = useState(currentUser.budget);
  const [groupBio, setGroupBio] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [createError, setCreateError] = useState('');

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (initialActiveGroup) {
      setSelectedGroupChat(initialActiveGroup);
      setInterestedGroupIds((prev) =>
        prev.includes(initialActiveGroup.groupId) ? prev : [...prev, initialActiveGroup.groupId]
      );
      if (onConsumeInitialGroup) onConsumeInitialGroup();
    }
  }, [initialActiveGroup, onConsumeInitialGroup]);

  useEffect(() => {
    if (initialPartnerToFormGroup) {
      setSelectedGroupChat(null);
      setSelectedPartnerId(initialPartnerToFormGroup.id);
      setGroupArea(currentUser.flatLocation.area || initialPartnerToFormGroup.area);
      setShowCreateModal(true);
      if (onConsumeInitialPartner) onConsumeInitialPartner();
    }
  }, [initialPartnerToFormGroup, onConsumeInitialPartner, currentUser.flatLocation.area]);

  useEffect(() => {
    if (!selectedPartnerId && matchedCandidates.length > 0) {
      setSelectedPartnerId(matchedCandidates[0].id);
    }
  }, [matchedCandidates, selectedPartnerId]);

  // Check which groups currentUser has already clicked Interested on
  useEffect(() => {
    let active = true;
    Promise.all(
      groups.map(async (g) => {
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
  }, [groups, currentUser.id]);

  // Subscribe to messages & requesters when a group chat screen is open
  useEffect(() => {
    setChatError('');
    setMsgText('');
    if (!selectedGroupChat) {
      setGroupMessages([]);
      setGroupRequesters([]);
      return;
    }

    const unsubMsgs = subscribeToGroupMessages(
      selectedGroupChat.groupId,
      currentUser.id,
      setGroupMessages
    );

    let unsubRequesters = () => {};
    if (selectedGroupChat.memberUids.includes(currentUser.id)) {
      unsubRequesters = subscribeToGroupInterests(
        selectedGroupChat.groupId,
        currentUser.id,
        setGroupRequesters
      );
    }

    return () => {
      unsubMsgs();
      unsubRequesters();
    };
  }, [selectedGroupChat, currentUser.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [groupMessages.length]);

  const handleMarkInterestedInGroup = async (group: RoomieGroup) => {
    if (markingGroupId) return;
    setGroupActionError('');
    setMarkingGroupId(group.groupId);
    try {
      await recordGroupInterestAndUnlock(group, currentUser);
      setInterestedGroupIds((prev) =>
        prev.includes(group.groupId) ? prev : [...prev, group.groupId]
      );
    } catch {
      setGroupActionError('Could not unlock duo group chat right now. Please try again.');
    } finally {
      setMarkingGroupId(null);
    }
  };

  const handleOpenGroupChat = async (group: RoomieGroup) => {
    const isMember = group.memberUids.includes(currentUser.id);
    const isInterested = interestedGroupIds.includes(group.groupId);
    if (!isMember && !isInterested) return;
    setSelectedGroupChat(group);
  };

  const sendGroupText = async (rawText: string) => {
    const text = rawText.trim();
    if (!selectedGroupChat || !text || isSending) return;

    setChatError('');
    setIsSending(true);
    try {
      const visibleTo = [
        ...selectedGroupChat.memberUids,
        ...groupRequesters.map((r) => r.uid),
        currentUser.id,
      ];
      await sendGroupMessage(selectedGroupChat.groupId, currentUser, visibleTo, text);
    } catch {
      setMsgText(text);
      setChatError('Could not send group message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendGroupMsg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupChat || !msgText.trim() || isSending) return;
    const text = msgText;
    setMsgText('');
    await sendGroupText(text);
  };

  const handleMarkGroupFull = async () => {
    if (!selectedGroupChat || markingFull) return;
    setChatError('');
    setMarkingFull(true);
    try {
      await updateGroupStatus(selectedGroupChat.groupId, 'full');
      setSelectedGroupChat(null);
    } catch {
      setChatError('Could not update group status right now. Please try again.');
    } finally {
      setMarkingFull(false);
    }
  };

  const handleCreateDuoGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const partner = matchedCandidates.find((m) => m.id === selectedPartnerId);
    if (!partner) {
      setCreateError('Select one of your connected matches first to form a duo.');
      return;
    }

    setCreateError('');
    setCreatingGroup(true);
    try {
      const created = await createDuoGroup(currentUser, partner, {
        area: groupArea,
        city: currentUser.flatLocation.city,
        bhkType: groupBhk,
        budgetPerPerson: groupBudget,
        bio: groupBio,
      });
      setShowCreateModal(false);
      setGroupBio('');
      setSelectedGroupChat(created);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not form group right now.');
    } finally {
      setCreatingGroup(false);
    }
  };

  // Dedicated Group Chat Screen inside app
  if (selectedGroupChat) {
    const isMember = selectedGroupChat.memberUids.includes(currentUser.id);
    return (
      <div className="w-full max-w-3xl mx-auto px-4 py-4">
        <div className="bg-[#303030] border border-[#484848] rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[calc(100vh-205px)] min-h-[480px] max-h-[660px]">
          <div className="p-4 bg-[#2a2a2a] border-b border-[#3d3d3d] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setSelectedGroupChat(null)}
                className="p-2 rounded-xl bg-[#383838] hover:bg-[#444444] text-[#F5F5F5] border border-[#484848] cursor-pointer shrink-0"
                title="Back to Groups"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center -space-x-2 shrink-0">
                {selectedGroupChat.memberPhotos.slice(0, 2).map((pic, i) => (
                  <img
                    key={i}
                    src={pic}
                    alt="Duo member"
                    className="w-9 h-9 rounded-full object-cover border-2 border-[#FFD43B] bg-[#242424]"
                  />
                ))}
              </div>

              <div className="min-w-0">
                <h3 className="text-sm font-extrabold text-[#F5F5F5] truncate">
                  {selectedGroupChat.memberNames.join(' & ')} · +1 Group Chat
                </h3>
                <p className="text-[11px] text-[#FFD43B] truncate flex items-center gap-1">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span>
                    {selectedGroupChat.area} · {selectedGroupChat.budgetPerPerson}
                  </span>
                </p>
              </div>
            </div>

            {isMember && (
              <button
                type="button"
                disabled={markingFull}
                onClick={handleMarkGroupFull}
                className="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold cursor-pointer shrink-0 disabled:opacity-60"
              >
                {markingFull ? 'Updating...' : 'Mark Group Full'}
              </button>
            )}
          </div>

          {/* Messages Body */}
          <div className="flex-1 p-4 overflow-y-auto bg-[#252525] space-y-3">
            <div className="text-center my-1">
              <span className="text-[10px] text-[#B8B8B8] bg-[#303030] px-3 py-1 rounded-full border border-[#444444]">
                Duo Group ({selectedGroupChat.memberNames.join(' + ')}) seeking 1 more flatmate in{' '}
                {selectedGroupChat.area}
              </span>
            </div>

            {groupMessages.length === 0 ? (
              <div className="text-center py-8 space-y-3">
                <p className="text-xs text-[#8e8e8e]">
                  Start chatting with {selectedGroupChat.memberNames.join(' & ')} to see if the 3rd room fits!
                </p>
                <button
                  type="button"
                  disabled={isSending}
                  onClick={() =>
                    sendGroupText(
                      `Hi ${selectedGroupChat.memberNames.join(' & ')}! I saw your duo group in ${selectedGroupChat.area} and would love to join as the 3rd flatmate.`
                    )
                  }
                  className="px-4 py-2 rounded-xl bg-[#FFD43B] hover:bg-[#ffe066] text-[#242424] font-bold text-xs cursor-pointer disabled:opacity-60"
                >
                  Say Hello to Duo
                </button>
              </div>
            ) : (
              groupMessages.map((m) => {
                const isMe = m.senderUid === currentUser.id;
                return (
                  <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <span className="text-[10px] text-[#8e8e8e] mb-0.5 px-1">{m.senderName}</span>
                    <div
                      className={`max-w-[78%] px-3.5 py-2 rounded-2xl text-xs leading-relaxed ${
                        isMe
                          ? 'bg-[#FFD43B] text-[#242424] font-medium rounded-br-none'
                          : 'bg-[#383838] text-[#F5F5F5] border border-[#484848] rounded-bl-none'
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {chatError && (
            <p className="px-4 py-1.5 bg-[#2a2a2a] text-xs text-red-400 border-t border-[#3d3d3d]">
              {chatError}
            </p>
          )}

          <form
            onSubmit={handleSendGroupMsg}
            className="p-3 bg-[#2c2c2c] border-t border-[#3d3d3d] flex items-center gap-2"
          >
            <input
              type="text"
              value={msgText}
              onChange={(e) => setMsgText(e.target.value)}
              placeholder="Message the group about 3 BHK rooms, rent split..."
              className="flex-1 px-3.5 py-2.5 bg-[#242424] border border-[#444444] rounded-xl text-xs text-[#F5F5F5] placeholder-[#666666] focus:outline-none focus:border-[#FFD43B]"
            />
            <button
              type="submit"
              disabled={isSending || !msgText.trim()}
              className="px-4 py-2.5 bg-[#FFD43B] hover:bg-[#ffe066] text-[#242424] font-bold text-xs rounded-xl cursor-pointer disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 pb-24 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#383838]">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#FFD43B] mb-1">
            <Users className="w-4 h-4" />
            <span>Group Matching · Duo +1 Mode</span>
          </div>
          <h2 className="text-2xl font-extrabold text-[#F5F5F5]">
            Connected Duos Looking for 1 More Flatmate
          </h2>
          <p className="text-xs text-[#B8B8B8] mt-0.5">
            Already connected with a roomie and need a 3rd person? Team up so other swipers see you together!
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          disabled={matchedCandidates.length === 0}
          className="px-4 py-2.5 bg-[#FFD43B] hover:bg-[#ffe066] text-[#242424] font-extrabold text-xs rounded-xl shadow flex items-center gap-1.5 cursor-pointer disabled:opacity-45 shrink-0"
          title={
            matchedCandidates.length === 0
              ? 'Connect with a flatmate first to form a duo group'
              : 'Team up with a connected flatmate'
          }
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Team Up With Match (+1 Needed)</span>
        </button>
      </div>

      {groupActionError && (
        <p className="text-xs text-red-400 bg-red-950/40 p-2.5 rounded-xl border border-red-800">
          {groupActionError}
        </p>
      )}

      {/* Groups Grid */}
      {groups.length === 0 ? (
        <div className="bg-[#303030] border border-[#444444] rounded-3xl p-10 text-center shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-[#FFD43B]/10 border border-[#FFD43B]/30 text-[#FFD43B] flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-[#F5F5F5] mb-2">
            No Active Duo Groups Yet
          </h3>
          <p className="text-xs text-[#B8B8B8] max-w-md mx-auto mb-5">
            Once two connected flatmates team up looking for a 3rd roommate, their combined Duo card appears here and inside the main Discover swipe deck.
          </p>
          {matchedCandidates.length > 0 && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-2.5 bg-[#FFD43B] hover:bg-[#ffe066] text-[#242424] font-bold text-xs rounded-xl shadow cursor-pointer"
            >
              Form First Duo Group With {matchedCandidates[0].name.split(' ')[0]}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {groups.map((group) => {
            const isMember = group.memberUids.includes(currentUser.id);
            const isInterested = interestedGroupIds.includes(group.groupId);
            const expiry = getListingExpiryStatus(group.expiresAt);
            const fitScore = computeGroupCompatibility(currentUser, group);

            return (
              <div
                key={group.groupId}
                className="bg-[#303030] border border-[#444444] hover:border-[#FFD43B]/70 rounded-3xl overflow-hidden shadow-xl flex flex-col justify-between transition-all"
              >
                <div className="p-5 space-y-4">
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] font-extrabold bg-[#FFD43B] text-[#242424] px-3 py-1 rounded-full inline-flex items-center gap-1.5 shadow">
                      <Users className="w-3.5 h-3.5" />
                      <span>2 TOGETHER · NEED +{group.openSpots}</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold bg-[#242424] text-emerald-300 border border-emerald-500/35 px-2.5 py-0.5 rounded-full">
                        {fitScore}% Fit
                      </span>
                      <span className="text-[10px] text-[#B8B8B8] bg-[#242424] border border-[#444444] px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5 text-[#FFD43B]" />
                        <span>{expiry.label}</span>
                      </span>
                    </div>
                  </div>

                  {/* Paired Member Portraits */}
                  <div className="flex items-center gap-3.5">
                    <div className="flex items-center -space-x-3 shrink-0">
                      {group.memberPhotos.slice(0, 2).map((pic, i) => (
                        <img
                          key={i}
                          src={pic}
                          alt={`Group member ${i + 1}`}
                          className="w-16 h-16 rounded-2xl object-cover border-2 border-[#FFD43B] bg-[#242424] shadow-lg"
                        />
                      ))}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-extrabold text-[#F5F5F5] truncate">
                        {group.memberNames.join(' & ')}
                      </h3>
                      <p className="text-xs text-[#FFD43B] font-semibold flex items-center gap-1">
                        <Home className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{group.bhkType}</span>
                      </p>
                      <p className="text-[11px] text-[#B8B8B8] flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-[#FFD43B] shrink-0" />
                        <span className="truncate">
                          {group.area}, {group.city} · {group.budgetPerPerson}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Vibe + Bio */}
                  <div className="space-y-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-[#383838] text-[#FFD43B] border border-[#484848]">
                      <Sparkles className="w-3 h-3" />
                      <span>{group.vibeSummary}</span>
                    </span>
                    <p className="text-xs text-[#B8B8B8] leading-relaxed bg-[#242424] p-3 rounded-xl border border-[#3d3d3d]">
                      &ldquo;{group.bio}&rdquo;
                    </p>
                  </div>

                  {/* Flat Photos Strip */}
                  {group.flatPhotos.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-emerald-300 inline-flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        <span>AI-Verified Shared Flat Photos</span>
                      </span>
                      <div className="grid grid-cols-3 gap-1.5">
                        {group.flatPhotos.slice(0, 3).map((fp, i) => (
                          <img
                            key={i}
                            src={fp}
                            alt={`Group flat ${i + 1}`}
                            className="aspect-[4/3] w-full rounded-lg object-cover border border-[#484848]"
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Per-Person Cost Breakdown */}
                  <CostBreakdownCard
                    costBreakdown={group.costBreakdown}
                    fallbackBudget={group.budgetPerPerson}
                    hasFlat={group.hasFlat}
                    compact
                  />
                </div>

                {/* Action Footer */}
                <div className="p-4 pt-0">
                  {isMember ? (
                    <button
                      type="button"
                      onClick={() => handleOpenGroupChat(group)}
                      className="w-full py-2.5 px-4 bg-[#383838] hover:bg-[#444444] text-[#FFD43B] border border-[#FFD43B]/40 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Your Duo Group · Open Group Chat</span>
                    </button>
                  ) : isInterested ? (
                    <button
                      type="button"
                      onClick={() => handleOpenGroupChat(group)}
                      className="w-full py-2.5 px-4 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>Say Hello to Duo · Open Group Chat</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={markingGroupId === group.groupId}
                      onClick={() => handleMarkInterestedInGroup(group)}
                      className="w-full py-2.5 px-4 bg-[#FFD43B] hover:bg-[#ffe066] text-[#242424] font-extrabold text-xs rounded-xl shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      {markingGroupId === group.groupId ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Heart className="w-4 h-4 fill-current" />
                      )}
                      <span>
                        {markingGroupId === group.groupId
                          ? 'Unlocking Chat...'
                          : "I'm Interested in Joining This Duo"}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Form Duo Group With a Connected Match */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#303030] border border-[#484848] rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-[#F5F5F5] flex items-center gap-2">
                <Users className="w-5 h-5 text-[#FFD43B]" />
                <span>Form Duo Group (+1 Flatmate)</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-xs text-[#B8B8B8] hover:text-[#F5F5F5] cursor-pointer"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleCreateDuoGroup} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#B8B8B8] font-semibold mb-1">
                  Connected Flatmate Partner
                </label>
                <select
                  value={selectedPartnerId}
                  onChange={(e) => setSelectedPartnerId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#242424] border border-[#444444] rounded-xl text-[#F5F5F5]"
                >
                  {matchedCandidates.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.area})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[#B8B8B8] font-semibold mb-1">Flat / Target Area</label>
                  <input
                    type="text"
                    required
                    value={groupArea}
                    onChange={(e) => setGroupArea(e.target.value)}
                    className="w-full px-3 py-2 bg-[#242424] border border-[#444444] rounded-xl text-[#F5F5F5]"
                  />
                </div>
                <div>
                  <label className="block text-[#B8B8B8] font-semibold mb-1">Per-Person Share</label>
                  <input
                    type="text"
                    required
                    value={groupBudget}
                    onChange={(e) => setGroupBudget(e.target.value)}
                    className="w-full px-3 py-2 bg-[#242424] border border-[#444444] rounded-xl text-[#F5F5F5]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#B8B8B8] font-semibold mb-1">Flat Size / Goal</label>
                <input
                  type="text"
                  required
                  value={groupBhk}
                  onChange={(e) => setGroupBhk(e.target.value)}
                  className="w-full px-3 py-2 bg-[#242424] border border-[#444444] rounded-xl text-[#F5F5F5]"
                />
              </div>

              <div>
                <label className="block text-[#B8B8B8] font-semibold mb-1">
                  Note for 3rd Flatmate
                </label>
                <textarea
                  rows={2}
                  value={groupBio}
                  onChange={(e) => setGroupBio(e.target.value)}
                  placeholder="e.g. We both connected for a spacious 3 BHK in Koramangala and need 1 easygoing 3rd roommate!"
                  className="w-full px-3 py-2 bg-[#242424] border border-[#444444] rounded-xl text-[#F5F5F5]"
                />
              </div>

              {createError && (
                <p className="text-red-400 bg-red-950/40 p-2 rounded-lg border border-red-800">
                  {createError}
                </p>
              )}

              <button
                type="submit"
                disabled={creatingGroup}
                className="w-full py-3 bg-[#FFD43B] hover:bg-[#ffe066] text-[#242424] font-extrabold rounded-xl shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {creatingGroup ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Publishing Duo to Discover Deck...</span>
                  </>
                ) : (
                  <span>Publish Group (Show Together While Swapping)</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
