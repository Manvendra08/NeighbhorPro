import { describe, expect, it } from "vitest";

import {
  getConversationId,
  normalizeAvailabilityData,
  normalizeProfileData,
  normalizeStringArray,
} from "./firestoreService";

describe("firestoreService normalization helpers", () => {
  it("normalizes string arrays from comma-separated input", () => {
    expect(normalizeStringArray(" Tax, Legal, Tax , ,Health ")).toEqual(["Tax", "Legal", "Health"]);
  });

  it("normalizes profile skills safely", () => {
    const result = normalizeProfileData({
      displayName: "Pro One",
      skills: ["Tax", "Tax", "  Legal  ", 10],
    });

    expect(result.skills).toEqual(["Tax", "Legal"]);
  });

  it("normalizes availability day slots and active flags", () => {
    const result = normalizeAvailabilityData({
      monday: { active: 1, slots: ["09:00", "09:00", "10:00"] },
      tuesday: { active: 0, slots: "11:00,12:00" },
    });

    expect(result?.monday).toEqual({ active: true, slots: ["09:00", "10:00"] });
    expect(result?.tuesday).toEqual({ active: false, slots: ["11:00", "12:00"] });
  });

  it("creates deterministic conversation IDs regardless of user order", () => {
    const a = getConversationId("u2", "u1");
    const b = getConversationId("u1", "u2");

    expect(a).toBe("u1_u2");
    expect(a).toBe(b);
  });
});
