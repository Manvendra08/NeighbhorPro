import { describe, expect, it } from "vitest";
import { computeAggregateRating } from "./rating";

describe("rating utils", () => {
  it("uses review list fallback when stored rating is zero", () => {
    expect(computeAggregateRating(0, 2, [{ rating: 4 }, { rating: 5 }])).toEqual({
      rating: 4.5,
      reviewCount: 2,
    });
  });

  it("returns no-reviews state when no reviews exist", () => {
    expect(computeAggregateRating(0, 0, [])).toEqual({ rating: null, reviewCount: 0 });
  });
});
