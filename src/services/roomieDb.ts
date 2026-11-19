import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  writeBatch,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  CostBreakdown,
  FlatmateCandidate,
  FlatStatus,
  Gender,
  GroupMessage,
  IdentityVerificationInfo,
  LivingCircleId,
  PersonalityProfile,
  RoomieGroup,
  UserProfile,
} from '../types';
import {
  DEFAULT_COST_BREAKDOWN,
  DEFAULT_PERSONALITY,
  computeCostTotals,
  formatINR,
  isListingExpired,
} from '../utils/compatibility';
import {
  inferLivingCirclesFromTraits,
  sanitizeLivingCircles,
} from '../utils/livingCircles';

export interface FirestoreMatchRecord {
  matchId: string;
  userA: string;
  userB: string;
  initiatedBy: string;
  isSuper: boolean;
  status: 'active' | 'archived';
  lastMessage: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface FirestoreChatMessage {
  id: string;
  senderUid: string;
  userA: string;
  userB: string;
  text: string;
  createdAt?: Timestamp | null;
}

function clampStr(val: string, fallback: string, minLen: number, maxLen: number): string {
  const cleaned = (val || '').trim();
  if (cleaned.length < minLen) return fallback.slice(0, maxLen);
  return cleaned.slice(0, maxLen);
}

function clampList(
  arr: string[],
  fallback: string[],
  minItems: number,
  maxItems: number,
  maxItemLen: number
): string[] {
  const cleaned = (arr || [])
    .map((s) => (typeof s === 'string' ? s.trim().slice(0, maxItemLen) : ''))
    .filter((s) => s.length > 0)
    .slice(0, maxItems);
  if (cleaned.length < minItems) return fallback.slice(0, maxItems);
  return cleaned;
}

function clampNum(val: unknown, fallback: number, min: number, max: number): number {
  const n = typeof val === 'number' && Number.isFinite(val) ? Math.round(val) : fallback;
  return Math.max(min, Math.min(max, n));
}

function sanitizePersonality(p?: Partial<PersonalityProfile>): PersonalityProfile {
  return {
    vibe: clampStr(p?.vibe || '', DEFAULT_PERSONALITY.vibe, 2, 80),
    guestPolicy: clampStr(p?.guestPolicy || '', DEFAULT_PERSONALITY.guestPolicy, 2, 80),
    noiseTolerance: clampStr(p?.noiseTolerance || '', DEFAULT_PERSONALITY.noiseTolerance, 2, 80),
    conflictStyle: clampStr(p?.conflictStyle || '', DEFAULT_PERSONALITY.conflictStyle, 2, 80),
    choreStyle: clampStr(p?.choreStyle || '', DEFAULT_PERSONALITY.choreStyle, 2, 80),
  };
}

function sanitizeCostBreakdown(c?: Partial<CostBreakdown>, budgetFallback?: string): CostBreakdown {
  const totals = computeCostTotals(c, budgetFallback);
  return {
    monthlyRent: clampNum(c?.monthlyRent ?? totals.monthlyRent, 18000, 0, 500000),
    securityDeposit: clampNum(c?.securityDeposit ?? totals.securityDeposit, 40000, 0, 2000000),
    maintenanceFee: clampNum(c?.maintenanceFee ?? totals.maintenanceFee, 1800, 0, 100000),
    utilitiesEstimate: clampNum(c?.utilitiesEstimate ?? totals.utilitiesEstimate, 2800, 0, 100000),
    brokerageFee: clampNum(c?.brokerageFee ?? totals.brokerageFee, 0, 0, 500000),
    bhkType: clampStr(c?.bhkType || '', DEFAULT_COST_BREAKDOWN.bhkType, 2, 80),
  };
}

function sanitizeIdentityVerification(v?: Partial<IdentityVerificationInfo>): IdentityVerificationInfo {
  const method =
    v?.verificationMethod === 'selfie_liveness' ||
    v?.verificationMethod === 'gov_id_ai_check' ||
    v?.verificationMethod === 'workplace_id_ai_check'
      ? v.verificationMethod
      : 'google_only';
  return {
    identityVerified: Boolean(v?.identityVerified) && method !== 'google_only',
    verificationMethod: method,
    verifiedAt: v?.verifiedAt ? clampStr(v.verifiedAt, '', 0, 60) : '',
  };
}

export function computeExpiryIso(days: 7 | 14 | 30 = 14): string {
  const safeDays = days === 7 || days === 30 ? days : 14;
  return new Date(Date.now() + safeDays * 24 * 60 * 60 * 1000).toISOString();
}

export function getMatchId(uid1: string, uid2: string): { matchId: string; userA: string; userB: string } {
  const [userA, userB] = uid1 < uid2 ? [uid1, uid2] : [uid2, uid1];
  return {
    matchId: `${userA}_${userB}`,
    userA,
    userB,
  };
}

/**
 * Loads the signed-in user's public profile + private PII/safety info from Firestore.
 */
export async function loadUserProfileFromDb(uid: string): Promise<UserProfile | null> {
  const profilePath = `profiles/${uid}`;
  const privatePath = `users_private/${uid}`;
  try {
    const profileSnap = await getDoc(doc(db, 'profiles', uid));
    if (!profileSnap.exists()) {
      return null;
    }

    const pData = profileSnap.data();
    let email = '';
    let phone = '';
    let emergencyContact = '';
    let blockedUids: string[] = [];
    try {
      const privSnap = await getDoc(doc(db, 'users_private', uid));
      if (privSnap.exists()) {
        const privData = privSnap.data();
        email = typeof privData.email === 'string' ? privData.email : '';
        phone = typeof privData.phone === 'string' ? privData.phone : '';
        emergencyContact = typeof privData.emergencyContact === 'string' ? privData.emergencyContact : '';
        blockedUids = Array.isArray(privData.blockedUids) ? privData.blockedUids.map(String) : [];
      }
    } catch (privErr) {
      handleFirestoreError(privErr, OperationType.GET, privatePath);
    }

    const durationDays: 7 | 14 | 30 =
      pData.listingDurationDays === 7 || pData.listingDurationDays === 30
        ? pData.listingDurationDays
        : 14;

    const loadedPersonality = sanitizePersonality(pData.personality);
    const loadedSkills = Array.isArray(pData.skills) ? pData.skills.map(String) : [];
    const loadedBudget = String(pData.budget || '₹18,000 / mo');
    const explicitCircles = sanitizeLivingCircles(pData.livingCircles);
    const livingCircles =
      explicitCircles.length > 0
        ? explicitCircles
        : inferLivingCirclesFromTraits({
            profession: String(pData.profession || loadedSkills[0] || ''),
            skills: loadedSkills,
            bio: String(pData.bio || ''),
            budget: loadedBudget,
            workRoutine: String(pData.workRoutine || ''),
            noiseTolerance: loadedPersonality.noiseTolerance,
            vibe: loadedPersonality.vibe,
            guestPolicy: loadedPersonality.guestPolicy,
            cleanliness: String(pData.cleanliness || ''),
          });

    return {
      id: uid,
      name: String(pData.name || 'ROOMIE User'),
      email,
      phone,
      gender: (pData.gender as Gender) || 'male',
      preferredFlatmateGender: (pData.preferredFlatmateGender as 'male' | 'female' | 'any') || 'male',
      hasFlat: (pData.hasFlat as FlatStatus) || 'needs_flat',
      livingCircles,
      flatLocation: {
        city: String(pData.city || 'Bengaluru'),
        area: String(pData.area || 'Koramangala'),
      },
      budget: loadedBudget,
      skills: loadedSkills,
      hobbies: Array.isArray(pData.hobbies) ? pData.hobbies.map(String) : [],
      interests: Array.isArray(pData.interests) ? pData.interests.map(String) : [],
      lifestyle: {
        sleepSchedule: String(pData.sleepSchedule || '11:00 PM – 7:00 AM (Early Riser)'),
        kitchenDiet: String(pData.kitchenDiet || 'Vegetarian Friendly'),
        workRoutine: String(pData.workRoutine || 'Hybrid (WFH 2 days/week)'),
        cleanliness: String(pData.cleanliness || 'Daily kitchen cleanup & shared maid'),
        smoking: String(pData.smoking || 'Non-smoker'),
        pets: String(pData.pets || 'Friendly with pets'),
      },
      personality: loadedPersonality,
      costBreakdown: sanitizeCostBreakdown(pData.costBreakdown, String(pData.budget || '')),
      identityVerification: sanitizeIdentityVerification(pData.identityVerification),
      emergencyContact,
      blockedUids,
      listingDurationDays: durationDays,
      expiresAt:
        typeof pData.expiresAt === 'string' && pData.expiresAt.length >= 10
          ? pData.expiresAt
          : computeExpiryIso(durationDays),
      bio: String(pData.bio || ''),
      photos: Array.isArray(pData.photos) ? pData.photos.map(String) : [],
      flatPhotos: Array.isArray(pData.flatPhotos) ? pData.flatPhotos.map(String) : [],
      registeredAt:
        pData.createdAt instanceof Timestamp
          ? pData.createdAt.toDate().toISOString()
          : new Date().toISOString(),
    };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('{')) throw err;
    handleFirestoreError(err, OperationType.GET, profilePath);
  }
}

