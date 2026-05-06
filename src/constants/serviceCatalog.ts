export const DEFAULT_SERVICE_CATEGORIES: string[] = [
  // Business
  "Tuition & Coaching",
  "Yoga & Fitness",
  "Music & Dance",
  "Language Classes",
  "Nutrition & Diet",
  
  // Services
  "Tax & CA",
  "Legal Advisory",
  "Accounting & GST",
  "Investment Planning",
  "Career Coaching",
  "Digital Marketing",
  "Resume & LinkedIn",
  "Homeopathy Doctor",
  "Beauty & Grooming",
  "Professional Services",
  "Design & Branding",
  
  // E-Commerce
  "Food & Catering",
  "Apparels & Fashion",
  "Fashion Jewellery",
  "Customized Bags",
  "Home Decor & Crafts",
  "Handmade Gifts",
  "Baking & Desserts",
];

export const CATEGORY_GROUPS: Record<string, string[]> = {
  "Business": [
    "Tuition & Coaching",
    "Yoga & Fitness",
    "Music & Dance",
    "Language Classes",
    "Nutrition & Diet",
  ],
  "Services": [
    "Tax & CA",
    "Legal Advisory",
    "Accounting & GST",
    "Investment Planning",
    "Career Coaching",
    "Digital Marketing",
    "Resume & LinkedIn",
    "Homeopathy Doctor",
    "Beauty & Grooming",
    "Professional Services",
    "Design & Branding",
  ],
  "E-Commerce": [
    "Food & Catering",
    "Apparels & Fashion",
    "Fashion Jewellery",
    "Customized Bags",
    "Home Decor & Crafts",
    "Handmade Gifts",
    "Baking & Desserts",
  ],
};

export const SERVICE_CATEGORY_ICONS: Record<string, string> = {
  "Tuition & Coaching": "📚",
  "Yoga & Fitness": "🧘",
  "Music & Dance": "🎵",
  "Language Classes": "🗣️",
  "Nutrition & Diet": "🥗",
  "Career Coaching": "💼",
  "Tax & CA": "📊",
  "Legal Advisory": "⚖️",
  "Doctor Consults": "🏥",
  "Beauty & Grooming": "✨",
  "Pet Care": "🐾",
  "Event Planning": "🎉",
  "Interior Design": "🏠",
  "Professional Services": "💼",
  "Design & Branding": "🎨",
  "Digital Marketing": "📱",
  "Resume & LinkedIn": "📝",
  "Accounting & GST": "💹",
  "Investment Planning": "📈",
  "Food & Catering": "🍱",
  "Apparels & Fashion": "👗",
  "Fashion Jewellery": "💍",
  "Customized Bags": "👜",
  "Home Decor & Crafts": "🏡",
  "Handmade Gifts": "🎁",
  "Baking & Desserts": "🎂",
};

export function normalizeServiceCategories(value: unknown): string[] {
  if (!Array.isArray(value)) return [...DEFAULT_SERVICE_CATEGORIES];
  const cleaned = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
  return cleaned.length > 0 ? Array.from(new Set(cleaned)) : [...DEFAULT_SERVICE_CATEGORIES];
}

export function getCategoryGroup(category: string): string {
  for (const [group, categories] of Object.entries(CATEGORY_GROUPS)) {
    if (categories.includes(category)) return group;
  }
  return "Services"; // default
}

export function isBusinessCategory(category: string): boolean {
  return getCategoryGroup(category) === "Business";
}
