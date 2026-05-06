# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: browse.spec.ts >> Browse Professionals >> sorting options change result order
- Location: e2e\browse.spec.ts:90:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[data-testid=\'pro-card\'], .pro-card, .m-pro-card, .no-results, .empty-state').first()
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('[data-testid=\'pro-card\'], .pro-card, .m-pro-card, .no-results, .empty-state').first()

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - complementary [ref=e4]:
    - generic [ref=e5]:
      - link "Logo ProNeighbor" [ref=e6] [cursor=pointer]:
        - /url: /
        - generic [ref=e7]:
          - img "Logo" [ref=e8]
          - generic [ref=e9]: ProNeighbor
      - button "Toggle sidebar" [ref=e10] [cursor=pointer]:
        - img [ref=e11]
    - navigation [ref=e12]:
      - generic [ref=e13]: Menu
      - link "Dashboard" [ref=e14] [cursor=pointer]:
        - /url: /dashboard
        - img [ref=e15]
        - generic [ref=e18]: Dashboard
      - link "Browse Pros" [ref=e19] [cursor=pointer]:
        - /url: /browse
        - img [ref=e20]
        - generic [ref=e23]: Browse Pros
      - link "My Bookings" [ref=e24] [cursor=pointer]:
        - /url: /bookings
        - img [ref=e25]
        - generic [ref=e28]: My Bookings
      - link "Messages" [ref=e29] [cursor=pointer]:
        - /url: /messages
        - img [ref=e30]
        - generic [ref=e32]: Messages
      - link "Wallet 500 NC" [ref=e33] [cursor=pointer]:
        - /url: /wallet
        - img [ref=e34]
        - generic [ref=e36]: Wallet
        - generic [ref=e37]: 500 NC
      - link "My Account" [ref=e38] [cursor=pointer]:
        - /url: /account
        - img [ref=e39]
        - generic [ref=e42]: My Account
      - link "Support" [ref=e43] [cursor=pointer]:
        - /url: /support
        - img [ref=e44]
        - generic [ref=e47]: Support
    - generic [ref=e49]: © 2026 ProNeighbor
  - generic [ref=e50]:
    - banner [ref=e51]:
      - generic [ref=e54]: 14+ neighbors are using ProNeighbor right now!
      - generic [ref=e55]:
        - link "🪙 500 NC" [ref=e56] [cursor=pointer]:
          - /url: /wallet
          - generic [ref=e57]: 🪙
          - text: 500 NC
        - button "Notifications" [ref=e59] [cursor=pointer]:
          - img [ref=e60]
        - button "Open user menu" [ref=e63] [cursor=pointer]: CU
    - generic [ref=e64]:
      - generic [ref=e65]:
        - text: ⚠️ Verify your email —
        - strong [ref=e66]: client1@proneighbor.in
      - button "Resend" [ref=e67] [cursor=pointer]
    - generic [ref=e69]:
      - generic [ref=e72]:
        - generic [ref=e74]:
          - generic [ref=e75]: 🔍
          - textbox "Search by name, skill, or service category..." [ref=e76]
        - generic [ref=e77]:
          - generic [ref=e78]:
            - generic [ref=e79]: 📂
            - combobox [ref=e80]:
              - option "All Categories" [selected]
              - option "Tuition & Coaching"
              - option "Yoga & Fitness"
              - option "Music & Dance"
              - option "Language Classes"
              - option "Nutrition & Diet"
              - option "Career Coaching"
              - option "Tax & CA"
              - option "Legal Advisory"
              - option "Doctor Consults"
              - option "Beauty & Grooming"
              - option "Pet Care"
              - option "Event Planning"
              - option "Interior Design"
              - option "Professional Services"
              - option "Design & Branding"
              - option "Digital Marketing"
              - option "Resume & LinkedIn"
              - option "Accounting & GST"
              - option "Investment Planning"
              - option "Food & Catering"
              - option "Apparels & Fashion"
              - option "Fashion Jewellery"
              - option "Customized Bags"
              - option "Home Decor & Crafts"
              - option "Handmade Gifts"
              - option "Baking & Desserts"
          - generic [ref=e81]:
            - generic [ref=e82]: 📍
            - combobox [ref=e83]:
              - option "All Localities" [selected]
              - option "Park Diamond"
              - option "Park Emerald"
              - option "Park Ivory"
              - option "Park Sapphire"
              - option "Park Titanium"
              - option "Park Turquoise"
          - generic [ref=e85]:
            - generic [ref=e86]: 🏢
            - textbox "Tower" [ref=e87]
      - generic [ref=e88]:
        - generic [ref=e89]:
          - heading "Browse Professionals" [level=1] [ref=e90]
          - paragraph [ref=e91]: Find trusted experts in your neighborhood
        - generic [ref=e92]:
          - button "Grid" [ref=e93] [cursor=pointer]:
            - img [ref=e94]
            - text: Grid
          - button "List" [ref=e99] [cursor=pointer]:
            - img [ref=e100]
            - text: List
      - heading "Showing 3 experts" [level=2] [ref=e102]
      - generic [ref=e103]:
        - generic [ref=e104] [cursor=pointer]:
          - generic [ref=e105]:
            - generic [ref=e107]:
              - img "Proxecute Consulting" [ref=e108]
              - generic [ref=e109]: Pro
            - generic [ref=e111]:
              - generic [ref=e112]:
                - generic [ref=e113]:
                  - generic [ref=e114]: Proxecute Consulting
                  - generic [ref=e115]:
                    - img [ref=e116]
                    - generic [ref=e119]: Park Sapphire, K
                - generic [ref=e120]:
                  - text: ★ 5.0
                  - generic [ref=e121]: (1)
              - generic [ref=e122]:
                - text: ✓ Verified Resident
                - button "Verified resident proof" [ref=e124]: i
              - generic [ref=e125]:
                - generic [ref=e126]: Fitness
                - generic [ref=e127]: Food
          - generic [ref=e128]:
            - button "Book" [ref=e129]
            - button "View Profile" [ref=e130]
        - generic [ref=e131] [cursor=pointer]:
          - generic [ref=e132]:
            - generic [ref=e134]:
              - img "Pro User1" [ref=e135]
              - generic [ref=e136]: Pro
            - generic [ref=e138]:
              - generic [ref=e139]:
                - generic [ref=e140]:
                  - generic [ref=e141]: Pro User1
                  - generic [ref=e142]:
                    - img [ref=e143]
                    - generic [ref=e146]: Park Diamond, F
                - generic [ref=e148]: No reviews yet
              - generic [ref=e149]:
                - text: ✓ Verified Resident
                - button "Verified resident proof" [ref=e151]: i
              - generic [ref=e152]:
                - generic [ref=e153]: General Physician
                - generic [ref=e154]: Insurance Planning
          - generic [ref=e155]:
            - button "Book" [ref=e156]
            - button "View Profile" [ref=e157]
        - generic [ref=e158] [cursor=pointer]:
          - generic [ref=e159]:
            - generic [ref=e161]:
              - img "Pro User2" [ref=e162]
              - generic [ref=e163]: Pro
            - generic [ref=e165]:
              - generic [ref=e166]:
                - generic [ref=e167]:
                  - generic [ref=e168]: Pro User2
                  - generic [ref=e169]:
                    - img [ref=e170]
                    - generic [ref=e173]: Park Titanium, B
                - generic [ref=e175]: No reviews yet
              - generic [ref=e176]:
                - text: ✓ Verified Resident
                - button "Verified resident proof" [ref=e178]: i
              - generic [ref=e179]:
                - generic [ref=e180]: CA Services
                - generic [ref=e181]: Legal Advice
                - generic [ref=e182]: "+3"
          - generic [ref=e183]:
            - button "Book" [ref=e184]
            - button "View Profile" [ref=e185]
