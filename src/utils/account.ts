export function profileCompleteness(profile: Record<string, unknown> | null): { pct: number; missing: string[] } {
  if (!profile) return { pct: 0, missing: [] };

  const isPro = profile.isServiceProvider === true;

  const checks: [boolean, string][] = [
    [Boolean((profile.displayName as string)?.trim()), "Display name"],
    [Boolean(profile.photoURL), "Profile photo"],
    [Boolean((profile.society as string)?.trim()), "Society / community"],
    [Boolean((profile.tower as string)?.trim()), "Tower / wing"],
    [Boolean((profile.flatNumber as string)?.trim()), "Flat number"],
    [Boolean((profile.phoneNumber as string)?.trim()), "Phone number"],
    [Boolean(profile.residencyProofUrl || profile.residencyProofPreviewUrl), "Residency proof"],
    ...(isPro ? [[Array.isArray(profile.skills) && (profile.skills as string[]).length > 0, "At least one skill"] as [boolean, string]] : []),
  ];

  const missing = checks.filter(([ok]) => !ok).map(([, label]) => label);
  return { pct: Math.round(((checks.length - missing.length) / checks.length) * 100), missing };
}
