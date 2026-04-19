export function computeAggregateRating(
  ratingValue: unknown,
  reviewCountValue: unknown,
  fallbackReviews: unknown,
): { rating: number | null; reviewCount: number } {
  const reviewCount = Math.max(0, Number(reviewCountValue) || 0);
  const hasReviewsByCount = reviewCount > 0;
  const hasReviewsByList = Array.isArray(fallbackReviews) && fallbackReviews.length > 0;
  const hasReviews = hasReviewsByCount || hasReviewsByList;
  if (!hasReviews) return { rating: null, reviewCount: 0 };

  const normalizedRating = Number(ratingValue);
  if (Number.isFinite(normalizedRating) && normalizedRating > 0) {
    return {
      rating: Math.round(normalizedRating * 10) / 10,
      reviewCount: reviewCount > 0 ? reviewCount : (Array.isArray(fallbackReviews) ? fallbackReviews.length : 0),
    };
  }

  if (Array.isArray(fallbackReviews) && fallbackReviews.length > 0) {
    const validRatings = fallbackReviews
      .map((review) => Number((review as Record<string, unknown>)?.rating))
      .filter((value) => Number.isFinite(value) && value >= 1 && value <= 5) as number[];
    if (validRatings.length > 0) {
      const average = validRatings.reduce((sum, value) => sum + value, 0) / validRatings.length;
      return {
        rating: Math.round(average * 10) / 10,
        reviewCount: reviewCount > 0 ? reviewCount : fallbackReviews.length,
      };
    }
  }

  return {
    rating: null,
    reviewCount: reviewCount > 0 ? reviewCount : (Array.isArray(fallbackReviews) ? fallbackReviews.length : 1),
  };
}
