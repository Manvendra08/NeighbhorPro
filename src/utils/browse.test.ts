import { describe, expect, it } from "vitest";
import { getBrowseEmptyDescription, getBrowseFallbackNotice } from "./browse";

describe("browse utils", () => {
  it("does not show be-first copy for client users", () => {
    const copy = getBrowseEmptyDescription({
      hasSearchOrCategory: false,
      hasLocalityOrTower: false,
      isServiceProvider: false,
    });

    expect(copy).toBe("Try browsing nearby professionals in all localities.");
    expect(copy.toLowerCase()).not.toContain("be the first");
  });

  it("builds requested fallback notice copy", () => {
    expect(getBrowseFallbackNotice("Green Residency")).toBe(
      "No pros in Green Residency yet — showing nearby professionals.",
    );
  });
});
