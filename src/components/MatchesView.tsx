import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FlatmateCandidate } from '../types';
import { Send, MapPin, Sparkles, Mail, MessageSquare, Users, ShieldCheck } from 'lucide-react';
import {
  FirestoreChatMessage,
  FirestoreMatchRecord,
  getMatchId,
  sendMatchMessage,
  subscribeToMatchMessages,
} from '../services/roomieDb';

interface MatchesViewProps {
  currentUserId: string;
  matchedCandidates: FlatmateCandidate[];
  matchRecords: FirestoreMatchRecord[];
  initialChatCandidate?: FlatmateCandidate | null;
  onExploreMore: () => void;
  onEmailInvite?: (candidate: FlatmateCandidate) => void;
  onOpenFullChat?: (candidate: FlatmateCandidate) => void;
  onFormDuoWith?: (candidate: FlatmateCandidate) => void;
}

export const MatchesView: React.FC<MatchesViewProps> = ({
  currentUserId,
  matchedCandidates,
  matchRecords,
  initialChatCandidate,
  onExploreMore,
  onEmailInvite,
  onOpenFullChat,
  onFormDuoWith,
}) => {
  const [selectedChat, setSelectedChat] = useState<FlatmateCandidate | null>(
    initialChatCandidate || (matchedCandidates.length > 0 ? matchedCandidates[0] : null)
  );
  const [liveMessages, setLiveMessages] = useState<FirestoreChatMessage[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (initialChatCandidate) {
      setSelectedChat(initialChatCandidate);
    } else if (!selectedChat && matchedCandidates.length > 0) {
      setSelectedChat(matchedCandidates[0]);
    } else if (
      selectedChat &&
      matchedCandidates.length > 0 &&
      !matchedCandidates.some((c) => c.id === selectedChat.id)
    ) {
      setSelectedChat(matchedCandidates[0]);
    }
  }, [initialChatCandidate, matchedCandidates, selectedChat]);

  const activeMatchPair = useMemo(() => {
    if (!selectedChat || !currentUserId) return null;
    const { matchId, userA, userB } = getMatchId(currentUserId, selectedChat.id);
    const existingRecord = matchRecords.find((r) => r.matchId === matchId);
    return {
      matchId,
      userA: existingRecord?.userA || userA,
      userB: existingRecord?.userB || userB,
      hasMatchRecord: Boolean(existingRecord),
    };
  }, [selectedChat, currentUserId, matchRecords]);

  // Subscribe in real time to messages inside the active match conversation
  useEffect(() => {
    if (!activeMatchPair || !activeMatchPair.hasMatchRecord) {
      setLiveMessages([]);
      return;
    }

    const unsubscribe = subscribeToMatchMessages(
      activeMatchPair.matchId,
      currentUserId,
      activeMatchPair.userA,
      activeMatchPair.userB,
      (msgs) => {
        setLiveMessages(msgs);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [activeMatchPair, currentUserId]);

  useEffect(() => {
    setSendError('');
    setInputMsg('');
  }, [selectedChat?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveMessages.length, selectedChat?.id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim() || !selectedChat || !activeMatchPair || isSending) return;

    const textToSend = inputMsg.trim();
    setSendError('');
    setInputMsg('');
    setIsSending(true);
    try {
      await sendMatchMessage(
        activeMatchPair.matchId,
        currentUserId,
        activeMatchPair.userA,
        activeMatchPair.userB,
        textToSend
      );
    } catch {
      setInputMsg(textToSend);
      setSendError('Could not send message. Please try again.');
    } finally {
      setIsSending(false);
    }
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

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6">
      {matchedCandidates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-12 bg-[#303030] border border-[#484848] rounded-3xl overflow-hidden shadow-xl min-h-[560px]">
          {/* Left Column: Conversation List */}
          <div className="md:col-span-5 border-r border-[#3d3d3d] flex flex-col">
            <div className="px-4 py-3.5 border-b border-[#3d3d3d] flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#FFD43B]">
                Messages ({matchedCandidates.length})
              </span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[#383838]">
              {matchedCandidates.map((m) => {
                const isSelected = selectedChat?.id === m.id;
                const { matchId } = getMatchId(currentUserId, m.id);
                const record = matchRecords.find((r) => r.matchId === matchId);
                const lastMsg = record?.lastMessage?.trim() || `${m.area} · ${m.hasFlat === 'has_flat' ? 'Has Flat' : 'Needs Flat'}`;

                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedChat(m)}
                    className={`w-full p-3.5 flex items-center gap-3 text-left transition-colors cursor-pointer ${
                      isSelected ? 'bg-[#383838]' : 'hover:bg-[#343434]'
                    }`}
                  >
                    <div className="w-11 h-11 rounded-full overflow-hidden shrink-0 border border-[#484848] bg-[#242424] flex items-center justify-center">
                      {m.photos && m.photos[0] ? (
                        <img src={m.photos[0]} alt={m.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-[#FFD43B]">
                          {m.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-sm font-bold text-[#F5F5F5] truncate">{m.name}</span>
                      </div>
                      <p className="text-xs text-[#B8B8B8] truncate">{lastMsg}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Active Chat View */}
          <div className="md:col-span-7 flex flex-col justify-between bg-[#282828] max-h-[580px]">
            {selectedChat ? (
              <>
                <div className="p-4 bg-[#303030] border-b border-[#3d3d3d] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-[#FFD43B] bg-[#242424] flex items-center justify-center shrink-0">
                      {selectedChat.photos && selectedChat.photos[0] ? (
                        <img
                          src={selectedChat.photos[0]}
                          alt={selectedChat.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs font-bold text-[#FFD43B]">
                          {selectedChat.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-[#F5F5F5] flex items-center gap-1.5 truncate">
                        <span className="truncate">{selectedChat.name}</span>
                        {selectedChat.identityVerification?.identityVerified && (
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        )}
                      </h4>
                      <p className="text-[11px] text-[#FFD43B] flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">
                          {selectedChat.area} · {selectedChat.budget}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {onFormDuoWith && (
                      <button
                        type="button"
                        onClick={() => onFormDuoWith(selectedChat)}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold border border-emerald-500/40 inline-flex items-center gap-1 cursor-pointer transition-colors"
                        title="Form Duo +1"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Team Up</span>
                      </button>
                    )}
                    {onOpenFullChat && (
                      <button
                        type="button"
                        onClick={() => onOpenFullChat(selectedChat)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#FFD43B] hover:bg-[#ffe066] text-[#242424] text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Expand</span>
                      </button>
                    )}
                    {onEmailInvite && (
                      <button
                        type="button"
                        onClick={() => onEmailInvite(selectedChat)}
                        className="p-2 rounded-lg bg-[#383838] hover:bg-[#444444] text-[#FFD43B] border border-[#484848] cursor-pointer transition-colors"
                        title="Send email via Gmail"
                      >
                        <Mail className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Messages Body */}
                <div className="flex-1 p-4 overflow-y-auto space-y-3">
                  {liveMessages.length === 0 ? (
                    <div className="text-center py-12 text-xs text-[#8e8e8e]">
                      Say hello to {selectedChat.name.split(' ')[0]} to discuss rent split or visiting the flat.
                    </div>
                  ) : (
                    liveMessages.map((msg) => {
                      const isMe = msg.senderUid === currentUserId;
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                        >
                          <div
                            className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
                              isMe
                                ? 'bg-[#FFD43B] text-[#242424] font-medium rounded-br-none'
                                : 'bg-[#383838] text-[#F5F5F5] border border-[#484848] rounded-bl-none'
                            }`}
                          >
                            {msg.text}
                          </div>
                          <span className="text-[9px] text-[#6e6e6e] mt-1 px-1">
                            {formatTimestamp(msg)}
                          </span>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {sendError && (
                  <p className="px-4 pb-1 text-[11px] text-red-400">{sendError}</p>
                )}

                {/* Input Bar */}
                <form
                  onSubmit={handleSendMessage}
                  className="p-3 bg-[#303030] border-t border-[#3d3d3d] flex gap-2"
                >
                  <input
                    type="text"
                    value={inputMsg}
                    onChange={(e) => setInputMsg(e.target.value)}
                    placeholder={`Message ${selectedChat.name} about flat visit, rent split...`}
                    className="flex-1 px-3.5 py-2.5 bg-[#242424] border border-[#444444] rounded-xl text-xs text-[#F5F5F5] placeholder-[#666666] focus:outline-none focus:border-[#FFD43B]"
                  />
                  <button
                    type="submit"
                    disabled={isSending || !inputMsg.trim()}
                    className="px-4 py-2.5 bg-[#FFD43B] hover:bg-[#ffe066] text-[#242424] font-bold text-xs rounded-xl transition-all cursor-pointer shadow flex items-center justify-center disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-[#8e8e8e] p-8 text-center">
                Select a roomie from the list to start messaging.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Empty Matches State */
        <div className="bg-[#303030] border border-[#484848] rounded-3xl p-10 text-center max-w-md mx-auto my-12 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-[#383838] border border-[#484848] flex items-center justify-center text-[#FFD43B] mx-auto mb-4">
            <Sparkles className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-[#F5F5F5] mb-2">No Roomie Connections Yet</h3>
          <p className="text-xs text-[#B8B8B8] mb-6 leading-relaxed">
            Join a Living Circle and connect with flatmates who share your accommodation requirements to unlock real-time chat!
          </p>
          <button
            onClick={onExploreMore}
            className="px-6 py-3 bg-[#FFD43B] hover:bg-[#ffe066] text-[#242424] font-bold text-xs rounded-xl shadow-md cursor-pointer"
          >
            Explore Living Circles
          </button>
        </div>
      )}
    </div>
  );
};
