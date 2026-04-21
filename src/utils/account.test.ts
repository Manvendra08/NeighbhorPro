import { describe, expect, it } from "vitest";
import { profileCompleteness } from "./account";

describe("account completeness", () => {
  it("does not require skills for non-pro users", () => {
    const result = profileCompleteness({
      displayName: "User",
      photoURL: "a.jpg",
      society: "Lake View",
      tower: "A",
      flatNumber: "A-101",
      phoneNumber: "+919999999999",
      residencyProofUrl: "proof.jpg",
      isServiceProvider: false,
    });
    expect(result.missing).not.toContain("At least one skill");
  });
});
