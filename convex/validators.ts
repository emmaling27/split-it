import { Validator } from "convex/values";
import { v } from "convex/values";

/**
 * A generic mutation response validator that can include a value.
 * For mutations that don't return a value, use MutationResponse(v.null())
 */
export function MutationResponse<T>(valueValidator: Validator<T>) {
  return v.union(
    v.object({
      success: v.literal(true),
      value: valueValidator,
    }),
    v.object({
      success: v.literal(false),
      message: v.string(),
    }),
  );
}

// Add more shared validators here as needed
