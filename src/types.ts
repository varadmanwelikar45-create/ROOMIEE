export type Gender = 'male' | 'female' | 'other';
export type FlatStatus = 'has_flat' | 'needs_flat';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  gender: Gender;
  preferredFlatmateGender: 'male' | 'female' | 'any';
  hasFlat: FlatStatus; // 'has_flat' (Yes) or 'needs_flat' (No)
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
  compatibilityScore?: number;
  flatDetails?: {
    bhk: string; // "2 BHK" or "3 BHK"
    deposit: string; // "₹50,000"
    amenities: string[];
  };
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
