import { FlatmateCandidate, LivingCircleId, UserProfile } from '../types';
import { computeCostTotals } from './compatibility';

export interface LivingCircleMeta {
  id: LivingCircleId;
  emoji: string;
  name: string;
  shortLabel: string;
  tagline: string;
  requirementCue: string;
  accentText: string;
  accentBg: string;
  accentBorder: string;
}

export const LIVING_CIRCLES: LivingCircleMeta[] = [
  {
    id: 'college_students',
    emoji: '🎓',
    name: 'College Students',
    shortLabel: 'Students',
    tagline: 'Campus & study-friendly shared flats near colleges, hostels, and transit',
    requirementCue: 'Shared rooms · Study hours · Student budget',
    accentText: 'text-sky-300',
    accentBg: 'bg-sky-500/15',
    accentBorder: 'border-sky-500/40',
  },
  {
    id: 'it_professionals',
    emoji: '💻',
    name: 'IT Professionals',
    shortLabel: 'IT & Tech',
    tagline: 'Tech & hybrid WFH folks looking for reliable Wi-Fi and commute-friendly flats',
    requirementCue: 'WFH / Hybrid · High-speed Wi-Fi · Weekday routine',
    accentText: 'text-[#FFD43B]',
    accentBg: 'bg-[#FFD43B]/15',
    accentBorder: 'border-[#FFD43B]/45',
  },
  {
    id: 'budget_living',
    emoji: '🏠',
    name: 'Budget Living',
    shortLabel: 'Budget',
    tagline: 'Value-first rooms, zero-brokerage splits, and transparent monthly rent shares',
    requirementCue: 'Rent <= ₹18k/mo · Shared utilities · Zero-brokerage focus',
    accentText: 'text-emerald-300',
    accentBg: 'bg-emerald-500/15',
    accentBorder: 'border-emerald-500/40',
  },
  {
    id: 'peaceful_living',
    emoji: '🌱',
    name: 'Peaceful Living',
    shortLabel: 'Peaceful',
    tagline: 'Calm, tidy, low-noise homes with respectful guest policies and clean kitchens',
    requirementCue: 'Low noise · Tidy kitchen · Respectful guests',
    accentText: 'text-lime-300',
    accentBg: 'bg-lime-500/15',
    accentBorder: 'border-lime-500/40',
  },
];

export const VALID_LIVING_CIRCLE_IDS: LivingCircleId[] = LIVING_CIRCLES.map((c) => c.id);

export function sanitizeLivingCircles(input?: unknown): LivingCircleId[] {
  if (!Array.isArray(input)) return [];
  const validSet = new Set<string>(VALID_LIVING_CIRCLE_IDS);
  const out: LivingCircleId[] = [];
  for (const item of input) {
    if (typeof item === 'string' && validSet.has(item) && !out.includes(item as LivingCircleId)) {
      out.push(item as LivingCircleId);
    }
    if (out.length >= 4) break;
  }
  return out;
}

export function getLivingCircleMeta(id: LivingCircleId): LivingCircleMeta {
  return LIVING_CIRCLES.find((c) => c.id === id) || LIVING_CIRCLES[1];
}

export function inferLivingCirclesFromTraits(traits: {
  profession?: string;
  skills?: string[];
  bio?: string;
  budget?: string;
  monthlyRent?: number;
  workRoutine?: string;
  noiseTolerance?: string;
  vibe?: string;
  guestPolicy?: string;
  cleanliness?: string;
}): LivingCircleId[] {
  const haystack = [
    traits.profession || '',
    ...(traits.skills || []),
    traits.bio || '',
    traits.workRoutine || '',
  ]
    .join(' ')
    .toLowerCase();

  const inferred: LivingCircleId[] = [];

  if (
    /\b(student|college|university|campus|intern|btech|mtech|mba|bba|msc|bsc|grad|phd|study)\b/.test(
      haystack
    )
  ) {
    inferred.push('college_students');
  }

  if (
    /\b(engineer|developer|software|frontend|backend|fullstack|data|product|ui\/ux|designer|tech|it|analyst|devops|qa|consultant|hybrid|wfh|remote)\b/.test(
      haystack
    )
  ) {
    inferred.push('it_professionals');
  }

  const rent =
    typeof traits.monthlyRent === 'number' && traits.monthlyRent > 0
      ? traits.monthlyRent
      : computeCostTotals(undefined, traits.budget).monthlyRent;
  if (rent <= 19000 || /\b(budget|affordable|saving|economical|no brokerage)\b/.test(haystack)) {
    inferred.push('budget_living');
  }

  const noise = (traits.noiseTolerance || '').toLowerCase();
  const vibe = (traits.vibe || '').toLowerCase();
  const guests = (traits.guestPolicy || '').toLowerCase();
  const clean = (traits.cleanliness || '').toLowerCase();
  if (
    noise.includes('quiet') ||
    vibe.includes('introvert') ||
    vibe.includes('calm') ||
    guests.includes('rare') ||
    clean.includes('daily') ||
    /\b(peaceful|quiet|calm|meditat|yoga|early riser|tidy)\b/.test(haystack)
  ) {
    inferred.push('peaceful_living');
  }

  if (inferred.length === 0) {
    inferred.push('it_professionals');
    if (rent <= 22000) inferred.push('budget_living');
  }

  return inferred.slice(0, 4);
}

/**
 * Returns explicitly joined Living Circles when present, or infers matching circles
 * for older Firestore profiles that predate Living Circles.
 */
export function getEffectiveLivingCircles(
  person: Pick<
    UserProfile | FlatmateCandidate,
    'livingCircles' | 'skills' | 'bio' | 'budget' | 'costBreakdown' | 'lifestyle' | 'personality'
  > & { profession?: string }
): LivingCircleId[] {
  const explicit = sanitizeLivingCircles(person.livingCircles);
  if (explicit.length > 0) return explicit;

  return inferLivingCirclesFromTraits({
    profession: person.profession || person.skills?.[0],
    skills: person.skills,
    bio: person.bio,
    budget: person.budget,
    monthlyRent: person.costBreakdown?.monthlyRent,
    workRoutine: person.lifestyle?.workRoutine,
    noiseTolerance: person.personality?.noiseTolerance,
    vibe: person.personality?.vibe,
    guestPolicy: person.personality?.guestPolicy,
    cleanliness: person.lifestyle?.cleanliness,
  });
}
