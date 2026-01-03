
/* Cache helpers */

export function cacheEntry(convoId, entryId, payload) {
  entryCache.set(`${convoId}:${entryId}`, payload);
}
export function getCachedEntry(convoId, entryId) {
  return entryCache.get(`${convoId}:${entryId}`);
}
export function clearCacheForEntry(convoId, entryId) {
  entryCache.delete(`${convoId}:${entryId}`);
}export const entryCache = new Map();