/**
 * Atomically saves or updates the user's public discovery profile and private PII/safety doc.
 */
export async function saveUserProfileToDb(user: UserProfile): Promise<void> {
  const uid = user.id;
  const profileRef = doc(db, 'profiles', uid);
  const privateRef = doc(db, 'users_private', uid);

  const sanitizedPhotos = (user.photos || [])
    .filter((p) => typeof p === 'string' && p.length >= 10 && p.length <= 345000)
    .slice(0, 2);

  if (sanitizedPhotos.length === 0) {
    throw new Error('A valid profile photo under 340KB is required to save your profile.');
  }

  const sanitizedFlatPhotos =
    user.hasFlat === 'has_flat'
      ? (user.flatPhotos || [])
          .filter((p) => typeof p === 'string' && p.length >= 10 && p.length <= 178000)
          .slice(0, 3)
      : [];

  const durationDays: 7 | 14 | 30 =
    user.listingDurationDays === 7 || user.listingDurationDays === 30 ? user.listingDurationDays : 14;
  const expiresAt =
    typeof user.expiresAt === 'string' && user.expiresAt.length >= 10
      ? user.expiresAt.slice(0, 40)
      : computeExpiryIso(durationDays);

  const costBreakdown = sanitizeCostBreakdown(user.costBreakdown, user.budget);
  const budgetLabel = user.budget?.trim()
    ? clampStr(user.budget, `${formatINR(costBreakdown.monthlyRent)} / mo`, 2, 40)
    : `${formatINR(costBreakdown.monthlyRent)} / mo`;

  const sanitizedCircles = sanitizeLivingCircles(user.livingCircles);
  const effectiveCircles =
    sanitizedCircles.length > 0
      ? sanitizedCircles
      : inferLivingCirclesFromTraits({
          profession: user.skills?.[0],
          skills: user.skills,
          bio: user.bio,
          budget: budgetLabel,
          monthlyRent: costBreakdown.monthlyRent,
          workRoutine: user.lifestyle?.workRoutine,
          noiseTolerance: user.personality?.noiseTolerance,
          vibe: user.personality?.vibe,
          guestPolicy: user.personality?.guestPolicy,
          cleanliness: user.lifestyle?.cleanliness,
        });

  const publicPayload = {
    uid,
    name: clampStr(user.name, 'ROOMIE User', 2, 80),
    age: 26,
    gender: user.gender || 'male',
    preferredFlatmateGender: user.preferredFlatmateGender || 'male',
    profession: clampStr(user.skills?.[0] || 'Urban Professional', 'Urban Professional', 1, 80),
    hasFlat: user.hasFlat || 'needs_flat',
    livingCircles: effectiveCircles,
    city: clampStr(user.flatLocation?.city, 'Bengaluru', 2, 60),
    area: clampStr(user.flatLocation?.area, 'Koramangala', 2, 100),
    budget: budgetLabel,
    photos: sanitizedPhotos,
    flatPhotos: sanitizedFlatPhotos,
    skills: clampList(user.skills, ['Software Engineering'], 1, 10, 60),
    hobbies: clampList(user.hobbies, ['Reading'], 0, 10, 60),
    interests: clampList(user.interests, ['Tech Startups'], 0, 10, 60),
    sleepSchedule: clampStr(user.lifestyle?.sleepSchedule, '11:00 PM – 7:00 AM', 2, 80),
    kitchenDiet: clampStr(user.lifestyle?.kitchenDiet, 'Vegetarian Friendly', 2, 80),
    workRoutine: clampStr(user.lifestyle?.workRoutine, 'Hybrid (WFH 2 days/week)', 2, 80),
    cleanliness: clampStr(user.lifestyle?.cleanliness, 'Daily cleanup', 2, 100),
    smoking: clampStr(user.lifestyle?.smoking, 'Non-smoker', 2, 50),
    pets: clampStr(user.lifestyle?.pets, 'Friendly with pets', 2, 50),
    personality: sanitizePersonality(user.personality),
    costBreakdown,
    identityVerification: sanitizeIdentityVerification(user.identityVerification),
    listingDurationDays: durationDays,
    expiresAt,
    bio: clampStr(user.bio, 'Looking for a compatible flatmate on ROOMIE.', 1, 500),
    isActive: true,
  };

  const privatePayload = {
    uid,
    email: clampStr(user.email, 'user@roomie.in', 3, 120),
    phone: clampStr(user.phone, '+91 90000 00000', 6, 25),
    emergencyContact: (user.emergencyContact || '').trim().slice(0, 40),
    blockedUids: clampList(user.blockedUids || [], [], 0, 50, 128),
  };

  let existingProfile;
  let existingPrivate;
  try {
    existingProfile = await getDoc(profileRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `profiles/${uid}`);
  }
  try {
    existingPrivate = await getDoc(privateRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `users_private/${uid}`);
  }

  const batch = writeBatch(db);

  if (!existingProfile.exists()) {
    batch.set(profileRef, {
      ...publicPayload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    const { uid: _omitUid, ...mutablePublicFields } = publicPayload;
    batch.update(profileRef, {
      ...mutablePublicFields,
      updatedAt: serverTimestamp(),
    });
  }

  if (!existingPrivate.exists()) {
    batch.set(privateRef, {
      ...privatePayload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    batch.update(privateRef, {
      email: privatePayload.email,
      phone: privatePayload.phone,
      emergencyContact: privatePayload.emergencyContact,
      blockedUids: privatePayload.blockedUids,
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `profiles/${uid}`);
  }
}

/**
 * Blocks a user privately so they are filtered out of discovery, picks, and matches.
 */
export async function blockUserInDb(currentUid: string, targetUid: string, currentBlocked: string[]): Promise<string[]> {
  const nextBlocked = Array.from(new Set([...currentBlocked, targetUid])).slice(0, 50);
  const privateRef = doc(db, 'users_private', currentUid);
  try {
    await updateDoc(privateRef, {
      blockedUids: nextBlocked,
      updatedAt: serverTimestamp(),
    });
    return nextBlocked;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users_private/${currentUid}`);
  }
}

/**
 * Updates the signed-in user's joined Living Circles in Firestore.
 */
export async function updateUserLivingCirclesInDb(
  uid: string,
  circles: LivingCircleId[]
): Promise<LivingCircleId[]> {
  const sanitized = sanitizeLivingCircles(circles);
  const profileRef = doc(db, 'profiles', uid);
  try {
    await updateDoc(profileRef, {
      livingCircles: sanitized,
      updatedAt: serverTimestamp(),
    });
    return sanitized;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `profiles/${uid}`);
  }
}

/**
 * Files an immutable safety report on a suspicious or abusive profile.
 */
export async function submitSafetyReport(
  reporterUid: string,
  reportedUid: string,
  reason: string,
  details: string
): Promise<void> {
  const reportId = `rep_${reporterUid.slice(0, 12)}_${reportedUid.slice(0, 12)}_${Date.now()}`;
  const reportRef = doc(db, 'reports', reportId);
  try {
    await setDoc(reportRef, {
      reporterUid,
      reportedUid,
      reason: clampStr(reason, 'Safety concern', 2, 100),
      details: (details || '').trim().slice(0, 500),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `reports/${reportId}`);
  }
}

/**
 * Real-time subscription to all active flatmate profiles in Firestore.
 */
export function subscribeToCommunityProfiles(
  onUpdate: (candidates: FlatmateCandidate[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'profiles';
  const q = query(collection(db, path), where('isActive', '==', true));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: FlatmateCandidate[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        const costBreakdown = sanitizeCostBreakdown(d.costBreakdown, String(d.budget || ''));
        const personality = sanitizePersonality(d.personality);
        const identityVerification = sanitizeIdentityVerification(d.identityVerification);
        const durationDays: 7 | 14 | 30 =
          d.listingDurationDays === 7 || d.listingDurationDays === 30 ? d.listingDurationDays : 14;

        const explicitCircles = sanitizeLivingCircles(d.livingCircles);
        const skillsList = Array.isArray(d.skills) ? d.skills.map(String) : [];
        const budgetText = String(d.budget || '₹18,000 / mo');
        const livingCircles =
          explicitCircles.length > 0
            ? explicitCircles
            : inferLivingCirclesFromTraits({
                profession: String(d.profession || skillsList[0] || ''),
                skills: skillsList,
                bio: String(d.bio || ''),
                budget: budgetText,
                monthlyRent: costBreakdown.monthlyRent,
                workRoutine: String(d.workRoutine || ''),
                noiseTolerance: personality.noiseTolerance,
                vibe: personality.vibe,
                guestPolicy: personality.guestPolicy,
                cleanliness: String(d.cleanliness || ''),
              });

        return {
          id: docSnap.id,
          name: String(d.name || 'Flatmate'),
          age: typeof d.age === 'number' ? d.age : 26,
          gender: (d.gender as Gender) || 'male',
          profession: String(d.profession || 'Urban Professional'),
          hasFlat: (d.hasFlat as FlatStatus) || 'needs_flat',
          livingCircles,
          city: String(d.city || 'Bengaluru'),
          area: String(d.area || 'Koramangala'),
          budget: budgetText,
          photos: Array.isArray(d.photos) ? d.photos.map(String) : [],
          flatPhotos: Array.isArray(d.flatPhotos) ? d.flatPhotos.map(String) : [],
          skills: skillsList,
          hobbies: Array.isArray(d.hobbies) ? d.hobbies.map(String) : [],
          interests: Array.isArray(d.interests) ? d.interests.map(String) : [],
          bio: String(d.bio || ''),
          lifestyle: {
            sleepSchedule: String(d.sleepSchedule || ''),
            kitchenDiet: String(d.kitchenDiet || ''),
            workRoutine: String(d.workRoutine || ''),
            cleanliness: String(d.cleanliness || ''),
            smoking: String(d.smoking || 'Non-smoker'),
            pets: String(d.pets || 'Friendly with pets'),
          },
          personality,
          costBreakdown,
          identityVerification,
          listingDurationDays: durationDays,
          expiresAt: typeof d.expiresAt === 'string' ? d.expiresAt : undefined,
          flatDetails:
            d.hasFlat === 'has_flat'
              ? {
                  bhk: costBreakdown.bhkType || '2/3 BHK Apartment',
                  deposit: formatINR(costBreakdown.securityDeposit),
                  amenities: ['Power Backup', 'Wi-Fi 300 Mbps', 'Washing Machine', 'Daily Housekeeper'],
                }
              : undefined,
        };
      });
      onUpdate(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) onError(wrapped);
      }
    }
  );
}

/**
 * Records a user's swipe action and creates a real match document in Firestore.
 */
export async function recordSwipeAndConnect(
  fromUid: string,
  targetCandidate: FlatmateCandidate,
  action: 'like' | 'super' | 'pass'
): Promise<FirestoreMatchRecord | null> {
  if (!fromUid || !targetCandidate.id || fromUid === targetCandidate.id) return null;

  const swipeId = `${fromUid}_${targetCandidate.id}`;
  const swipeRef = doc(db, 'swipes', swipeId);

  try {
    const existingSwipe = await getDoc(swipeRef);
    const batch = writeBatch(db);
    let hasWrites = false;

    if (!existingSwipe.exists()) {
      batch.set(swipeRef, {
        fromUid,
        toUid: targetCandidate.id,
        action,
        createdAt: serverTimestamp(),
      });
      hasWrites = true;
    }

    let resultMatch: FirestoreMatchRecord | null = null;
    if (action === 'like' || action === 'super') {
      const { matchId, userA, userB } = getMatchId(fromUid, targetCandidate.id);
      const matchRef = doc(db, 'matches', matchId);
      const existingMatch = await getDoc(matchRef);

      if (!existingMatch.exists()) {
        const newMatchData = {
          matchId,
          userA,
          userB,
          initiatedBy: fromUid,
          isSuper: action === 'super',
          status: 'active' as const,
          lastMessage: '',
        };
        batch.set(matchRef, {
          ...newMatchData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        hasWrites = true;
        resultMatch = newMatchData;
      } else {
        resultMatch = existingMatch.data() as FirestoreMatchRecord;
      }
    }

    if (hasWrites) {
      await batch.commit();
    }
    return resultMatch;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `swipes/${swipeId}`);
  }
}

/**
 * Subscribes in real time to all matches where the signed-in user is userA or userB.
 */
export function subscribeToUserMatches(
  uid: string,
  onUpdate: (matches: FirestoreMatchRecord[]) => void
): Unsubscribe {
  const matchesMapA = new Map<string, FirestoreMatchRecord>();
  const matchesMapB = new Map<string, FirestoreMatchRecord>();

  const emitMerged = () => {
    const merged = new Map<string, FirestoreMatchRecord>([...matchesMapA, ...matchesMapB]);
    const list = Array.from(merged.values()).sort((a, b) => {
      const timeA = a.updatedAt?.toMillis?.() ?? 0;
      const timeB = b.updatedAt?.toMillis?.() ?? 0;
      return timeB - timeA;
    });
    onUpdate(list);
  };

  const qA = query(collection(db, 'matches'), where('userA', '==', uid));
  const qB = query(collection(db, 'matches'), where('userB', '==', uid));

  const unsubA = onSnapshot(
    qA,
    (snap) => {
      matchesMapA.clear();
      snap.docs.forEach((d) => {
        matchesMapA.set(d.id, d.data() as FirestoreMatchRecord);
      });
      emitMerged();
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'matches');
    }
  );

  const unsubB = onSnapshot(
    qB,
    (snap) => {
      matchesMapB.clear();
      snap.docs.forEach((d) => {
        matchesMapB.set(d.id, d.data() as FirestoreMatchRecord);
      });
      emitMerged();
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'matches');
    }
  );

  return () => {
    unsubA();
    unsubB();
  };
}

/**
 * Real-time subscription to chat messages inside a match conversation.
 */
export function subscribeToMatchMessages(
  matchId: string,
  currentUid: string,
  userA: string,
  _userB: string,
  onUpdate: (messages: FirestoreChatMessage[]) => void
): Unsubscribe {
  const path = `matches/${matchId}/messages`;
  const participantField = currentUid === userA ? 'userA' : 'userB';
  const q = query(collection(db, 'matches', matchId, 'messages'), where(participantField, '==', currentUid));

  return onSnapshot(
    q,
    (snap) => {
      const msgs: FirestoreChatMessage[] = snap.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as Omit<FirestoreChatMessage, 'id'>),
        }))
        .sort((a, b) => {
          const tA = a.createdAt?.toMillis?.() ?? Date.now();
          const tB = b.createdAt?.toMillis?.() ?? Date.now();
          return tA - tB;
        });
      onUpdate(msgs);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

/**
 * Atomically sends a real-time chat message and updates the parent match's lastMessage preview.
 */
export async function sendMatchMessage(
  matchId: string,
  senderUid: string,
  userA: string,
  userB: string,
  text: string
): Promise<void> {
  const trimmed = text.trim().slice(0, 1000);
  if (!trimmed) return;

  const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const msgRef = doc(db, 'matches', matchId, 'messages', messageId);
  const matchRef = doc(db, 'matches', matchId);

  const batch = writeBatch(db);
  batch.set(msgRef, {
    senderUid,
    userA,
    userB,
    text: trimmed,
    createdAt: serverTimestamp(),
  });
  batch.update(matchRef, {
    lastMessage: trimmed.slice(0, 500),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `matches/${matchId}/messages/${messageId}`);
  }
}

// ==================== GROUP MATCHING (CONNECTED DUO SEEKING +1) ====================

/**
 * Teams up two connected flatmates into a visible Duo Group seeking 1 more compatible flatmate.
 */
export async function createDuoGroup(
  currentUser: UserProfile,
  partner: FlatmateCandidate,
  details: {
    area?: string;
    city?: string;
    bhkType?: string;
    budgetPerPerson?: string;
    bio?: string;
  }
): Promise<RoomieGroup> {
  const { matchId } = getMatchId(currentUser.id, partner.id);
  const groupId = `grp_${matchId}`;
  const groupRef = doc(db, 'groups', groupId);

  const memberPhotos = [currentUser.photos?.[0], partner.photos?.[0]]
    .filter((p): p is string => typeof p === 'string' && p.length >= 10 && p.length <= 345000)
    .slice(0, 2);

  if (memberPhotos.length === 0) {
    throw new Error('At least one profile photo is required to form a group.');
  }

  const hasFlat: FlatStatus =
    currentUser.hasFlat === 'has_flat' || partner.hasFlat === 'has_flat' ? 'has_flat' : 'needs_flat';

  const combinedFlatPhotos = [
    ...(currentUser.flatPhotos || []),
    ...(partner.flatPhotos || []),
  ]
    .filter((p) => typeof p === 'string' && p.length >= 10 && p.length <= 178000)
    .slice(0, 3);

  const city = clampStr(details.city || currentUser.flatLocation.city, 'Bengaluru', 2, 60);
  const area = clampStr(details.area || currentUser.flatLocation.area, 'Koramangala', 2, 100);
  const bhkType = clampStr(details.bhkType || '3 BHK · Seeking 3rd Flatmate', '3 BHK · Seeking 3rd Flatmate', 2, 80);
  const budgetPerPerson = clampStr(details.budgetPerPerson || currentUser.budget, '₹16,000 / mo', 2, 40);
  const costBreakdown = sanitizeCostBreakdown(
    { ...currentUser.costBreakdown, bhkType },
    budgetPerPerson
  );
  const expiresAt = computeExpiryIso(14);

  const groupGender: RoomieGroup['gender'] =
    currentUser.gender === partner.gender ? currentUser.gender : 'mixed';

  const vibeSummary = clampStr(
    `${currentUser.personality?.vibe.split('·')[0].trim() || 'Ambivert'} Duo · ${currentUser.lifestyle.kitchenDiet}`,
    'Friendly Duo · Clean & Respectful',
    2,
    120
  );

  const bio = clampStr(
    details.bio ||
      `${currentUser.name} and ${partner.name} are already connected in ${area}, ${city} and need 1 more flatmate for a ${bhkType}!`,
    `${currentUser.name} & ${partner.name} teamed up and need 1 more flatmate.`,
    1,
    500
  );

  const payload = {
    groupId,
    sourceMatchId: matchId,
    createdBy: currentUser.id,
    partnerUid: partner.id,
    memberUids: [currentUser.id, partner.id],
    memberNames: [
      clampStr(currentUser.name, 'Roomie 1', 1, 80),
      clampStr(partner.name, 'Roomie 2', 1, 80),
    ],
    memberPhotos,
    gender: groupGender,
    city,
    area,
    hasFlat,
    budgetPerPerson,
    bhkType,
    targetSize: 3,
    openSpots: 1,
    bio,
    vibeSummary,
    flatPhotos: combinedFlatPhotos,
    costBreakdown,
    status: 'seeking' as const,
    expiresAt,
  };

  try {
    const existingSnap = await getDoc(groupRef);
    if (!existingSnap.exists()) {
      await setDoc(groupRef, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return {
        ...payload,
        createdAt: new Date().toISOString(),
      };
    }

    const existingData = existingSnap.data();
    await updateDoc(groupRef, {
      status: 'seeking',
      openSpots: 1,
      city,
      area,
      hasFlat,
      budgetPerPerson,
      bhkType,
      bio,
      vibeSummary,
      flatPhotos: combinedFlatPhotos,
      costBreakdown,
      expiresAt,
      updatedAt: serverTimestamp(),
    });
    return {
      ...payload,
      createdBy: String(existingData.createdBy || currentUser.id),
      partnerUid: String(existingData.partnerUid || partner.id),
      memberUids: Array.isArray(existingData.memberUids)
        ? existingData.memberUids.map(String)
        : payload.memberUids,
      memberNames: Array.isArray(existingData.memberNames)
        ? existingData.memberNames.map(String)
        : payload.memberNames,
      memberPhotos: Array.isArray(existingData.memberPhotos)
        ? existingData.memberPhotos.map(String)
        : payload.memberPhotos,
      createdAt:
        existingData.createdAt instanceof Timestamp
          ? existingData.createdAt.toDate().toISOString()
          : new Date().toISOString(),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `groups/${groupId}`);
  }
}

/**
 * Real-time subscription to active Duo Groups seeking a 3rd flatmate (plus groups user belongs to).
 */
export function subscribeToSeekingGroups(
  onUpdate: (groups: RoomieGroup[]) => void
): Unsubscribe {
  const q = query(collection(db, 'groups'), where('status', '==', 'seeking'));
  return onSnapshot(
    q,
    (snap) => {
      const list: RoomieGroup[] = snap.docs
        .map((d) => {
          const g = d.data();
          return {
            groupId: d.id,
            sourceMatchId: String(g.sourceMatchId || ''),
            createdBy: String(g.createdBy || ''),
            partnerUid: String(g.partnerUid || ''),
            memberUids: Array.isArray(g.memberUids) ? g.memberUids.map(String) : [],
            memberNames: Array.isArray(g.memberNames) ? g.memberNames.map(String) : [],
            memberPhotos: Array.isArray(g.memberPhotos) ? g.memberPhotos.map(String) : [],
            gender: (g.gender as RoomieGroup['gender']) || 'mixed',
            city: String(g.city || 'Bengaluru'),
            area: String(g.area || ''),
            hasFlat: (g.hasFlat as FlatStatus) || 'needs_flat',
            budgetPerPerson: String(g.budgetPerPerson || '₹16,000 / mo'),
            bhkType: String(g.bhkType || '3 BHK'),
            targetSize: typeof g.targetSize === 'number' ? g.targetSize : 3,
            openSpots: typeof g.openSpots === 'number' ? g.openSpots : 1,
            bio: String(g.bio || ''),
            vibeSummary: String(g.vibeSummary || ''),
            flatPhotos: Array.isArray(g.flatPhotos) ? g.flatPhotos.map(String) : [],
            costBreakdown: g.costBreakdown ? sanitizeCostBreakdown(g.costBreakdown, String(g.budgetPerPerson || '')) : undefined,
            status: (g.status as RoomieGroup['status']) || 'seeking',
            expiresAt: String(g.expiresAt || computeExpiryIso(14)),
            createdAt:
              g.createdAt instanceof Timestamp ? g.createdAt.toDate().toISOString() : undefined,
          };
        })
        .filter((g) => !isListingExpired(g.expiresAt));
      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'groups');
    }
  );
}

/**
 * Records a 3rd user clicking "I'm Interested" on a Duo Group to unlock group chat.
 */
export async function recordGroupInterestAndUnlock(
  group: RoomieGroup,
  requester: UserProfile
): Promise<void> {
  const interestRef = doc(db, 'groups', group.groupId, 'interests', requester.id);
  try {
    const snap = await getDoc(interestRef);
    if (!snap.exists()) {
      await setDoc(interestRef, {
        uid: requester.id,
        groupId: group.groupId,
        requesterName: clampStr(requester.name, 'Roomie', 2, 80),
        groupMemberUids: group.memberUids.slice(0, 3),
        createdAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `groups/${group.groupId}/interests/${requester.id}`);
  }
}

/**
 * Checks whether the current user has already unlocked interest in a specific group.
 */
export async function checkUserGroupInterest(groupId: string, uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'groups', groupId, 'interests', uid));
    return snap.exists();
  } catch {
    return false;
  }
}

/**
 * Subscribes to interested requesters for a Duo Group.
 */
export function subscribeToGroupInterests(
  groupId: string,
  memberUid: string,
  onUpdate: (interests: Array<{ uid: string; requesterName: string }>) => void
): Unsubscribe {
  const q = query(
    collection(db, 'groups', groupId, 'interests'),
    where('groupMemberUids', 'array-contains', memberUid)
  );
  return onSnapshot(
    q,
    (snap) => {
      onUpdate(
        snap.docs.map((d) => ({
          uid: String(d.data().uid || d.id),
          requesterName: String(d.data().requesterName || 'Flatmate'),
        }))
      );
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, `groups/${groupId}/interests`);
    }
  );
}

/**
 * Real-time subscription to messages inside a Duo Group chat.
 */
export function subscribeToGroupMessages(
  groupId: string,
  currentUid: string,
  onUpdate: (messages: GroupMessage[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'groups', groupId, 'messages'),
    where('visibleToUids', 'array-contains', currentUid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: GroupMessage[] = snap.docs
        .map((d) => ({
          id: d.id,
          senderUid: String(d.data().senderUid || ''),
          senderName: String(d.data().senderName || 'Roomie'),
          visibleToUids: Array.isArray(d.data().visibleToUids)
            ? d.data().visibleToUids.map(String)
            : [],
          text: String(d.data().text || ''),
          createdAt: d.data().createdAt as Timestamp | null | undefined,
        }))
        .sort((a, b) => {
          const tA = a.createdAt?.toMillis?.() ?? Date.now();
          const tB = b.createdAt?.toMillis?.() ?? Date.now();
          return tA - tB;
        });
      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, `groups/${groupId}/messages`);
    }
  );
}

/**
 * Sends a message inside a Group Chat visible to group members and the interested flatmate(s).
 */
export async function sendGroupMessage(
  groupId: string,
  sender: UserProfile,
  visibleToUids: string[],
  text: string
): Promise<void> {
  const trimmed = text.trim().slice(0, 1000);
  if (!trimmed) return;
  const participants = Array.from(new Set([...visibleToUids, sender.id])).slice(0, 6);
  if (participants.length < 2) return;

  const messageId = `gmsg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const msgRef = doc(db, 'groups', groupId, 'messages', messageId);

  try {
    await setDoc(msgRef, {
      senderUid: sender.id,
      senderName: clampStr(sender.name, 'Roomie', 1, 80),
      visibleToUids: participants,
      text: trimmed,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `groups/${groupId}/messages/${messageId}`);
  }
}

/**
 * Updates a Duo Group status (e.g. 'full' once the 3rd flatmate is found, or renews expiry).
 */
export async function updateGroupStatus(
  groupId: string,
  status: 'seeking' | 'full' | 'archived'
): Promise<void> {
  try {
    await updateDoc(doc(db, 'groups', groupId), {
      status,
      openSpots: status === 'seeking' ? 1 : 0,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `groups/${groupId}`);
  }
}
