import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  writeBatch,
  serverTimestamp,
  Timestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { FlatmateCandidate, Gender, FlatStatus, UserProfile } from '../types';

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

function clampList(arr: string[], fallback: string[], minItems: number, maxItems: number, maxItemLen: number): string[] {
  const cleaned = (arr || [])
    .map((s) => (typeof s === 'string' ? s.trim().slice(0, maxItemLen) : ''))
    .filter((s) => s.length > 0)
    .slice(0, maxItems);
  if (cleaned.length < minItems) return fallback.slice(0, maxItems);
  return cleaned;
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
 * Loads the signed-in user's public profile + private PII info from Firestore.
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
    try {
      const privSnap = await getDoc(doc(db, 'users_private', uid));
      if (privSnap.exists()) {
        const privData = privSnap.data();
        email = typeof privData.email === 'string' ? privData.email : '';
        phone = typeof privData.phone === 'string' ? privData.phone : '';
      }
    } catch (privErr) {
      handleFirestoreError(privErr, OperationType.GET, privatePath);
    }

    return {
      id: uid,
      name: String(pData.name || 'ROOMIE User'),
      email,
      phone,
      gender: (pData.gender as Gender) || 'male',
      preferredFlatmateGender: (pData.preferredFlatmateGender as 'male' | 'female' | 'any') || 'male',
      hasFlat: (pData.hasFlat as FlatStatus) || 'needs_flat',
      flatLocation: {
        city: String(pData.city || 'Bengaluru'),
        area: String(pData.area || 'Koramangala'),
      },
      budget: String(pData.budget || '₹18,000 / mo'),
      skills: Array.isArray(pData.skills) ? pData.skills.map(String) : [],
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
 * Atomically saves or updates the user's public discovery profile and private PII contact doc.
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

  const publicPayload = {
    uid,
    name: clampStr(user.name, 'ROOMIE User', 2, 80),
    age: 26,
    gender: user.gender || 'male',
    preferredFlatmateGender: user.preferredFlatmateGender || 'male',
    profession: clampStr(user.skills?.[0] || 'Urban Professional', 'Urban Professional', 1, 80),
    hasFlat: user.hasFlat || 'needs_flat',
    city: clampStr(user.flatLocation?.city, 'Bengaluru', 2, 60),
    area: clampStr(user.flatLocation?.area, 'Koramangala', 2, 100),
    budget: clampStr(user.budget, '₹18,000 / mo', 2, 40),
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
    bio: clampStr(user.bio, 'Looking for a compatible flatmate on ROOMIE.', 1, 500),
    isActive: true,
  };

  const privatePayload = {
    uid,
    email: clampStr(user.email, 'user@roomie.in', 3, 120),
    phone: clampStr(user.phone, '+91 90000 00000', 6, 25),
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
 * Real-time subscription to all active flatmate profiles in Firestore so every
 * registered user can see all other registered users across devices.
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
        return {
          id: docSnap.id,
          name: String(d.name || 'Flatmate'),
          age: typeof d.age === 'number' ? d.age : 26,
          gender: (d.gender as Gender) || 'male',
          profession: String(d.profession || 'Urban Professional'),
          hasFlat: (d.hasFlat as FlatStatus) || 'needs_flat',
          city: String(d.city || 'Bengaluru'),
          area: String(d.area || 'Koramangala'),
          budget: String(d.budget || '₹18,000 / mo'),
          photos: Array.isArray(d.photos) ? d.photos.map(String) : [],
          flatPhotos: Array.isArray(d.flatPhotos) ? d.flatPhotos.map(String) : [],
          skills: Array.isArray(d.skills) ? d.skills.map(String) : [],
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
          compatibilityScore: 94,
          flatDetails:
            d.hasFlat === 'has_flat'
              ? {
                  bhk: '2/3 BHK Apartment',
                  deposit: '₹50,000',
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
 * Records a user's swipe action and creates a real match document in Firestore
 * when liking or super-connecting so both users appear in each other's Matches tab.
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
