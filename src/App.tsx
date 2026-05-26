import { useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import {
  Avatar,
  Badge,
  Box,
  Button,
  Container,
  Grid,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core'

type RoleKey = 'tank' | 'damage' | 'support' | 'open'

type SearchResponse = {
  total: number
  results: Array<{
    playerId: string
    name: string
    avatar: string
    title: string | null
    isPublic: boolean
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
  lastUpdatedAt: number
}

type StatsBucket = {
  gamesPlayed: number
  gamesWon: number
  gamesLost: number
  timePlayed: number
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

type CachedProfiles = Record<string, ProfileView>

const API_BASE = 'https://overfast-api.tekrop.fr'
const INITIAL_TAG = 'TeKrop#2217'
const PROFILE_CACHE_KEY = 'overwatch-profile-cache-v1'
const LAST_PROFILE_KEY = 'overwatch-last-profile-v1'

const shellBackground: CSSProperties = {
  minHeight: '100vh',
  background:
    'radial-gradient(circle at top, rgba(255, 209, 102, 0.28), transparent 28%), linear-gradient(180deg, #fbf8f3 0%, #f3efe7 100%)',
}

const stickyHeaderStyle: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 40,
  backdropFilter: 'blur(14px)',
  background:
    'linear-gradient(180deg, rgba(251, 248, 243, 0.94), rgba(243, 239, 231, 0.88))',
  borderBottom: '1px solid rgba(33, 43, 63, 0.12)',
}

const headerCardStyle: CSSProperties = {
  background:
    'radial-gradient(circle at top left, rgba(255, 140, 66, 0.18), transparent 34%), radial-gradient(circle at bottom right, rgba(50, 113, 255, 0.12), transparent 32%), rgba(255, 252, 247, 0.88)',
  border: '1px solid rgba(33, 43, 63, 0.1)',
}

const lookupPanelStyle: CSSProperties = {
  background: 'rgba(12, 16, 28, 0.72)',
  color: '#f4f7fb',
}

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
    .sort((left, right) => right[1].timePlayed - left[1].timePlayed)

  if (ordered.length === 0) {
    return 'No role data yet'
  }

  return titleCase(ordered[0][0])
}

function buildSummary(username: string, general: StatsBucket, headlineRole: string) {
  return `${username} has ${general.gamesPlayed} competitive games tracked on the selected profile snapshot, a ${general.winrate.toFixed(1)}% win rate, and a ${general.kda.toFixed(2)} KDA. Most playtime currently sits on ${headlineRole.toLowerCase()}.`
}

function heroLabel(hero: string) {
  return hero
    .split('-')
    .map((part) => (part === 'dva' ? 'D.Va' : titleCase(part)))
    .join(' ')
}

function toCamelCase(value: string) {
  return value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
}

function camelizeKeys<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => camelizeKeys(item)) as T
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce<Record<string, unknown>>((result, [key, nestedValue]) => {
      result[toCamelCase(key)] = camelizeKeys(nestedValue)
      return result
    }, {}) as T
  }

  return value
}

async function fetchJson<T>(path: string) {
  const response = await fetch(`${API_BASE}${path}`)

  if (!response.ok) {
    throw new Error(`API request failed with ${response.status}`)
  }

  return camelizeKeys((await response.json()) as T)
}

