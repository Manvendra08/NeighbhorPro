type ServiceRow = Record<string, unknown>;

export function getServiceCategories(services: ServiceRow[]): string[] {
  return [...new Set(services.map((service) => ((service.category as string) || "Other")))];
}

export function shouldShowCategoryFilter(categories: string[]): boolean {
  return categories.length > 1;
}

export function getInitialServiceCategory(services: ServiceRow[], selectedServiceId?: string | null): string {
  if (selectedServiceId) {
    const matched = services.find((service) => String(service.id) === selectedServiceId);
    if (matched) return ((matched.category as string) || "Other");
  }
  return ((services[0]?.category as string) || "Other");
}
