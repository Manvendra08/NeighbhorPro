export function profileCompleteness(profile: Record<string, unknown> | null): { pct: number; missing: string[] } {
  if (!profile) return { pct: 0, missing: [] };

  const societyValue = (profile.society as string)?.trim() || "";
  const localityValue = (profile.locality as string)?.trim() || "";
  const hasLocality = Boolean(localityValue || societyValue);

  const checks: [boolean, string][] = [
    [Boolean((profile.displayName as string)?.trim()), "Display name"],
    [Boolean((profile.bio as string)?.trim()), "Bio"],
    [Boolean((profile.society as string)?.trim()), "Society / community"],
    [Boolean((profile.flatNumber as string)?.trim()), "Flat number"],
    [hasLocality, "Locality"],
    [Boolean(profile.photoURL), "Profile photo"],
    [Array.isArray(profile.skills) && (profile.skills as string[]).length > 0, "At least one skill"],
    [Boolean((profile.phoneNumber as string)?.trim()), "Phone number"],
  ];

  const missing = checks.filter(([ok]) => !ok).map(([, label]) => label);
  return { pct: Math.round(((checks.length - missing.length) / checks.length) * 100), missing };
}
