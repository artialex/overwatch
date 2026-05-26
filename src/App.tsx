import { useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type RoleKey = 'tank' | 'damage' | 'support' | 'open'

type SearchResponse = {
  total: number
  results: Array<{
    player_id: string
    name: string
    avatar: string
    title: string | null
    is_public: boolean
  }>
}

type RankInfo = {
  division: string
  tier: number
}

type SummaryResponse = {
  username: string
  avatar: string
  namecard: string
  title: string | null
  endorsement: {
    level: number
  }
  competitive: {
    pc: {
      season: number
      tank: RankInfo | null
      damage: RankInfo | null
      support: RankInfo | null
      open: RankInfo | null
    } | null
    console: {
      season: number
      tank: RankInfo | null
      damage: RankInfo | null
      support: RankInfo | null
      open: RankInfo | null
    } | null
  }
  last_updated_at: number
}

type StatsBucket = {
  games_played: number
  games_won: number
  games_lost: number
  time_played: number
  winrate: number
  kda: number
  total: {
    eliminations: number
    assists: number
    deaths: number
    damage: number
    healing: number
  }
  average: {
    eliminations: number
    assists: number
    deaths: number
    damage: number
    healing: number
  }
}

type StatsSummaryResponse = {
  general: StatsBucket
  roles: Partial<Record<RoleKey, StatsBucket>>
  heroes: Record<string, StatsBucket>
}

type ProfileView = {
  battleTag: string
  username: string
  playerId: string
  avatar: string
  title: string | null
  endorsementLevel: number
  lastUpdatedAt: number
  currentSeason: number | null
  currentRanks: Array<{ role: string; rank: string }>
  headlineRole: string
  summary: string
  general: StatsBucket
  roleRows: Array<{ role: string; bucket: StatsBucket }>
  heroRows: Array<{ hero: string; bucket: StatsBucket }>
  cachedAt: number
}

const API_BASE = 'https://overfast-api.tekrop.fr'
const INITIAL_TAG = 'TeKrop#2217'
const PROFILE_CACHE_KEY = 'overwatch-profile-cache-v1'
const LAST_PROFILE_KEY = 'overwatch-last-profile-v1'

type CachedProfiles = Record<string, ProfileView>

function normalizeBattleTag(value: string) {
  return value.trim().replace('#', '-')
}

function formatBattleTag(value: string) {
  return value.includes('#') ? value : value.replace('-', '#')
}

function titleCase(value: string) {
  return value.replace(/(^|-)([a-z])/g, (_, dash: string, letter: string) => `${dash === '-' ? ' ' : ''}${letter.toUpperCase()}`)
}

function formatRank(rank: RankInfo | null) {
  if (!rank) {
    return 'Unranked'
  }

  return `${titleCase(rank.division)} ${rank.tier}`
}

function formatSeconds(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }

  return `${minutes}m`
}

function formatDate(unixSeconds: number) {
  return new Date(unixSeconds * 1000).toLocaleString()
}

function formatClientDate(timestamp: number) {
  return new Date(timestamp).toLocaleString()
}

function pickHeadlineRole(roles: Partial<Record<RoleKey, StatsBucket>>) {
  const ordered = Object.entries(roles)
    .filter((entry): entry is [RoleKey, StatsBucket] => Boolean(entry[1]))
    .sort((left, right) => right[1].time_played - left[1].time_played)

  if (ordered.length === 0) {
    return 'No role data yet'
  }

  return titleCase(ordered[0][0])
}

function buildSummary(username: string, general: StatsBucket, headlineRole: string) {
  const games = general.games_played
  const winrate = general.winrate.toFixed(1)
  const kda = general.kda.toFixed(2)
  return `${username} has ${games} competitive games tracked on the selected profile snapshot, a ${winrate}% win rate, and a ${kda} KDA. Most playtime currently sits on ${headlineRole.toLowerCase()}.`
}

function heroLabel(hero: string) {
  return hero
    .split('-')
    .map((part) => (part === 'dva' ? 'D.Va' : titleCase(part)))
    .join(' ')
}

async function fetchJson<T>(path: string) {
  const response = await fetch(`${API_BASE}${path}`)

  if (!response.ok) {
    throw new Error(`API request failed with ${response.status}`)
  }

  return (await response.json()) as T
}

