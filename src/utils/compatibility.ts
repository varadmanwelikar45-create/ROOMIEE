import { CostBreakdown, FlatmateCandidate, PersonalityProfile, RoomieGroup, UserProfile } from '../types';
import { getEffectiveLivingCircles, getLivingCircleMeta } from './livingCircles';

export const DEFAULT_PERSONALITY: PersonalityProfile = {
  vibe: 'Ambivert · Balanced Social',
  guestPolicy: 'Occasional Guests (Inform First)',
  noiseTolerance: 'Moderate Ambient',
  conflictStyle: 'Direct & Calm Conversation',
  choreStyle: 'Shared Maid + Weekend Tidy',
};

export const DEFAULT_COST_BREAKDOWN: CostBreakdown = {
  monthlyRent: 18000,
  securityDeposit: 50000,
  maintenanceFee: 2000,
  utilitiesEstimate: 3000,
  brokerageFee: 0,
  bhkType: '2 / 3 BHK Shared Flat',
};

export function parseBudgetMonthly(budgetStr: string): number {
  const digits = (budgetStr || '').replace(/[^0-9]/g, '');
  const num = Number.parseInt(digits, 10);
  return Number.isFinite(num) && num >= 2000 ? num : 18000;
}

export function formatINR(amount: number): string {
  const safe = Math.max(0, Math.round(Number.isFinite(amount) ? amount : 0));
  return `₹${safe.toLocaleString('en-IN')}`;
}

export function computeCostTotals(cb?: Partial<CostBreakdown>, fallbackBudget?: string) {
  const monthlyRent =
    typeof cb?.monthlyRent === 'number' && cb.monthlyRent > 0
      ? cb.monthlyRent
      : parseBudgetMonthly(fallbackBudget || '');
  const securityDeposit =
    typeof cb?.securityDeposit === 'number' && cb.securityDeposit >= 0 ? cb.securityDeposit : monthlyRent * 2;
  const maintenanceFee =
    typeof cb?.maintenanceFee === 'number' && cb.maintenanceFee >= 0 ? cb.maintenanceFee : 1800;
  const utilitiesEstimate =
    typeof cb?.utilitiesEstimate === 'number' && cb.utilitiesEstimate >= 0 ? cb.utilitiesEstimate : 2800;
  const brokerageFee =
    typeof cb?.brokerageFee === 'number' && cb.brokerageFee >= 0 ? cb.brokerageFee : 0;

  const totalMonthly = monthlyRent + maintenanceFee + utilitiesEstimate;
  const moveInUpfront = monthlyRent + maintenanceFee + securityDeposit + brokerageFee;

  return {
    monthlyRent,
    securityDeposit,
    maintenanceFee,
    utilitiesEstimate,
    brokerageFee,
    totalMonthly,
    moveInUpfront,
    bhkType: cb?.bhkType || DEFAULT_COST_BREAKDOWN.bhkType,
  };
}

/**
 * Checks whether a profile or group listing has passed its automatic expiry timestamp.
 */
export function isListingExpired(expiresAt?: string): boolean {
  if (!expiresAt) return false;
  const ms = Date.parse(expiresAt);
  if (!Number.isFinite(ms)) return false;
  return Date.now() > ms;
}

/**
 * Computes human-readable expiry countdown for UI badges and renewal prompts.
 */
export function getListingExpiryStatus(expiresAt?: string): {
  expired: boolean;
  daysLeft: number;
  hoursLeft: number;
  label: string;
  expiringSoon: boolean;
} {
  if (!expiresAt) {
    return { expired: false, daysLeft: 14, hoursLeft: 336, label: 'Active · 14d left', expiringSoon: false };
  }
  const ms = Date.parse(expiresAt);
  if (!Number.isFinite(ms)) {
    return { expired: false, daysLeft: 14, hoursLeft: 336, label: 'Active', expiringSoon: false };
  }
  const diff = ms - Date.now();
  if (diff <= 0) {
    return { expired: true, daysLeft: 0, hoursLeft: 0, label: 'Expired · Hidden from circles', expiringSoon: true };
  }
  const hoursLeft = Math.ceil(diff / (1000 * 60 * 60));
  const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (hoursLeft <= 48) {
    return {
      expired: false,
      daysLeft,
      hoursLeft,
      label: `Expires in ${hoursLeft}h`,
      expiringSoon: true,
    };
  }
  return {
    expired: false,
    daysLeft,
    hoursLeft,
    label: `Auto-expires in ${daysLeft}d`,
    expiringSoon: false,
  };
}

/**
 * Computes deterministic personality + lifestyle + location + budget + living circle compatibility (60-99%)
 * plus concrete human-readable reasons explaining WHY two flatmates match.
 */
