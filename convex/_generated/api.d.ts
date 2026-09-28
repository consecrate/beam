/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as aiCache from "../aiCache.js";
import type * as lessons from "../lessons.js";
import type * as model from "../model.js";
import type * as review from "../review.js";
import type * as seed from "../seed.js";
import type * as settings from "../settings.js";
import type * as stats from "../stats.js";
import type * as words from "../words.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  aiCache: typeof aiCache;
  lessons: typeof lessons;
  model: typeof model;
  review: typeof review;
  seed: typeof seed;
  settings: typeof settings;
  stats: typeof stats;
  words: typeof words;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