```

# Test source

```ts
  8   |   readonly searchInput: Locator;
  9   |   readonly categoryFilters: Locator;
  10  |   readonly professionalCards: Locator;
  11  |   readonly sortByDropdown: Locator;
  12  |   readonly locationFilter: Locator;
  13  |   readonly applyFiltersButton: Locator;
  14  |   readonly clearFiltersButton: Locator;
  15  | 
  16  |   constructor(page: Page) {
  17  |     super(page);
  18  |     
  19  |     this.searchInput = page.locator("input[placeholder*='search'], input[placeholder*='Search'], input[name='search'], #search").first();
  20  |     this.categoryFilters = page.locator("select, [data-testid='category-filter'], .category-filter, [role='tablist']").first();
  21  |     this.professionalCards = page.locator("[data-testid='pro-card'], .professional-card, .pro-listing, .pro-card, .m-pro-card");
  22  |     this.sortByDropdown = page.locator("select[name='sort'], [data-testid='sort-dropdown']").first();
  23  |     this.locationFilter = page.locator("input[placeholder*='location'], [data-testid='location-filter']").first();
  24  |     this.applyFiltersButton = page.getByRole("button", { name: /apply filters/i }).first();
  25  |     this.clearFiltersButton = page.getByRole("button", { name: /clear filters|reset/i }).first();
  26  |   }
  27  | 
  28  |   /**
  29  |    * Navigate to browse page
  30  |    */
  31  |   async goto(): Promise<void> {
  32  |     await super.goto("/browse");
  33  |     await this.waitForLoad();
  34  |   }
  35  | 
  36  |   /**
  37  |    * Search for professionals by keyword
  38  |    */
  39  |   async search(keyword: string): Promise<void> {
  40  |     await this.fillInput(this.searchInput, keyword);
  41  |     await this.page.waitForTimeout(500); // Allow search debounce
  42  |   }
  43  | 
  44  |   /**
  45  |    * Select a category filter
  46  |    */
  47  |   async selectCategory(category: string): Promise<void> {
  48  |     const categoryBtn = this.categoryFilters.locator(`button, [role="tab"]`).filter({ hasText: category });
  49  |     await this.safeClick(categoryBtn);
  50  |   }
  51  | 
  52  |   /**
  53  |    * Get visible professional cards count
  54  |    */
  55  |   async getProfessionalCount(): Promise<number> {
  56  |     return await this.professionalCards.count();
  57  |   }
  58  | 
  59  |   /**
  60  |    * Get professional card by index
  61  |    */
  62  |   getProfessionalCard(index: number): Locator {
  63  |     return this.professionalCards.nth(index);
  64  |   }
  65  | 
  66  |   /**
  67  |    * Click on a professional card to view details
  68  |    */
  69  |   async viewProfessional(index: number): Promise<void> {
  70  |     const card = this.getProfessionalCard(index);
  71  |     await this.safeClick(card);
  72  |   }
  73  | 
  74  |   /**
  75  |    * Sort results by option
  76  |    */
  77  |   async sortBy(option: string): Promise<void> {
  78  |     await this.sortByDropdown.selectOption(option);
  79  |     await this.waitForLoadingComplete();
  80  |   }
  81  | 
  82  |   /**
  83  |    * Apply location filter
  84  |    */
  85  |   async filterByLocation(location: string): Promise<void> {
  86  |     await this.fillInput(this.locationFilter, location);
  87  |     await this.safeClick(this.applyFiltersButton);
  88  |     await this.waitForLoadingComplete();
  89  |   }
  90  | 
  91  |   /**
  92  |    * Clear all applied filters
  93  |    */
  94  |   async clearFilters(): Promise<void> {
  95  |     await this.safeClick(this.clearFiltersButton);
  96  |     await this.waitForLoadingComplete();
  97  |   }
  98  | 
  99  |   /**
  100 |    * Assert browse page is loaded with professionals
  101 |    */
  102 |   async assertLoaded(): Promise<void> {
  103 |     await expect(this.page).toHaveURL(/\/browse/);
  104 |     await expect(this.searchInput).toBeVisible({ timeout: 15000 });
  105 |     // Wait for at least one professional card or "no results" message
  106 |     await expect(
  107 |       this.page.locator("[data-testid='pro-card'], .pro-card, .m-pro-card, .no-results, .empty-state").first()
> 108 |     ).toBeVisible({ timeout: 10000 });
      |       ^ Error: expect(locator).toBeVisible() failed
  109 |   }
  110 | 
  111 |   /**
  112 |    * Assert search results match expected count
  113 |    */
  114 |   async assertResultsCount(expected: number): Promise<void> {
  115 |     const count = await this.getProfessionalCount();
  116 |     expect(count).toBe(expected);
  117 |   }
  118 | 
  119 |   /**
  120 |    * Assert professional card has expected content
  121 |    */
  122 |   async assertProfessionalCardHas(index: number, expectedText: string | RegExp): Promise<void> {
  123 |     const card = this.getProfessionalCard(index);
  124 |     await expect(card).toContainText(expectedText);
  125 |   }
  126 | }
  127 | 
```