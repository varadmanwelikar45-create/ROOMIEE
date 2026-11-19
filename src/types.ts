export type Gender = 'male' | 'female' | 'other';
export type FlatStatus = 'has_flat' | 'needs_flat';
export type LivingCircleId =
  | 'college_students'
  | 'it_professionals'
  | 'budget_living'
  | 'peaceful_living';

export type VerificationMethod =
  | 'google_only'
  | 'selfie_liveness'
  | 'gov_id_ai_check'
  | 'workplace_id_ai_check';

export interface IdentityVerificationInfo {
  identityVerified: boolean;
  verificationMethod: VerificationMethod;
  verifiedAt?: string;
}

export interface PersonalityProfile {
  vibe: string; // e.g. 'Ambivert · Balanced Social'
  guestPolicy: string; // e.g. 'Occasional Guests (Inform First)'
  noiseTolerance: string; // e.g. 'Moderate Ambient'
  conflictStyle: string; // e.g. 'Direct & Calm Conversation'
  choreStyle: string; // e.g. 'Shared Maid + Weekend Tidy'
}

export interface CostBreakdown {
  monthlyRent: number;
  securityDeposit: number;
  maintenanceFee: number;
  utilitiesEstimate: number;
  brokerageFee: number;
  bhkType: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  gender: Gender;
  preferredFlatmateGender: 'male' | 'female' | 'any';
  hasFlat: FlatStatus; // 'has_flat' (Yes) or 'needs_flat' (No)
  livingCircles?: LivingCircleId[];
  flatLocation: {
    city: string; // e.g. "Bengaluru"
    area: string; // e.g. "Koramangala 4th Block"
    landmark?: string;
  };
  budget: string; // e.g. "₹18,000 / mo"
  skills: string[];
  hobbies: string[];
  interests: string[];
  lifestyle: {
    sleepSchedule: string;
    kitchenDiet: string;
    workRoutine: string;
    cleanliness: string;
    smoking: string;
    pets: string;
  };
  personality: PersonalityProfile;
  costBreakdown: CostBreakdown;
  identityVerification: IdentityVerificationInfo;
  emergencyContact?: string;
  blockedUids?: string[];
  listingDurationDays: 7 | 14 | 30;
  expiresAt: string;
  bio: string;
  photos: string[];
  flatPhotos?: string[];
  registeredAt: string;
}

export interface FlatmateCandidate {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  profession: string;
  hasFlat: FlatStatus; // 'has_flat' or 'needs_flat'
  livingCircles?: LivingCircleId[];
  city: string;
  area: string;
  budget: string;
  photos: string[];
  flatPhotos?: string[];
  skills: string[];
  hobbies: string[];
  interests: string[];
  bio: string;
  lifestyle: {
    sleepSchedule: string;
    kitchenDiet: string;
    workRoutine: string;
    cleanliness: string;
    smoking: string;
    pets: string;
  };
  personality?: PersonalityProfile;
  costBreakdown?: CostBreakdown;
  identityVerification?: IdentityVerificationInfo;
  listingDurationDays?: 7 | 14 | 30;
  expiresAt?: string;
  compatibilityScore?: number;
  matchReasons?: string[];
  flatDetails?: {
    bhk: string; // "2 BHK" or "3 BHK"
    deposit: string; // "₹50,000"
    amenities: string[];
  };
}

export interface RoomieGroup {
  groupId: string;
  sourceMatchId: string;
  createdBy: string;
  partnerUid: string;
  memberUids: string[];
  memberNames: string[];
  memberPhotos: string[];
  gender: Gender | 'mixed';
  city: string;
  area: string;
  hasFlat: FlatStatus;
  budgetPerPerson: string;
  bhkType: string;
  targetSize: number;
  openSpots: number;
  bio: string;
  vibeSummary: string;
  flatPhotos: string[];
  costBreakdown?: CostBreakdown;
  status: 'seeking' | 'full' | 'archived';
  expiresAt: string;
  createdAt?: string;
}

export interface GroupMessage {
  id: string;
  senderUid: string;
  senderName: string;
  visibleToUids: string[];
  text: string;
  createdAt?: import('firebase/firestore').Timestamp | null;
}

export interface MatchChat {
  id: string;
  flatmateId: string;
  flatmateName: string;
  flatmatePhoto: string;
  flatmateArea: string;
  lastMessage: string;
  timestamp: string;
  unread: boolean;
}
