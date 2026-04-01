# PITFALLS Research - v1.0 Trust and Reliability Hardening

## Common Pitfalls
- Applying fallback queries without deterministic ordering.
- Updating payout state without corresponding ledger reversal.
- Generic fallback labels that degrade trust in messaging UI.
- Admin controls that confirm action but fail to persist reviewer context.
- Performance fixes that improve chunk size but regress route responsiveness.

## Prevention
- Enforce sort normalization after merged query results.
- Keep payout cancellation and refund in a single transaction.
- Use deterministic UID-based fallback names when profiles are unavailable.
- Treat audit metadata as required fields for admin review writes.
- Validate performance changes with build + route smoke checks.
