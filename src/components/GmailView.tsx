import React, { useState, useEffect, useCallback } from 'react';
import {
  Mail,
  Search,
  Send,
  Trash2,
  RefreshCw,
  Reply,
  Inbox,
  PenSquare,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  X,
  LogOut,
} from 'lucide-react';
import {
  clearGmailAccessToken,
  connectGmailWithGoogle,
  getGmailAccessToken,
} from '../firebase';
import {
  getGmailUserProfile,
  GmailAuthError,
  GmailMessageSummary,
  listGmailMessages,
  sendGmailMessage,
  trashGmailMessage,
} from '../services/gmailService';
import { UserProfile } from '../types';

export interface GmailComposePrefill {
  to?: string;
  subject: string;
  body: string;
}

interface GmailViewProps {
  currentUser: UserProfile;
  prefillCompose?: GmailComposePrefill | null;
  onConsumePrefill?: () => void;
}

type PendingConfirmation =
  | { type: 'send'; to: string; subject: string; body: string }
  | { type: 'trash'; message: GmailMessageSummary };

export const GmailView: React.FC<GmailViewProps> = ({
  currentUser,
  prefillCompose,
  onConsumePrefill,
}) => {
  const [accessToken, setAccessToken] = useState<string | null>(() => getGmailAccessToken());
  const [needsAuth, setNeedsAuth] = useState<boolean>(() => !getGmailAccessToken());
  const [gmailEmail, setGmailEmail] = useState<string>(currentUser.email || '');
  const [isConnecting, setIsConnecting] = useState(false);
  const [authError, setAuthError] = useState('');

  // Sub-view: inbox or compose
  const [activeMode, setActiveMode] = useState<'inbox' | 'compose'>('inbox');

  // Inbox state
  const [messages, setMessages] = useState<GmailMessageSummary[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<GmailMessageSummary | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [apiError, setApiError] = useState('');
  const [statusNotice, setStatusNotice] = useState('');

  // Compose state
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [isMutating, setIsMutating] = useState(false);

  // Mandatory confirmation dialog state for mutating/destructive operations
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);

  // Apply compose prefill when routed from Matches
  useEffect(() => {
    if (prefillCompose) {
      setComposeTo(prefillCompose.to || '');
      setComposeSubject(prefillCompose.subject);
      setComposeBody(prefillCompose.body);
      setActiveMode('compose');
      if (onConsumePrefill) onConsumePrefill();
    }
  }, [prefillCompose, onConsumePrefill]);

  const loadInbox = useCallback(
    async (token: string, queryText: string) => {
      setLoadingMessages(true);
      setApiError('');
      try {
        const [profile, list] = await Promise.all([
          getGmailUserProfile(token),
          listGmailMessages(token, queryText, 12),
        ]);
        if (profile.emailAddress) {
          setGmailEmail(profile.emailAddress);
        }
        setMessages(list);
        setSelectedMessage((prev) => {
          if (prev && list.some((m) => m.id === prev.id)) {
            return list.find((m) => m.id === prev.id) || null;
          }
          return list[0] || null;
        });
      } catch (err) {
        if (err instanceof GmailAuthError) {
          clearGmailAccessToken();
          setAccessToken(null);
          setNeedsAuth(true);
          setAuthError(err.message);
        } else {
          setApiError(err instanceof Error ? err.message : 'Failed to load Gmail messages.');
        }
      } finally {
        setLoadingMessages(false);
      }
    },
    []
  );

  useEffect(() => {
    if (accessToken && !needsAuth) {
      loadInbox(accessToken, '');
    }
  }, [accessToken, needsAuth, loadInbox]);

  const handleConnectGmail = async () => {
    if (isConnecting) return;
    setAuthError('');
    setIsConnecting(true);
    try {
      const { accessToken: token, user } = await connectGmailWithGoogle();
      setAccessToken(token);
      setNeedsAuth(false);
      if (user.email) setGmailEmail(user.email);
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user') {
        setAuthError('Google sign-in popup was closed before granting Gmail permission.');
      } else if (code === 'auth/popup-blocked') {
        setAuthError('Pop-up was blocked by your browser. Please allow pop-ups and try again.');
      } else {
        setAuthError(
          err instanceof Error ? err.message : 'Could not authorize Gmail access. Please try again.'
        );
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectGmail = () => {
    clearGmailAccessToken();
    setAccessToken(null);
    setNeedsAuth(true);
    setMessages([]);
    setSelectedMessage(null);
    setStatusNotice('');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    loadInbox(accessToken, searchQuery);
  };

  const handleRequestSend = (e: React.FormEvent) => {
    e.preventDefault();
    setApiError('');
    if (!composeTo.trim() || !composeTo.includes('@')) {
      setApiError('Please enter a valid recipient email address.');
      return;
    }
    if (!composeBody.trim()) {
      setApiError('Please enter a message before sending.');
      return;
    }

    // Mandatory user confirmation dialog before sending email
    setPendingConfirmation({
      type: 'send',
      to: composeTo.trim(),
      subject: composeSubject.trim() || `Flatmate Connect from ${currentUser.name} (ROOMIE)`,
      body: composeBody.trim(),
    });
  };

  const handleRequestTrash = (msg: GmailMessageSummary) => {
    setApiError('');
    // Mandatory user confirmation dialog before moving email to Trash
    setPendingConfirmation({
      type: 'trash',
      message: msg,
    });
  };

  const handleConfirmAction = async () => {
    if (!pendingConfirmation || !accessToken || isMutating) return;

    setIsMutating(true);
    setApiError('');
    try {
      if (pendingConfirmation.type === 'send') {
        await sendGmailMessage(
          accessToken,
          pendingConfirmation.to,
          pendingConfirmation.subject,
          pendingConfirmation.body
        );
        setStatusNotice(`Email sent via Gmail to ${pendingConfirmation.to}`);
        setComposeTo('');
        setComposeSubject('');
        setComposeBody('');
        setActiveMode('inbox');
        setPendingConfirmation(null);
        await loadInbox(accessToken, searchQuery);
      } else {
        const targetId = pendingConfirmation.message.id;
        await trashGmailMessage(accessToken, targetId);
        setMessages((prev) => prev.filter((m) => m.id !== targetId));
        if (selectedMessage?.id === targetId) {
          setSelectedMessage(null);
        }
        setStatusNotice('Message moved to Gmail Trash.');
        setPendingConfirmation(null);
      }
    } catch (err) {
      setPendingConfirmation(null);
      if (err instanceof GmailAuthError) {
        clearGmailAccessToken();
        setAccessToken(null);
        setNeedsAuth(true);
        setAuthError(err.message);
      } else {
        setApiError(err instanceof Error ? err.message : 'Gmail action failed. Please try again.');
      }
    } finally {
      setIsMutating(false);
    }
  };

  const handleStartReply = (msg: GmailMessageSummary) => {
    const emailMatch = msg.from.match(/<([^>]+)>/);
    const replyAddress = emailMatch ? emailMatch[1] : msg.from;
    const replySubject = msg.subject.toLowerCase().startsWith('re:')
      ? msg.subject
      : `Re: ${msg.subject}`;
    setComposeTo(replyAddress);
    setComposeSubject(replySubject);
    setComposeBody(
      `\n\n---\nHi,\nReached out via ROOMIE (${currentUser.flatLocation.area}, ${currentUser.flatLocation.city}).`
    );
    setActiveMode('compose');
  };

  // Show Google Sign-In card when Gmail OAuth token is not yet obtained
  if (needsAuth || !accessToken) {
    return (
      <div className="w-full max-w-xl mx-auto px-4 py-8">
        <div className="bg-[#303030] border border-[#484848] rounded-3xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-[#383838] border border-[#484848] flex items-center justify-center text-[#FFD43B] mx-auto mb-4 shadow-lg">
            <Mail className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-extrabold text-[#F5F5F5] mb-2">
            Connect Gmail for Flatmate Outreach
          </h2>
          <p className="text-xs text-[#B8B8B8] max-w-md mx-auto mb-6 leading-relaxed">
            Read landlord or broker replies, search housing threads, and send flat-visit invitations directly from your Gmail account with your permission.
          </p>

          {authError && (
            <p className="text-xs text-red-400 bg-red-950/40 p-3 rounded-xl border border-red-800 mb-5 text-left">
              {authError}
            </p>
          )}

          {/* Official Google Material Sign-In Button */}
          <button
            type="button"
            onClick={handleConnectGmail}
            disabled={isConnecting}
            className="gsi-material-button inline-flex items-center justify-center gap-3 bg-white hover:bg-[#f8f9fa] active:bg-[#e8eaed] text-[#1f1f1f] font-medium text-sm px-5 py-2.5 rounded-full border border-[#747775] shadow-md transition-all cursor-pointer disabled:opacity-60"
          >
            <div className="gsi-material-button-icon w-5 h-5 shrink-0">
              <svg
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 48 48"
                style={{ display: 'block' }}
              >
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
                <path fill="none" d="M0 0h48v48H0z" />
              </svg>
            </div>
            <span className="gsi-material-button-contents font-semibold">
              {isConnecting ? 'Connecting to Google...' : 'Sign in with Google'}
            </span>
          </button>

          <p className="text-[11px] text-[#8e8e8e] mt-5">
            Access tokens stay strictly in memory for your active session and are cleared on sign out.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6">
      {/* Top Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-[#383838]">
        <div>
          <h2 className="text-xl font-extrabold text-[#F5F5F5] flex items-center gap-2">
            <Mail className="w-5 h-5 text-[#FFD43B]" />
            <span>Gmail Flatmate Hub</span>
          </h2>
          <p className="text-xs text-[#B8B8B8]">
            Connected as <span className="text-[#FFD43B] font-semibold">{gmailEmail || currentUser.email}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveMode('inbox')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
              activeMode === 'inbox'
                ? 'bg-[#FFD43B] text-[#242424] shadow'
                : 'bg-[#303030] text-[#B8B8B8] border border-[#444444] hover:text-[#F5F5F5]'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>Inbox</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('compose')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
              activeMode === 'compose'
                ? 'bg-[#FFD43B] text-[#242424] shadow'
                : 'bg-[#303030] text-[#B8B8B8] border border-[#444444] hover:text-[#F5F5F5]'
            }`}
          >
            <PenSquare className="w-3.5 h-3.5" />
            <span>Compose</span>
          </button>

          <button
            type="button"
            onClick={handleDisconnectGmail}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-[#303030] text-[#B8B8B8] hover:text-red-400 border border-[#444444] flex items-center gap-1.5 cursor-pointer"
            title="Disconnect Gmail session"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Disconnect</span>
          </button>
        </div>
      </div>

      {statusNotice && (
        <div className="mb-4 bg-emerald-950/40 border border-emerald-700 text-emerald-300 px-4 py-2.5 rounded-xl text-xs font-medium flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusNotice}</span>
          </span>
          <button type="button" onClick={() => setStatusNotice('')} className="cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {apiError && (
        <div className="mb-4 bg-red-950/40 border border-red-800 text-red-400 px-4 py-2.5 rounded-xl text-xs font-medium">
          {apiError}
        </div>
      )}

      {/* INBOX VIEW */}
      {activeMode === 'inbox' && (
        <div className="bg-[#303030] border border-[#484848] rounded-3xl overflow-hidden shadow-2xl">
          {/* Search & Quick Filter Bar */}
          <form
            onSubmit={handleSearchSubmit}
            className="p-3.5 bg-[#282828] border-b border-[#3d3d3d] flex flex-wrap items-center gap-2"
          >
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-[#8e8e8e] absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Gmail (e.g. flat, rent, Koramangala, from:...)"
                className="w-full pl-9 pr-3 py-2 bg-[#242424] border border-[#444444] rounded-xl text-xs text-[#F5F5F5] placeholder-[#666666] focus:outline-none focus:border-[#FFD43B]"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setSearchQuery('flat OR room OR rent OR flatmate');
                loadInbox(accessToken, 'flat OR room OR rent OR flatmate');
              }}
              className="px-3 py-2 rounded-xl bg-[#383838] hover:bg-[#444444] text-xs font-semibold text-[#FFD43B] border border-[#484848] cursor-pointer"
            >
              Housing Filter
            </button>

            <button
              type="submit"
              disabled={loadingMessages}
              className="px-3.5 py-2 rounded-xl bg-[#FFD43B] hover:bg-[#ffe066] text-[#242424] text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingMessages ? 'animate-spin' : ''}`} />
              <span>{loadingMessages ? 'Loading...' : 'Search'}</span>
            </button>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-12 min-h-[460px]">
            {/* Message List */}
            <div className="md:col-span-5 border-r border-[#3d3d3d] max-h-[500px] overflow-y-auto divide-y divide-[#383838]">
              {loadingMessages && messages.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#B8B8B8] flex flex-col items-center gap-2">
                  <Loader2 className="w-5 h-5 text-[#FFD43B] animate-spin" />
                  <span>Loading your Gmail messages...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#8e8e8e]">
                  No messages found. Try clearing your search query or compose a new email.
                </div>
              ) : (
                messages.map((msg) => {
                  const isSelected = selectedMessage?.id === msg.id;
                  return (
                    <button
                      key={msg.id}
                      type="button"
                      onClick={() => setSelectedMessage(msg)}
                      className={`w-full p-3.5 text-left transition-colors cursor-pointer ${
                        isSelected ? 'bg-[#383838]' : 'hover:bg-[#343434]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span
                          className={`text-xs truncate ${
                            msg.isUnread ? 'font-extrabold text-[#FFD43B]' : 'font-semibold text-[#F5F5F5]'
                          }`}
                        >
                          {msg.from.replace(/<[^>]+>/g, '').trim() || msg.from}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-[#F5F5F5] truncate mb-0.5">{msg.subject}</p>
                      <p className="text-[11px] text-[#B8B8B8] line-clamp-2">{msg.snippet}</p>
                    </button>
                  );
                })
              )}
            </div>

            {/* Selected Message Reader */}
            <div className="md:col-span-7 bg-[#282828] flex flex-col justify-between max-h-[500px]">
              {selectedMessage ? (
                <>
                  <div className="p-4 bg-[#303030] border-b border-[#3d3d3d] flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-extrabold text-[#F5F5F5] break-words">
                        {selectedMessage.subject}
                      </h3>
                      <p className="text-[11px] text-[#FFD43B] mt-1 truncate">
                        From: {selectedMessage.from}
                      </p>
                      {selectedMessage.date && (
                        <p className="text-[10px] text-[#8e8e8e] mt-0.5">{selectedMessage.date}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartReply(selectedMessage)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#383838] hover:bg-[#444444] text-xs font-semibold text-[#F5F5F5] border border-[#484848] flex items-center gap-1 cursor-pointer"
                      >
                        <Reply className="w-3.5 h-3.5 text-[#FFD43B]" />
                        <span>Reply</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRequestTrash(selectedMessage)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#383838] hover:bg-red-950/60 text-xs font-semibold text-red-400 border border-[#484848] flex items-center gap-1 cursor-pointer"
                        title="Move to Trash"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Trash</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-5 overflow-y-auto flex-1 text-xs text-[#E0E0E0] whitespace-pre-wrap leading-relaxed">
                    {selectedMessage.bodyText || selectedMessage.snippet || '(Empty message body)'}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center p-8 text-xs text-[#8e8e8e]">
                  Select an email from the list to read its contents.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* COMPOSE VIEW */}
      {activeMode === 'compose' && (
        <form
          onSubmit={handleRequestSend}
          className="bg-[#303030] border border-[#484848] rounded-3xl p-6 shadow-2xl space-y-4"
        >
          <div>
            <h3 className="text-base font-extrabold text-[#F5F5F5]">
              Compose Email via Gmail
            </h3>
            <p className="text-xs text-[#B8B8B8] mt-0.5">
              Send flat visit details, broker inquiries, or rent-split notes directly from {gmailEmail || 'your Gmail'}.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#B8B8B8] mb-1">
              Recipient Email (To)
            </label>
            <input
              type="email"
              required
              value={composeTo}
              onChange={(e) => setComposeTo(e.target.value)}
              placeholder="flatmate-or-broker@gmail.com"
              className="w-full px-3.5 py-2.5 bg-[#242424] border border-[#444444] rounded-xl text-xs text-[#F5F5F5] placeholder-[#666666] focus:outline-none focus:border-[#FFD43B]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#B8B8B8] mb-1">
              Subject
            </label>
            <input
              type="text"
              required
              value={composeSubject}
              onChange={(e) => setComposeSubject(e.target.value)}
              placeholder={`ROOMIE Flatmate Visit — ${currentUser.flatLocation.area}`}
              className="w-full px-3.5 py-2.5 bg-[#242424] border border-[#444444] rounded-xl text-xs text-[#F5F5F5] placeholder-[#666666] focus:outline-none focus:border-[#FFD43B]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#B8B8B8] mb-1">
              Message Body
            </label>
            <textarea
              rows={7}
              required
              value={composeBody}
              onChange={(e) => setComposeBody(e.target.value)}
              placeholder="Hi! I saw your profile on ROOMIE..."
              className="w-full px-3.5 py-2.5 bg-[#242424] border border-[#444444] rounded-xl text-xs text-[#F5F5F5] placeholder-[#666666] focus:outline-none focus:border-[#FFD43B]"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setActiveMode('inbox')}
              className="px-4 py-2.5 rounded-xl bg-[#383838] hover:bg-[#444444] text-xs font-semibold text-[#F5F5F5] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#FFD43B] hover:bg-[#ffe066] text-[#242424] text-xs font-bold shadow-md flex items-center gap-2 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Review &amp; Send Email</span>
            </button>
          </div>
        </form>
      )}

      {/* MANDATORY CONFIRMATION DIALOG FOR MUTATING / DESTRUCTIVE GMAIL ACTIONS */}
      {pendingConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#303030] border border-[#FFD43B] rounded-3xl p-6 shadow-2xl text-[#F5F5F5]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#FFD43B]/15 border border-[#FFD43B]/40 flex items-center justify-center text-[#FFD43B] shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#F5F5F5]">
                  {pendingConfirmation.type === 'send'
                    ? 'Confirm Sending Email'
                    : 'Move Email to Gmail Trash?'}
                </h3>
                <p className="text-[11px] text-[#B8B8B8]">
                  {pendingConfirmation.type === 'send'
                    ? 'This will send a real email from your connected Gmail account.'
                    : 'This will move the selected email thread into your Gmail Trash.'}
                </p>
              </div>
            </div>

            {pendingConfirmation.type === 'send' ? (
              <div className="bg-[#242424] border border-[#444444] rounded-2xl p-3.5 space-y-2 text-xs mb-5">
                <p className="truncate">
                  <span className="text-[#8e8e8e]">To: </span>
                  <span className="font-semibold text-[#FFD43B]">{pendingConfirmation.to}</span>
                </p>
                <p className="truncate">
                  <span className="text-[#8e8e8e]">Subject: </span>
                  <span className="font-semibold text-[#F5F5F5]">{pendingConfirmation.subject}</span>
                </p>
                <p className="text-[#B8B8B8] line-clamp-4 whitespace-pre-wrap pt-1 border-t border-[#383838]">
                  {pendingConfirmation.body}
                </p>
              </div>
            ) : (
              <div className="bg-[#242424] border border-[#444444] rounded-2xl p-3.5 space-y-1 text-xs mb-5">
                <p className="font-bold text-[#F5F5F5] truncate">
                  {pendingConfirmation.message.subject}
                </p>
                <p className="text-[11px] text-[#B8B8B8] truncate">
                  From: {pendingConfirmation.message.from}
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isMutating}
                onClick={() => setPendingConfirmation(null)}
                className="px-4 py-2.5 rounded-xl bg-[#383838] hover:bg-[#444444] text-xs font-semibold text-[#F5F5F5] cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isMutating}
                onClick={handleConfirmAction}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-60 ${
                  pendingConfirmation.type === 'trash'
                    ? 'bg-red-500 hover:bg-red-400 text-white'
                    : 'bg-[#FFD43B] hover:bg-[#ffe066] text-[#242424]'
                }`}
              >
                {isMutating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {pendingConfirmation.type === 'send'
                    ? isMutating
                      ? 'Sending...'
                      : 'Confirm & Send'
                    : isMutating
                    ? 'Moving...'
                    : 'Confirm Move to Trash'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
