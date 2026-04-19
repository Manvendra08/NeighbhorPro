import { describe, expect, it } from "vitest";
import {
  getInitialServiceCategory,
  getServiceCategories,
  shouldShowCategoryFilter,
} from "./serviceSelection";

const services = [
  { id: "s1", category: "Plumbing" },
  { id: "s2", category: "Electrical" },
];

describe("service selection utils", () => {
  it("derives categories and hides filter for single category", () => {
    expect(getServiceCategories([{ id: "a", category: "Yoga" }, { id: "b", category: "Yoga" }])).toEqual(["Yoga"]);
    expect(shouldShowCategoryFilter(["Yoga"])).toBe(false);
  });

  it("preselects matched service category in specific-pro booking flow", () => {
    expect(getInitialServiceCategory(services, "s2")).toBe("Electrical");
  });
});
