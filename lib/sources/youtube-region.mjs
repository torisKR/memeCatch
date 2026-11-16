/**
 * YouTube returns either an allow list or a block list. An empty allow list
 * blocks every region; an absent restriction does not block any region.
 * @param {{allowed?: string[] | null, blocked?: string[] | null} | null | undefined} restriction
 * @param {string} region
 * @returns {boolean}
 */
export function isYouTubeRegionBlocked(restriction, region = "KR") {
  return (Array.isArray(restriction?.allowed) && !restriction.allowed.includes(region)) ||
    (Array.isArray(restriction?.blocked) && restriction.blocked.includes(region));
}
