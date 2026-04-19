import { describe, expect, it } from "vitest";
import { profileCompleteness } from "./account";

describe("account completeness", () => {
  it("treats locality as complete when society is present", () => {
    const result = profileCompleteness({
      displayName: "User",
      bio: "Bio",
      society: "Lake View",
      locality: "",
      flatNumber: "A-101",
      photoURL: "a.jpg",
      skills: ["Plumbing"],
      phoneNumber: "+919999999999",
    });
    expect(result.missing).not.toContain("Locality");
  });
});
