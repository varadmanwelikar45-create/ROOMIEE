import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  Send,
  MapPin,
  Home,
  Search,
  Lock,
  Mail,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Users,
  Flag,
  Ban,
} from 'lucide-react';
import { FlatmateCandidate, UserProfile } from '../types';
import {
  FirestoreChatMessage,
  FirestoreMatchRecord,
  getMatchId,
  recordSwipeAndConnect,
  sendMatchMessage,
  subscribeToMatchMessages,
} from '../services/roomieDb';

interface ChatScreenProps {
  currentUser: UserProfile;
  candidate: FlatmateCandidate;
  isInterested: boolean;
  matchRecords: FirestoreMatchRecord[];
  onBack: () => void;
  onEmailInvite?: (candidate: FlatmateCandidate) => void;
  onFormDuoWith?: (candidate: FlatmateCandidate) => void;
  onReportCandidate?: (candidate: FlatmateCandidate) => void;
  onBlockCandidate?: (candidate: FlatmateCandidate) => void;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({
  currentUser,
  candidate,
  isInterested,
  matchRecords,
  onBack,
  onEmailInvite,
  onFormDuoWith,
  onReportCandidate,
  onBlockCandidate,
}) => {
  const [liveMessages, setLiveMessages] = useState<FirestoreChatMessage[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isPreparingChat, setIsPreparingChat] = useState(false);
  const [sendError, setSendError] = useState('');
  const [matchReady, setMatchReady] = useState(false);
  const [showSafetyBar, setShowSafetyBar] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMatchReady(false);
    setSendError('');
    setInputMsg('');
    setShowSafetyBar(false);
  }, [candidate.id]);

  const pairInfo = useMemo(() => {
    const { matchId, userA, userB } = getMatchId(currentUser.id, candidate.id);
    const existingRecord = matchRecords.find((r) => r.matchId === matchId);
    return {
      matchId,
      userA: existingRecord?.userA || userA,
      userB: existingRecord?.userB || userB,
      hasRecord: Boolean(existingRecord),
    };
  }, [currentUser.id, candidate.id, matchRecords]);

  // Ensure the match document exists in Firestore whenever an Interested user opens Chat
  useEffect(() => {
    if (!isInterested) return;
    if (pairInfo.hasRecord) {
      setMatchReady(true);
      setIsPreparingChat(false);
      return;
    }

    let cancelled = false;
    setIsPreparingChat(true);
    recordSwipeAndConnect(currentUser.id, candidate, 'like')
      .then(() => {
        if (!cancelled) {
          setMatchReady(true);
        }
      })
      .catch((err) => {
        console.error('Failed to prepare chat thread:', err);
        if (!cancelled) {
          setSendError('Could not initialize chat room. Please try again.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsPreparingChat(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isInterested, pairInfo.hasRecord, currentUser.id, candidate]);

  // Subscribe to real-time messages once the match doc is ready
  useEffect(() => {
    if (!isInterested || (!pairInfo.hasRecord && !matchReady)) {
      setLiveMessages([]);
      return;
    }

    const unsubscribe = subscribeToMatchMessages(
      pairInfo.matchId,
      currentUser.id,
      pairInfo.userA,
      pairInfo.userB,
      (msgs) => {
        setLiveMessages(msgs);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [isInterested, pairInfo.hasRecord, pairInfo.matchId, pairInfo.userA, pairInfo.userB, matchReady, currentUser.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveMessages.length]);

  const sendText = async (rawText: string) => {
    const textToSend = rawText.trim();
    if (!textToSend || !isInterested || isSending) return;

    setSendError('');
    setIsSending(true);
    try {
      if (!pairInfo.hasRecord && !matchReady) {
        await recordSwipeAndConnect(currentUser.id, candidate, 'like');
        setMatchReady(true);
      }
      await sendMatchMessage(
        pairInfo.matchId,
        currentUser.id,
        pairInfo.userA,
        pairInfo.userB,
        textToSend
      );
    } catch {
      setInputMsg(textToSend);
      setSendError('Could not send message right now. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;
    const text = inputMsg;
    setInputMsg('');
    await sendText(text);
  };

  const formatTimestamp = (msg: FirestoreChatMessage) => {
    try {
      if (msg.createdAt && typeof msg.createdAt.toDate === 'function') {
        return msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    } catch {
      // ignore pending serverTimestamp format errors
    }
    return 'Sending...';
  };

  // Hard gate: Chat is strictly locked unless user clicked Interested on this profile
  if (!isInterested) {
    return (
      <div className="w-full max-w-2xl mx-auto px-4 py-10">
        <div className="bg-[#303030] border border-[#484848] rounded-3xl p-8 text-center shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-[#383838] border border-[#484848] flex items-center justify-center text-[#FFD43B] mx-auto mb-4">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-extrabold text-[#F5F5F5] mb-2">
            Chat Locked Until Interested
          </h2>
          <p className="text-xs text-[#B8B8B8] max-w-sm mx-auto mb-6 leading-relaxed">
            Direct chat with {candidate.name} is only available after you click{' '}
            <span className="text-[#FFD43B] font-semibold">I&apos;m Interested</span> on their profile.
          </p>
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 bg-[#FFD43B] hover:bg-[#ffe066] text-[#242424] font-bold text-xs rounded-xl shadow cursor-pointer inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Profiles</span>
          </button>
        </div>
      </div>
    );
  }

  const starterGreetings = [
    `Hi ${candidate.name.split(' ')[0]}! I'm interested in teaming up for a flat in ${candidate.area}.`,
    `Hey! Is the room in ${candidate.area} still available?`,
    `Hello! Would you be open to a quick call or flat visit this weekend?`,
  ];

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-4">
      <div className="bg-[#303030] border border-[#484848] rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[calc(100vh-185px)] min-h-[500px] max-h-[680px]">
        {/* Top Chat Screen Header */}
        <div className="p-4 bg-[#2c2c2c] border-b border-[#3d3d3d] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="p-2 rounded-xl bg-[#383838] hover:bg-[#444444] text-[#F5F5F5] border border-[#484848] cursor-pointer shrink-0 transition-colors"
              title="Back"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-[#FFD43B] bg-[#242424] shrink-0 flex items-center justify-center">
              {candidate.photos && candidate.photos[0] ? (
                <img
                  src={candidate.photos[0]}
                  alt={candidate.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-sm font-bold text-[#FFD43B]">
                  {candidate.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm sm:text-base font-extrabold text-[#F5F5F5] truncate">
                  {candidate.name}
                </h2>
                <span className="text-xs text-[#8e8e8e]">({candidate.age})</span>
                {candidate.identityVerification?.identityVerified ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#FFD43B] shrink-0" />
                )}
              </div>

              <div className="flex items-center gap-2 text-[11px] text-[#B8B8B8] truncate">
                <span className="inline-flex items-center gap-1 text-[#FFD43B] font-semibold">
                  {candidate.hasFlat === 'has_flat' ? (
                    <Home className="w-3 h-3" />
                  ) : (
                    <Search className="w-3 h-3" />
                  )}
                  <span>{candidate.hasFlat === 'has_flat' ? 'Has Flat' : 'Needs Flat'}</span>
                </span>
                <span>·</span>
                <span className="inline-flex items-center gap-0.5 truncate">
                  <MapPin className="w-3 h-3 text-[#FFD43B] shrink-0" />
                  <span className="truncate">
                    {candidate.area}, {candidate.city}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onFormDuoWith && (
              <button
                type="button"
                onClick={() => onFormDuoWith(candidate)}
                className="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold border border-emerald-500/40 inline-flex items-center gap-1 cursor-pointer"
                title="Team up as a Duo and find a 3rd flatmate together"
              >
                <Users className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Team Up +1</span>
              </button>
            )}
            {onEmailInvite && (
              <button
                type="button"
                onClick={() => onEmailInvite(candidate)}
                className="px-2.5 py-1.5 rounded-xl bg-[#383838] hover:bg-[#444444] text-[#FFD43B] text-xs font-semibold border border-[#484848] inline-flex items-center gap-1.5 cursor-pointer"
                title="Send invite via Gmail"
              >
                <Mail className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Gmail</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowSafetyBar((prev) => !prev)}
              className={`p-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                showSafetyBar
                  ? 'bg-[#FFD43B]/20 border-[#FFD43B] text-[#FFD43B]'
                  : 'bg-[#383838] hover:bg-[#444444] border-[#484848] text-[#B8B8B8]'
              }`}
              title="Safety Checklist, Report & Block"
              aria-label="Safety Options"
            >
              <ShieldCheck className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Collapsible Safety Bar */}
        {showSafetyBar && (
          <div className="px-4 py-2.5 bg-[#232323] border-b border-[#3d3d3d] text-xs flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-[#B8B8B8] inline-flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>
                {candidate.identityVerification?.identityVerified
                  ? 'ID Verified Profile'
                  : 'Inspect the flat in person or via video call before paying deposit'}
              </span>
            </span>
            <div className="flex items-center gap-3">
              {onReportCandidate && (
                <button
                  type="button"
                  onClick={() => onReportCandidate(candidate)}
                  className="text-amber-300 hover:underline font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>Report</span>
                </button>
              )}
              {onBlockCandidate && (
                <button
                  type="button"
                  onClick={() => onBlockCandidate(candidate)}
                  className="text-red-400 hover:underline font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Block</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Messages Body */}
        <div className="flex-1 p-4 sm:p-5 overflow-y-auto bg-[#262626] space-y-3">
          {isPreparingChat ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-xs text-[#B8B8B8]">
              <Loader2 className="w-5 h-5 text-[#FFD43B] animate-spin" />
              <span>Loading chat...</span>
            </div>
          ) : liveMessages.length === 0 ? (
            <div className="py-6 space-y-4">
              <p className="text-center text-xs text-[#8e8e8e]">
                Start the conversation with {candidate.name.split(' ')[0]}:
              </p>
              <div className="flex flex-col gap-2 max-w-md mx-auto">
                {starterGreetings.map((greeting) => (
                  <button
                    key={greeting}
                    type="button"
                    disabled={isSending}
                    onClick={() => sendText(greeting)}
                    className="text-left px-3.5 py-2.5 rounded-2xl bg-[#303030] hover:bg-[#3a3a3a] border border-[#484848] hover:border-[#FFD43B] text-xs text-[#F5F5F5] transition-all cursor-pointer disabled:opacity-60"
                  >
                    {greeting}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            liveMessages.map((msg) => {
              const isMe = msg.senderUid === currentUser.id;
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm ${
                      isMe
                        ? 'bg-[#FFD43B] text-[#242424] font-medium rounded-br-none'
                        : 'bg-[#383838] text-[#F5F5F5] border border-[#484848] rounded-bl-none'
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-[#6e6e6e] mt-1 px-1">
                    {formatTimestamp(msg)}
                  </span>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {sendError && (
          <p className="px-4 py-1.5 bg-[#2a2a2a] text-xs text-red-400 border-t border-[#3d3d3d]">
            {sendError}
          </p>
        )}

        {/* Input Bar */}
        <form
          onSubmit={handleSubmit}
          className="p-3.5 bg-[#2c2c2c] border-t border-[#3d3d3d] flex items-center gap-2.5"
        >
          <input
            type="text"
            value={inputMsg}
            onChange={(e) => setInputMsg(e.target.value)}
            placeholder={`Say hello to ${candidate.name} about flat visit, rent split...`}
            className="flex-1 px-4 py-3 bg-[#242424] border border-[#444444] rounded-xl text-xs sm:text-sm text-[#F5F5F5] placeholder-[#666666] focus:outline-none focus:border-[#FFD43B]"
          />
          <button
            type="submit"
            disabled={isSending || !inputMsg.trim() || isPreparingChat}
            className="px-4 py-3 bg-[#FFD43B] hover:bg-[#ffe066] text-[#242424] font-bold text-xs rounded-xl transition-all cursor-pointer shadow flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