async function loadProfile(rawBattleTag: string): Promise<ProfileView> {
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

function readProfileCache() {
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

function SectionLabel({ children }: { children: string }) {
  return (
    <Text c="orange.7" tt="uppercase" fw={600} fz="0.72rem" style={{ letterSpacing: '0.14em' }}>
      {children}
    </Text>
  )
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Paper radius="xl" p="lg" bg="rgba(248, 242, 232, 0.9)" withBorder>
      <Text c="dimmed" tt="uppercase" fw={600} fz="0.72rem" style={{ letterSpacing: '0.12em' }}>
        {label}
      </Text>
      <Title order={3} mt={10} ff="Georgia, serif">
        {value}
      </Title>
      {hint ? (
        <Text c="dimmed" fz="sm" mt={8}>
          {hint}
        </Text>
      ) : null}
    </Paper>
  )
}

function App() {
  const initialProfile = readLastProfile()
  const [inputValue, setInputValue] = useState(() => initialProfile?.battleTag ?? INITIAL_TAG)
  const [profile, setProfile] = useState<ProfileView | null>(() => initialProfile)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(() => (initialProfile ? 'success' : 'idle'))
  const [errorMessage, setErrorMessage] = useState('')
  const [isCachedProfile, setIsCachedProfile] = useState(() => Boolean(initialProfile))

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
    <Box style={shellBackground}>
      <Box style={stickyHeaderStyle}>
        <Container size="xl" py="md">
          <Paper radius="28px" p="lg" style={headerCardStyle}>
            <Grid align="center" gap="lg">
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Stack gap={4}>
                  <SectionLabel>Overwatch Performance Tracker</SectionLabel>
                  <Title order={2} ff="Georgia, serif">
                    Overwatch career lookup
                  </Title>
                  <Text c="dimmed">Live public profile stats for any BattleTag.</Text>
                </Stack>
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 8 }}>
                <Paper radius="24px" p="md" style={lookupPanelStyle}>
                  <form onSubmit={handleSubmit}>
                    <Stack gap="xs">
                      <Text c="gray.3" tt="uppercase" fw={700} fz="0.75rem" style={{ letterSpacing: '0.14em' }}>
                        BattleTag
                      </Text>
                      <Group align="end" wrap="nowrap">
                        <TextInput
                          value={inputValue}
                          onChange={(event) => setInputValue(event.currentTarget.value)}
                          placeholder="Player#1234"
                          size="md"
                          radius="xl"
                          styles={{
                            input: {
                              background: 'rgba(255,255,255,0.08)',
                              color: '#f4f7fb',
                              borderColor: 'rgba(255,255,255,0.14)',
                            },
                          }}
                          style={{ flex: 1 }}
                        />
                        <Button
                          type="submit"
                          size="md"
                          radius="xl"
                          loading={status === 'loading'}
                          color="orange"
                          variant="gradient"
                          gradient={{ from: '#ffd166', to: '#ff8c42', deg: 135 }}
                          styles={{ label: { color: '#08111c', fontWeight: 800 } }}
                        >
                          Load stats
                        </Button>
                      </Group>
                      <Text c="gray.4" fz="sm" lh={1.4}>
                        The profile must be public in Overwatch. BattleTags can be typed with either `#` or `-`.
                      </Text>
                    </Stack>
                  </form>
                </Paper>
              </Grid.Col>
            </Grid>
          </Paper>
        </Container>
      </Box>

      <Container size="xl" py="xl">
        <Stack gap="xl">
          {status === 'error' ? (
            <Paper radius="28px" p="xl" withBorder shadow="sm">
              <Stack gap="xs">
                <SectionLabel>Lookup Issue</SectionLabel>
                <Title order={2} ff="Georgia, serif">
                  Couldn&apos;t load that profile
                </Title>
                <Text c="dimmed">{errorMessage}</Text>
              </Stack>
            </Paper>
          ) : null}

          {status === 'idle' ? (
            <Paper radius="28px" p="xl" withBorder shadow="sm">
              <Stack gap="xs">
                <SectionLabel>Ready</SectionLabel>
                <Title order={2} ff="Georgia, serif">
                  Search a public Overwatch profile
                </Title>
                <Text c="dimmed">Try the prefilled sample or enter your own BattleTag to load real competitive stats.</Text>
              </Stack>
            </Paper>
          ) : null}

          {status === 'loading' && !profile ? (
            <Paper radius="28px" p="xl" withBorder shadow="sm">
              <Stack gap="xs">
                <SectionLabel>Loading</SectionLabel>
                <Title order={2} ff="Georgia, serif">
                  Pulling live career data
                </Title>
                <Text c="dimmed">Searching the BattleTag, then loading the public competitive summary and hero splits.</Text>
              </Stack>
            </Paper>
          ) : null}

          {profile ? (
            <>
              <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
                <Paper radius="28px" p="xl" shadow="sm" withBorder style={{ background: 'linear-gradient(135deg, rgba(255, 209, 102, 0.22), rgba(255, 140, 66, 0.1)), rgba(255, 252, 247, 0.9)' }}>
                  <Group align="center" wrap="nowrap">
                    <Avatar src={profile.avatar} size={76} radius="xl" />
                    <Stack gap={4}>
                      <SectionLabel>BattleTag</SectionLabel>
                      <Title order={3} ff="Georgia, serif">
                        {profile.battleTag}
                      </Title>
                      <Text c="dimmed">{profile.title ?? 'No player title equipped'}</Text>
                    </Stack>
                  </Group>
                </Paper>

                <MetricCard
                  label="Current Season"
                  value={profile.currentSeason ? `Season ${profile.currentSeason}` : 'Unavailable'}
                  hint={`Main role by playtime: ${profile.headlineRole}`}
                />

                <Paper radius="28px" p="xl" shadow="sm" withBorder>
                  <Stack gap={4}>
                    <SectionLabel>Profile Snapshot</SectionLabel>
                    <Title order={3} ff="Georgia, serif">
                      Endorsement {profile.endorsementLevel}
                    </Title>
                    <Text c="dimmed" fz="sm">
                      Last updated: {formatDate(profile.lastUpdatedAt)}
                    </Text>
                    <Badge color={isCachedProfile ? 'blue' : 'orange'} variant="light" radius="sm" w="fit-content">
                      {isCachedProfile ? `Cached at ${formatClientDate(profile.cachedAt)}` : 'Fresh API response'}
                    </Badge>
                  </Stack>
                </Paper>
              </SimpleGrid>

              <Grid gap="lg">
                <Grid.Col span={{ base: 12, lg: 7 }}>
                  <Paper radius="28px" p="xl" withBorder shadow="sm">
                    <Stack gap="lg">
                      <Group justify="space-between" align="start">
                        <div>
                          <SectionLabel>Competitive Summary</SectionLabel>
                          <Title order={2} ff="Georgia, serif">
                            Live profile snapshot
                          </Title>
                        </div>
                        <Text c="dimmed" maw={220} ta="right" fz="sm">
                          PC competitive stats from the public career profile.
                        </Text>
                      </Group>

                      <Text c="dimmed">{profile.summary}</Text>

                      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                        <MetricCard label="Games" value={String(profile.general.gamesPlayed)} />
                        <MetricCard label="Win Rate" value={`${profile.general.winrate.toFixed(1)}%`} />
                        <MetricCard label="KDA" value={profile.general.kda.toFixed(2)} />
                        <MetricCard label="Time Played" value={formatSeconds(profile.general.timePlayed)} />
                      </SimpleGrid>
                    </Stack>
                  </Paper>
                </Grid.Col>

                <Grid.Col span={{ base: 12, lg: 5 }}>
                  <Paper radius="28px" p="xl" withBorder shadow="sm">
                    <Stack gap="lg">
                      <div>
                        <SectionLabel>Current Comp Ranks</SectionLabel>
                        <Title order={2} ff="Georgia, serif">
                          Queue placements
                        </Title>
                      </div>

                      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                        {profile.currentRanks.map((entry) => (
                          <MetricCard key={entry.role} label={entry.role} value={entry.rank} />
                        ))}
                      </SimpleGrid>
                    </Stack>
                  </Paper>
                </Grid.Col>
              </Grid>

              <Grid gap="lg">
                <Grid.Col span={{ base: 12, lg: 7 }}>
                  <Paper radius="28px" p="xl" withBorder shadow="sm">
                    <Stack gap="lg">
                      <Group justify="space-between" align="start">
                        <div>
                          <SectionLabel>Role Splits</SectionLabel>
                          <Title order={2} ff="Georgia, serif">
                            Where the games go
                          </Title>
                        </div>
                        <Text c="dimmed" maw={220} ta="right" fz="sm">
                          Sorted by time played in competitive on PC.
                        </Text>
                      </Group>

                      <Table.ScrollContainer minWidth={720}>
                        <Table highlightOnHover verticalSpacing="md">
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>Role</Table.Th>
                              <Table.Th>Games</Table.Th>
                              <Table.Th>Win rate</Table.Th>
                              <Table.Th>KDA</Table.Th>
                              <Table.Th>Damage / 10</Table.Th>
                              <Table.Th>Healing / 10</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {profile.roleRows.map((row) => (
                              <Table.Tr key={row.role}>
                                <Table.Td>{row.role}</Table.Td>
                                <Table.Td>{row.bucket.gamesPlayed}</Table.Td>
                                <Table.Td>{row.bucket.winrate.toFixed(1)}%</Table.Td>
                                <Table.Td>{row.bucket.kda.toFixed(2)}</Table.Td>
                                <Table.Td>{row.bucket.average.damage.toLocaleString()}</Table.Td>
                                <Table.Td>{row.bucket.average.healing.toLocaleString()}</Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                      </Table.ScrollContainer>
                    </Stack>
                  </Paper>
                </Grid.Col>

                <Grid.Col span={{ base: 12, lg: 5 }}>
                  <Paper radius="28px" p="xl" withBorder shadow="sm">
                    <Stack gap="lg">
                      <div>
                        <SectionLabel>Top Heroes</SectionLabel>
                        <Title order={2} ff="Georgia, serif">
                          Most played picks
                        </Title>
                      </div>

                      <Stack gap="md">
                        {profile.heroRows.map((row) => (
                          <Paper key={row.hero} radius="xl" p="lg" bg="rgba(248, 242, 232, 0.9)" withBorder>
                            <Stack gap={6}>
                              <Text c="dimmed" tt="uppercase" fw={600} fz="0.72rem" style={{ letterSpacing: '0.12em' }}>
                                {row.hero}
                              </Text>
                              <Title order={3} ff="Georgia, serif">
                                {formatSeconds(row.bucket.timePlayed)}
                              </Title>
                              <Text c="dimmed" fz="sm">
                                {row.bucket.gamesPlayed} games, {row.bucket.winrate.toFixed(1)}% win rate, {row.bucket.average.damage.toLocaleString()} damage / 10
                              </Text>
                            </Stack>
                          </Paper>
                        ))}
                      </Stack>
                    </Stack>
                  </Paper>
                </Grid.Col>
              </Grid>

              <Paper radius="28px" p="xl" withBorder shadow="sm">
                <Stack gap="lg">
                  <Group justify="space-between" align="start">
                    <div>
                      <SectionLabel>Overall Totals</SectionLabel>
                      <Title order={2} ff="Georgia, serif">
                        Competitive output
                      </Title>
                    </div>
                    <Text c="dimmed" maw={260} ta="right" fz="sm">
                      All values here come from the live public profile snapshot for the selected player.
                    </Text>
                  </Group>

                  <Table.ScrollContainer minWidth={520}>
                    <Table highlightOnHover verticalSpacing="md">
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Metric</Table.Th>
                          <Table.Th>Total</Table.Th>
                          <Table.Th>Per 10</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        <Table.Tr>
                          <Table.Td>Eliminations</Table.Td>
                          <Table.Td>{profile.general.total.eliminations.toLocaleString()}</Table.Td>
                          <Table.Td>{profile.general.average.eliminations.toFixed(2)}</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td>Assists</Table.Td>
                          <Table.Td>{profile.general.total.assists.toLocaleString()}</Table.Td>
                          <Table.Td>{profile.general.average.assists.toFixed(2)}</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td>Deaths</Table.Td>
                          <Table.Td>{profile.general.total.deaths.toLocaleString()}</Table.Td>
                          <Table.Td>{profile.general.average.deaths.toFixed(2)}</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td>Damage</Table.Td>
                          <Table.Td>{profile.general.total.damage.toLocaleString()}</Table.Td>
                          <Table.Td>{profile.general.average.damage.toLocaleString()}</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td>Healing</Table.Td>
                          <Table.Td>{profile.general.total.healing.toLocaleString()}</Table.Td>
                          <Table.Td>{profile.general.average.healing.toLocaleString()}</Table.Td>
                        </Table.Tr>
                      </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                </Stack>
              </Paper>
            </>
          ) : null}
        </Stack>
      </Container>
    </Box>
  )
}

export default App
