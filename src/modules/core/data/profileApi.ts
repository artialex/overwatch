import {
  buildSummary,
  camelizeKeys,
  formatBattleTag,
  formatRank,
  heroLabel,
  normalizeBattleTag,
  pickHeadlineRole,
  titleCase,
} from '../business/profileUtils'
import type {
  ProfileView,
  RoleKey,
  SearchResponse,
  StatsBucket,
  StatsSummaryResponse,
  SummaryResponse,
} from '../business/profileTypes'

const API_BASE = 'https://overfast-api.tekrop.fr'

async function fetchJson<T>(path: string) {
  const response = await fetch(`${API_BASE}${path}`)

  if (!response.ok) {
    throw new Error(`API request failed with ${response.status}`)
  }

  return camelizeKeys((await response.json()) as T)
}

export async function loadProfile(rawBattleTag: string): Promise<ProfileView> {
  const lookup = normalizeBattleTag(rawBattleTag)

  if (!lookup) {
    throw new Error('Enter a BattleTag first.')
  }

  const search = await fetchJson<SearchResponse>(`/players?name=${encodeURIComponent(lookup)}`)
  const candidate = search.results.find((result) => result.playerId.toLowerCase() === lookup.toLowerCase()) ?? search.results[0]

  if (!candidate) {
    throw new Error('No public Overwatch profile was found for that BattleTag.')
  }

  if (!candidate.isPublic) {
    throw new Error('That profile is private. Set the Overwatch career profile to public and try again.')
  }

  const [summary, stats] = await Promise.all([
    fetchJson<SummaryResponse>(`/players/${encodeURIComponent(candidate.playerId)}/summary`),
    fetchJson<StatsSummaryResponse>(`/players/${encodeURIComponent(candidate.playerId)}/stats/summary?gamemode=competitive&platform=pc`),
  ])

  const currentPlatform = summary.competitive.pc ?? summary.competitive.console
  const currentRanks = [
    { role: 'Tank', rank: formatRank(currentPlatform?.tank ?? null) },
    { role: 'Damage', rank: formatRank(currentPlatform?.damage ?? null) },
    { role: 'Support', rank: formatRank(currentPlatform?.support ?? null) },
    { role: 'Open Queue', rank: formatRank(currentPlatform?.open ?? null) },
  ]

  const roleRows = Object.entries(stats.roles)
    .filter((entry): entry is [RoleKey, StatsBucket] => Boolean(entry[1]))
    .sort((left, right) => right[1].timePlayed - left[1].timePlayed)
    .map(([role, bucket]) => ({ role: titleCase(role), bucket }))

  const heroRows = Object.entries(stats.heroes)
    .filter((entry) => entry[1].timePlayed > 0)
    .sort((left, right) => right[1].timePlayed - left[1].timePlayed)
    .slice(0, 6)
    .map(([hero, bucket]) => ({ hero: heroLabel(hero), bucket }))

  const headlineRole = pickHeadlineRole(stats.roles)

  return {
    battleTag: formatBattleTag(candidate.playerId),
    username: summary.username,
    playerId: candidate.playerId,
    avatar: summary.avatar || candidate.avatar,
    title: summary.title,
    endorsementLevel: summary.endorsement.level,
    lastUpdatedAt: summary.lastUpdatedAt,
    currentSeason: currentPlatform?.season ?? null,
    currentRanks,
    headlineRole,
    summary: buildSummary(summary.username, stats.general, headlineRole),
    general: stats.general,
    roleRows,
    heroRows,
    cachedAt: Date.now(),
  }
}