export function computeCompatibility(
  currentUser: UserProfile | null,
  candidate: FlatmateCandidate
): { score: number; reasons: string[] } {
  if (!currentUser) {
    return { score: 88, reasons: ['Verified ROOMIE Profile'] };
  }

  let score = 56;
  const reasons: string[] = [];

  // 0. Shared Living Circles boost
  const myCircles = getEffectiveLivingCircles(currentUser);
  const candCircles = getEffectiveLivingCircles(candidate);
  const sharedCircles = candCircles.filter((c) => myCircles.includes(c));
  if (sharedCircles.length > 0) {
    score += Math.min(8, sharedCircles.length * 4);
    const firstCircle = getLivingCircleMeta(sharedCircles[0]);
    reasons.push(`${firstCircle.emoji} ${firstCircle.name} circle`);
  }

  // 1. Complementary flat status (+10 if one has flat & one needs flat)
  if (currentUser.hasFlat !== candidate.hasFlat) {
    score += 10;
    reasons.push(
      candidate.hasFlat === 'has_flat'
        ? 'Has flat matching your search'
        : 'Seeking flatmate for your flat'
    );
  } else {
    score += 4;
  }

  // 2. City & Area proximity
  if (currentUser.flatLocation.city.toLowerCase() === candidate.city.toLowerCase()) {
    score += 6;
    if (
      currentUser.flatLocation.area.toLowerCase().includes(candidate.area.toLowerCase().split(' ')[0]) ||
      candidate.area.toLowerCase().includes(currentUser.flatLocation.area.toLowerCase().split(' ')[0])
    ) {
      score += 6;
      reasons.push(`Same locality (${candidate.area})`);
    }
  }

  // 3. Personality matching (Vibe, Guests, Noise, Conflict, Chores)
  const myP = currentUser.personality || DEFAULT_PERSONALITY;
  const candP = candidate.personality || DEFAULT_PERSONALITY;

  if (myP.vibe === candP.vibe) {
    score += 6;
    reasons.push(`Matching ${candP.vibe.split('·')[0].trim()} vibe`);
  }
  if (myP.guestPolicy === candP.guestPolicy) {
    score += 4;
    reasons.push('Aligned guest policy');
  }
  if (myP.noiseTolerance === candP.noiseTolerance) {
    score += 4;
    reasons.push(`Same quiet/noise preference`);
  }
  if (myP.choreStyle === candP.choreStyle) {
    score += 3;
  }
  if (myP.conflictStyle === candP.conflictStyle) {
    score += 2;
  }

  // 4. Lifestyle alignment
  if (currentUser.lifestyle.sleepSchedule === candidate.lifestyle.sleepSchedule) {
    score += 4;
    reasons.push('Same sleep schedule');
  }
  if (currentUser.lifestyle.kitchenDiet === candidate.lifestyle.kitchenDiet) {
    score += 3;
    reasons.push(candidate.lifestyle.kitchenDiet);
  }
  if (currentUser.lifestyle.workRoutine === candidate.lifestyle.workRoutine) {
    score += 2;
  }

  // 5. Verified Identity trust boost
  if (candidate.identityVerification?.identityVerified) {
    score += 3;
    reasons.push('AI + ID Verified');
  }

  // 6. Budget band closeness
  const myRent = computeCostTotals(currentUser.costBreakdown, currentUser.budget).monthlyRent;
  const candRent = computeCostTotals(candidate.costBreakdown, candidate.budget).monthlyRent;
  if (Math.abs(myRent - candRent) <= 4000) {
    score += 3;
    reasons.push('Aligned monthly rent share');
  }

  return {
    score: Math.max(62, Math.min(99, score)),
    reasons: reasons.slice(0, 4),
  };
}

export function computeGroupCompatibility(currentUser: UserProfile | null, group: RoomieGroup): number {
  if (!currentUser) return 89;
  let score = 70;
  if (currentUser.flatLocation.city.toLowerCase() === group.city.toLowerCase()) score += 10;
  if (
    currentUser.flatLocation.area.toLowerCase().includes(group.area.toLowerCase().split(' ')[0]) ||
    group.area.toLowerCase().includes(currentUser.flatLocation.area.toLowerCase().split(' ')[0])
  ) {
    score += 10;
  }
  if (currentUser.hasFlat !== group.hasFlat) score += 6;
  const myRent = parseBudgetMonthly(currentUser.budget);
  const groupRent = parseBudgetMonthly(group.budgetPerPerson);
  if (Math.abs(myRent - groupRent) <= 5000) score += 3;
  return Math.max(68, Math.min(99, score));
}