async function loadProfile(rawBattleTag: string): Promise<ProfileView> {
  const lookup = normalizeBattleTag(rawBattleTag)

  if (!lookup) {
    throw new Error('Enter a BattleTag first.')
  }

  const search = await fetchJson<SearchResponse>(`/players?name=${encodeURIComponent(lookup)}`)
  const candidate = search.results.find((result) => result.player_id.toLowerCase() === lookup.toLowerCase()) ?? search.results[0]

  if (!candidate) {
    throw new Error('No public Overwatch profile was found for that BattleTag.')
  }

  if (!candidate.is_public) {
    throw new Error('That profile is private. Set the Overwatch career profile to public and try again.')
  }

  const [summary, stats] = await Promise.all([
    fetchJson<SummaryResponse>(`/players/${encodeURIComponent(candidate.player_id)}/summary`),
    fetchJson<StatsSummaryResponse>(`/players/${encodeURIComponent(candidate.player_id)}/stats/summary?gamemode=competitive&platform=pc`),
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
    .sort((left, right) => right[1].time_played - left[1].time_played)
    .map(([role, bucket]) => ({ role: titleCase(role), bucket }))

  const heroRows = Object.entries(stats.heroes)
    .filter((entry) => entry[1].time_played > 0)
    .sort((left, right) => right[1].time_played - left[1].time_played)
    .slice(0, 6)
    .map(([hero, bucket]) => ({ hero: heroLabel(hero), bucket }))

  const headlineRole = pickHeadlineRole(stats.roles)

  return {
    battleTag: formatBattleTag(candidate.player_id),
    username: summary.username,
    playerId: candidate.player_id,
    avatar: summary.avatar || candidate.avatar,
    title: summary.title,
    endorsementLevel: summary.endorsement.level,
    lastUpdatedAt: summary.last_updated_at,
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

function readProfileCache() {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const rawCache = window.localStorage.getItem(PROFILE_CACHE_KEY)
    if (!rawCache) {
      return {}
    }

    return JSON.parse(rawCache) as CachedProfiles
  } catch {
    return {}
  }
}

function writeProfileCache(cache: CachedProfiles) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cache))
}

function readCachedProfile(battleTag: string) {
  const lookup = normalizeBattleTag(battleTag).toLowerCase()
  if (!lookup) {
    return null
  }

  return readProfileCache()[lookup] ?? null
}

function storeCachedProfile(profile: ProfileView) {
  const cache = readProfileCache()
  cache[normalizeBattleTag(profile.battleTag).toLowerCase()] = profile
  writeProfileCache(cache)
  window.localStorage.setItem(LAST_PROFILE_KEY, normalizeBattleTag(profile.battleTag))
}

function readLastProfile() {
  if (typeof window === 'undefined') {
    return null
  }

  const lastProfileKey = window.localStorage.getItem(LAST_PROFILE_KEY)
  if (!lastProfileKey) {
    return null
  }

  return readProfileCache()[lastProfileKey.toLowerCase()] ?? null
}

