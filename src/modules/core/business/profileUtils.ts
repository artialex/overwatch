import type {
  PieDistribution,
  ProfileView,
  RankInfo,
  RoleKey,
  RoleRow,
  StatsBucket,
} from './profileTypes'

export function normalizeBattleTag(value: string) {
  return value.trim().replace('#', '-')
}

export function formatBattleTag(value: string) {
  return value.includes('#') ? value : value.replace('-', '#')
}

export function titleCase(value: string) {
  return value.replace(/(^|-)([a-z])/g, (_, dash: string, letter: string) => `${dash === '-' ? ' ' : ''}${letter.toUpperCase()}`)
}

export function formatRank(rank: RankInfo | null) {
  if (!rank) {
    return 'Unranked'
  }

  return `${titleCase(rank.division)} ${rank.tier}`
}

export function formatSeconds(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }

  return `${minutes}m`
}

export function formatDate(unixSeconds: number) {
  return new Date(unixSeconds * 1000).toLocaleString()
}

export function formatClientDate(timestamp: number) {
  return new Date(timestamp).toLocaleString()
}

export function pickHeadlineRole(roles: Partial<Record<RoleKey, StatsBucket>>) {
  const ordered = Object.entries(roles)
    .filter((entry): entry is [RoleKey, StatsBucket] => Boolean(entry[1]))
    .sort((left, right) => right[1].timePlayed - left[1].timePlayed)

  if (ordered.length === 0) {
    return 'No role data yet'
  }

  return titleCase(ordered[0][0])
}

export function buildSummary(username: string, general: StatsBucket, headlineRole: string) {
  return `${username} has ${general.gamesPlayed} competitive games tracked on the selected profile snapshot, a ${general.winrate.toFixed(1)}% win rate, and a ${general.kda.toFixed(2)} KDA. Most playtime currently sits on ${headlineRole.toLowerCase()}.`
}

export function heroLabel(hero: string) {
  return hero
    .split('-')
    .map((part) => (part === 'dva' ? 'D.Va' : titleCase(part)))
    .join(' ')
}

export function toCamelCase(value: string) {
  return value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
}

export function camelizeKeys<T>(value: T): T {
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

export function buildPieDistribution(roleRows: RoleRow[]): PieDistribution {
  const orderedRoles = ['Tank', 'Damage', 'Support']
  const palette = ['#228be6', '#f76707', '#2f9e44']
  const completeRows = orderedRoles.map((role) => {
    const match = roleRows.find((row) => row.role === role)

    return {
      role,
      games: match?.bucket.gamesPlayed ?? 0,
    }
  })

  const totalGames = completeRows.reduce((sum, row) => sum + row.games, 0)

  if (totalGames === 0) {
    return {
      totalGames,
      segments: completeRows.map((row, index) => ({
        ...row,
        color: palette[index],
        percentage: 0,
        path: '',
      })),
    }
  }

  let runningFraction = 0
  const radius = 80
  const center = 100

  const segments = completeRows.map((row, index) => {
    const fraction = row.games / totalGames
    const startAngle = runningFraction * Math.PI * 2 - Math.PI / 2
    const endAngle = (runningFraction + fraction) * Math.PI * 2 - Math.PI / 2
    runningFraction += fraction

    const x1 = center + radius * Math.cos(startAngle)
    const y1 = center + radius * Math.sin(startAngle)
    const x2 = center + radius * Math.cos(endAngle)
    const y2 = center + radius * Math.sin(endAngle)
    const largeArcFlag = fraction > 0.5 ? 1 : 0
    const path = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`

    return {
      ...row,
      color: palette[index],
      percentage: fraction * 100,
      path,
    }
  })

  return { totalGames, segments }
}

export function cloneProfileWithCacheStamp(profile: ProfileView) {
  return {
    ...profile,
    cachedAt: Date.now(),
  }
}
