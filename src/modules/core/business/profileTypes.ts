export type RoleKey = 'tank' | 'damage' | 'support' | 'open'

export type SearchResponse = {
  total: number
  results: Array<{
    playerId: string
    name: string
    avatar: string
    title: string | null
    isPublic: boolean
  }>
}

export type RankInfo = {
  division: string
  tier: number
}

export type SummaryResponse = {
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

export type StatsBucket = {
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

export type StatsSummaryResponse = {
  general: StatsBucket
  roles: Partial<Record<RoleKey, StatsBucket>>
  heroes: Record<string, StatsBucket>
}

export type RoleRow = {
  role: string
  bucket: StatsBucket
}

export type HeroRow = {
  hero: string
  bucket: StatsBucket
}

export type ProfileView = {
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
  roleRows: RoleRow[]
  heroRows: HeroRow[]
  cachedAt: number
}

export type CachedProfiles = Record<string, ProfileView>

export type PieSegment = {
  role: string
  games: number
  color: string
  percentage: number
  path: string
}

export type PieDistribution = {
  totalGames: number
  segments: PieSegment[]
}