function App() {
  const [inputValue, setInputValue] = useState(() => readLastProfile()?.battleTag ?? INITIAL_TAG)
  const [profile, setProfile] = useState<ProfileView | null>(() => readLastProfile())
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(() => (readLastProfile() ? 'success' : 'idle'))
  const [errorMessage, setErrorMessage] = useState('')
  const [isCachedProfile, setIsCachedProfile] = useState(() => Boolean(readLastProfile()))

  async function runLookup(battleTag: string) {
    setStatus('loading')
    setErrorMessage('')

    try {
      const cachedProfile = readCachedProfile(battleTag)
      if (cachedProfile) {
        setProfile(cachedProfile)
        setInputValue(cachedProfile.battleTag)
        setIsCachedProfile(true)
        setStatus('success')
        return
      }

      const nextProfile = await loadProfile(battleTag)
      setProfile(nextProfile)
      setInputValue(nextProfile.battleTag)
      storeCachedProfile(nextProfile)
      setIsCachedProfile(false)
      setStatus('success')
    } catch (error) {
      setStatus('error')
      setProfile(null)
      setIsCachedProfile(false)
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong while loading the profile.')
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void runLookup(inputValue)
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Overwatch performance tracker</p>
          <h1>Overwatch career lookup</h1>
          <p className="hero-text">
            Live public profile stats for any BattleTag.
          </p>
        </div>

        <form className="search-panel" onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="battletag">
            BattleTag
          </label>
          <div className="field-row">
            <input
              id="battletag"
              name="battletag"
              type="text"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder="Player#1234"
              autoComplete="off"
            />
            <button type="submit" disabled={status === 'loading'}>
              {status === 'loading' ? 'Loading...' : 'Load stats'}
            </button>
          </div>
          <p className="field-hint">The profile must be public in Overwatch. BattleTags can be typed with either `#` or `-`.</p>
        </form>
      </section>

      {status === 'error' ? (
        <section className="panel message-panel">
          <p className="eyebrow">Lookup issue</p>
          <h2>Couldn&apos;t load that profile</h2>
          <p className="panel-note">{errorMessage}</p>
        </section>
      ) : status === 'idle' ? (
        <section className="panel message-panel">
          <p className="eyebrow">Ready</p>
          <h2>Search a public Overwatch profile</h2>
          <p className="panel-note">Try the prefilled sample or enter your own BattleTag to load real competitive stats.</p>
        </section>
      ) : null}

      {profile ? (
        <>
          <section className="summary-grid">
            <article className="stat-card featured">
              <div className="identity-row">
                <img className="avatar" src={profile.avatar} alt="" />
                <div>
                  <span className="stat-label">BattleTag</span>
                  <strong>{profile.battleTag}</strong>
                  <p>{profile.title ?? 'No player title equipped'}</p>
                </div>
              </div>
            </article>
            <article className="stat-card">
              <span className="stat-label">Current season</span>
              <strong>{profile.currentSeason ? `Season ${profile.currentSeason}` : 'Unavailable'}</strong>
              <p>Main role by playtime: {profile.headlineRole}</p>
            </article>
            <article className="stat-card">
              <span className="stat-label">Profile snapshot</span>
              <strong>Endorsement {profile.endorsementLevel}</strong>
              <p>Last updated: {formatDate(profile.lastUpdatedAt)}</p>
              <p>{isCachedProfile ? `Loaded from cache at ${formatClientDate(profile.cachedAt)}` : 'Loaded fresh from the live profile API'}</p>
            </article>
          </section>

          <section className="content-grid">
            <article className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Competitive summary</p>
                  <h2>Live profile snapshot</h2>
                </div>
                <p className="panel-note">PC competitive stats from the public career profile.</p>
              </div>

              <p className="lead-copy">{profile.summary}</p>

              <div className="metric-grid">
                <div className="metric-chip">
                  <span className="stat-label">Games</span>
                  <strong>{profile.general.games_played}</strong>
                </div>
                <div className="metric-chip">
                  <span className="stat-label">Win rate</span>
                  <strong>{profile.general.winrate.toFixed(1)}%</strong>
                </div>
                <div className="metric-chip">
                  <span className="stat-label">KDA</span>
                  <strong>{profile.general.kda.toFixed(2)}</strong>
                </div>
                <div className="metric-chip">
                  <span className="stat-label">Time played</span>
                  <strong>{formatSeconds(profile.general.time_played)}</strong>
                </div>
              </div>
            </article>

            <article className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Current comp ranks</p>
                  <h2>Queue placements</h2>
                </div>
              </div>

              <div className="rank-list">
                {profile.currentRanks.map((entry) => (
                  <div className="rank-card" key={entry.role}>
                    <span className="stat-label">{entry.role}</span>
                    <strong>{entry.rank}</strong>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="content-grid">
            <article className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Role splits</p>
                  <h2>Where the games go</h2>
                </div>
                <p className="panel-note">Sorted by time played in competitive on PC.</p>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Role</th>
                      <th>Games</th>
                      <th>Win rate</th>
                      <th>KDA</th>
                      <th>Damage / 10</th>
                      <th>Healing / 10</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.roleRows.map((row) => (
                      <tr key={row.role}>
                        <td>{row.role}</td>
                        <td>{row.bucket.games_played}</td>
                        <td>{row.bucket.winrate.toFixed(1)}%</td>
                        <td>{row.bucket.kda.toFixed(2)}</td>
                        <td>{row.bucket.average.damage.toLocaleString()}</td>
                        <td>{row.bucket.average.healing.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Top heroes</p>
                  <h2>Most played picks</h2>
                </div>
              </div>

              <div className="insight-list">
                {profile.heroRows.map((row) => (
                  <div className="insight-card" key={row.hero}>
                    <span className="stat-label">{row.hero}</span>
                    <strong>{formatSeconds(row.bucket.time_played)}</strong>
                    <p>
                      {row.bucket.games_played} games, {row.bucket.winrate.toFixed(1)}% win rate, {row.bucket.average.damage.toLocaleString()} damage / 10
                    </p>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="panel season-table-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Overall totals</p>
                <h2>Competitive output</h2>
              </div>
              <p className="panel-note">All values here come from the live public profile snapshot for the selected player.</p>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Total</th>
                    <th>Per 10</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Eliminations</td>
                    <td>{profile.general.total.eliminations.toLocaleString()}</td>
                    <td>{profile.general.average.eliminations.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>Assists</td>
                    <td>{profile.general.total.assists.toLocaleString()}</td>
                    <td>{profile.general.average.assists.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>Deaths</td>
                    <td>{profile.general.total.deaths.toLocaleString()}</td>
                    <td>{profile.general.average.deaths.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>Damage</td>
                    <td>{profile.general.total.damage.toLocaleString()}</td>
                    <td>{profile.general.average.damage.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td>Healing</td>
                    <td>{profile.general.total.healing.toLocaleString()}</td>
                    <td>{profile.general.average.healing.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : status === 'loading' ? (
        <section className="panel message-panel">
          <p className="eyebrow">Loading</p>
          <h2>Pulling live career data</h2>
          <p className="panel-note">Searching the BattleTag, then loading the public competitive summary and hero splits.</p>
        </section>
      ) : null}
    </main>
  )
}

export default App
