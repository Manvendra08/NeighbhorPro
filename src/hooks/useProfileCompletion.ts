import { useMemo } from "react";

type ProfileRecord = Record<string, unknown> | null;
type AvailabilityRecord = Record<string, unknown> | null;

export type ProfileCompletionResult = {
  percent: number;
  missingFields: string[];
  missingTop: string[];
  complete: boolean;
};

const BASE_RULES = [
  { key: "displayName", label: "Full name", weight: 15, test: (profile: ProfileRecord) => Boolean(String(profile?.displayName || "").trim()) },
  { key: "photoURL", label: "Profile photo", weight: 15, test: (profile: ProfileRecord) => Boolean(profile?.photoURL) },
  { key: "society", label: "Society", weight: 10, test: (profile: ProfileRecord) => Boolean(String(profile?.society || "").trim()) },
  { key: "phoneNumber", label: "Phone number", weight: 15, test: (profile: ProfileRecord) => Boolean(String(profile?.phoneNumber || "").trim()) },
  { key: "bio", label: "Bio", weight: 10, test: (profile: ProfileRecord) => Boolean(String(profile?.bio || "").trim()) },
  { key: "skills", label: "Skills", weight: 15, test: (profile: ProfileRecord) => Array.isArray(profile?.skills) && (profile?.skills as unknown[]).length > 0 },
] as const;

const PRO_RULES = [
  { key: "hourlyRate", label: "Hourly rate", weight: 10, test: (profile: ProfileRecord) => Number(profile?.hourlyRate) > 0 || profile?.isFreeConsultation === true },
  { key: "availability", label: "Availability", weight: 10, test: (_profile: ProfileRecord, availability: AvailabilityRecord) => hasAvailability(availability) },
] as const;

function hasAvailability(availability: AvailabilityRecord): boolean {
  if (!availability) return false;

  return Object.values(availability).some((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const row = entry as Record<string, unknown>;
    const slots = Array.isArray(row.slots) ? row.slots : [];
    return row.active === true && slots.length > 0;
  });
}

export function useProfileCompletion(
  profile: ProfileRecord,
  availability: AvailabilityRecord,
  isPro: boolean,
): ProfileCompletionResult {
  return useMemo(() => {
    const rules = [...BASE_RULES, ...(isPro ? PRO_RULES : [])];
    const missingFields: string[] = [];
    let total = 0;

    for (const rule of rules) {
      if (rule.test(profile, availability)) {
        total += rule.weight;
      } else {
        missingFields.push(rule.label);
      }
    }

    return {
      percent: Math.max(0, Math.min(100, total)),
      missingFields,
      missingTop: missingFields.slice(0, 3),
      complete: missingFields.length === 0,
    };
  }, [availability, isPro, profile]);
}
