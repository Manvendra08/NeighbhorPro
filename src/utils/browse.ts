export function getBrowseEmptyDescription(params: {
  hasSearchOrCategory: boolean;
  hasLocalityOrTower: boolean;
  isServiceProvider: boolean;
}): string {
  const { hasSearchOrCategory, hasLocalityOrTower, isServiceProvider } = params;
  if (hasSearchOrCategory || hasLocalityOrTower) return "Try adjusting your search or filters";
  if (isServiceProvider) return "Update your profile to list your skills.";
  return "Try browsing nearby professionals in all localities.";
}

export function getBrowseFallbackNotice(societyName: string): string {
  const normalized = societyName.trim() || "your society";
  return `No pros in ${normalized} yet — showing nearby professionals.`;
}
