import { camelizeKeys, normalizeBattleTag } from '../business/profileUtils'
import type { CachedProfiles, ProfileView } from '../business/profileTypes'

const PROFILE_CACHE_KEY = 'overwatch-profile-cache-v1'
const LAST_PROFILE_KEY = 'overwatch-last-profile-v1'

export function readProfileCache() {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const rawCache = window.localStorage.getItem(PROFILE_CACHE_KEY)
    return rawCache ? camelizeKeys(JSON.parse(rawCache) as CachedProfiles) : {}
  } catch {
    return {}
  }
}

export function writeProfileCache(cache: CachedProfiles) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cache))
}

export function readCachedProfile(battleTag: string) {
  const lookup = normalizeBattleTag(battleTag).toLowerCase()

  if (!lookup) {
    return null
  }

  return readProfileCache()[lookup] ?? null
}

export function storeCachedProfile(profile: ProfileView) {
  const cache = readProfileCache()
  cache[normalizeBattleTag(profile.battleTag).toLowerCase()] = profile
  writeProfileCache(cache)
  window.localStorage.setItem(LAST_PROFILE_KEY, normalizeBattleTag(profile.battleTag))
}

export function readLastProfile() {
  if (typeof window === 'undefined') {
    return null
  }

  const lastProfileKey = window.localStorage.getItem(LAST_PROFILE_KEY)

  if (!lastProfileKey) {
    return null
  }

  return readProfileCache()[lastProfileKey.toLowerCase()] ?? null
}
