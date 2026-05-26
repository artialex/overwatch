import type { FormEvent } from 'react'
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
import {
  formatClientDate,
  formatDate,
  formatSeconds,
} from '../business/profileUtils'
import type { StatsBucket } from '../business/profileTypes'
import { useProfileLookup } from '../state/useProfileLookup'

function SectionLabel({ children }: { children: string }) {
  return (
    <Text c="dimmed" tt="uppercase" fw={600} fz="xs">
      {children}
    </Text>
  )
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Paper withBorder p="lg" radius="md">
      <Text c="dimmed" tt="uppercase" fw={600} fz="xs">
        {label}
      </Text>
      <Title order={3} mt="sm">
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

function RoleDistributionChart({
  roleDistribution,
}: {
  roleDistribution: ReturnType<typeof useProfileLookup>['roleDistribution']
}) {
  if (!roleDistribution) {
    return null
  }

  return (
    <Grid align="center" gap="lg">
      <Grid.Col span={{ base: 12, sm: 5 }}>
        {roleDistribution.totalGames > 0 ? (
          <Box maw={220} mx="auto">
            <svg viewBox="0 0 200 200" width="100%" aria-label="Games distribution pie chart">
              {roleDistribution.segments.map((segment) => (
                <path key={segment.role} d={segment.path} fill={segment.color} stroke="white" strokeWidth="2" />
              ))}
              <circle cx="100" cy="100" r="34" fill="white" />
              <text x="100" y="94" textAnchor="middle" fontSize="12" fill="#868e96">
                Games
              </text>
              <text x="100" y="114" textAnchor="middle" fontSize="22" fontWeight="700" fill="#212529">
                {roleDistribution.totalGames}
              </text>
            </svg>
          </Box>
        ) : (
          <Paper withBorder p="lg" radius="md">
            <Text c="dimmed" ta="center">
              No role distribution available yet.
            </Text>
          </Paper>
        )}
      </Grid.Col>

      <Grid.Col span={{ base: 12, sm: 7 }}>
        <Stack gap="sm">
          {roleDistribution.segments.map((segment) => (
            <Group key={segment.role} justify="space-between" wrap="nowrap">
              <Group gap="sm" wrap="nowrap">
                <Box w={12} h={12} style={{ borderRadius: '999px', background: segment.color }} />
                <Text>{segment.role}</Text>
              </Group>
              <Text c="dimmed">
                {segment.games} games ({segment.percentage.toFixed(1)}%)
              </Text>
            </Group>
          ))}
        </Stack>
      </Grid.Col>
    </Grid>
  )
}

function RoleSplitTable({
  roleRows,
}: {
  roleRows: Array<{ role: string; bucket: StatsBucket }>
}) {
  return (
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
          {roleRows.map((row) => (
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
  )
}

function WinRateRail({ winrate }: { winrate: number }) {
  const clampedWinrate = Math.max(0, Math.min(100, winrate))

  return (
    <Paper withBorder p="lg" radius="md" mt="md">
      <Stack gap="xs">
        <Group justify="space-between">
          <SectionLabel>Win Rate</SectionLabel>
          <Text fw={600}>{clampedWinrate.toFixed(1)}%</Text>
        </Group>

        <Box pos="relative" pt="lg" pb="xs">
          <Box h={8} bg="gray.2" style={{ borderRadius: 999 }} />

          <Box
            pos="absolute"
            top={0}
            left={`clamp(0%, calc(${clampedWinrate}% - 28px), calc(100% - 56px))`}
          >
            <Stack gap={4} align="center">
              <Paper withBorder px="xs" py={4} radius="sm">
                <Text fz="sm" fw={700}>
                  {clampedWinrate.toFixed(1)}%
                </Text>
              </Paper>
              <Box w={2} h={18} bg="blue.6" />
            </Stack>
          </Box>

          <Group justify="space-between" mt="md">
            <Text c="dimmed" fz="xs">
              0%
            </Text>
            <Text c="dimmed" fz="xs">
              50%
            </Text>
            <Text c="dimmed" fz="xs">
              100%
            </Text>
          </Group>
        </Box>
      </Stack>
    </Paper>
  )
}

export function CoreApp() {
  const {
    errorMessage,
    inputValue,
    isCachedProfile,
    profile,
    roleDistribution,
    runLookup,
    setInputValue,
    status,
  } = useProfileLookup()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void runLookup(inputValue)
  }

  return (
    <Box py="md">
      <Container size="xl">
        <Paper withBorder p="lg" radius="md">
          <Grid align="center" gap="lg">
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Stack gap={4}>
                <SectionLabel>Overwatch Performance Tracker</SectionLabel>
                <Title order={2}>Overwatch career lookup</Title>
                <Text c="dimmed">Live public profile stats for any BattleTag.</Text>
              </Stack>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 8 }}>
              <Paper withBorder p="md" radius="md">
                <form onSubmit={handleSubmit}>
                  <Stack gap="xs">
                    <Text c="dimmed" tt="uppercase" fw={600} fz="xs">
                      BattleTag
                    </Text>
                    <Group align="end" wrap="nowrap">
                      <TextInput
                        value={inputValue}
                        onChange={(event) => setInputValue(event.currentTarget.value)}
                        placeholder="Player#1234"
                        size="md"
                        style={{ flex: 1 }}
                      />
                      <Button type="submit" size="md" loading={status === 'loading'}>
                        Load stats
                      </Button>
                    </Group>
                    <Text c="dimmed" fz="sm">
                      The profile must be public in Overwatch. BattleTags can be typed with either `#` or `-`.
                    </Text>
                  </Stack>
                </form>
              </Paper>
            </Grid.Col>
          </Grid>
        </Paper>

        {profile ? <WinRateRail winrate={profile.general.winrate} /> : null}
      </Container>

      <Container size="xl" py="xl">
        <Stack gap="xl">
          {status === 'error' ? (
            <Paper p="xl" withBorder radius="md">
              <Stack gap="xs">
                <SectionLabel>Lookup Issue</SectionLabel>
                <Title order={2}>Couldn&apos;t load that profile</Title>
                <Text c="dimmed">{errorMessage}</Text>
              </Stack>
            </Paper>
          ) : null}

          {status === 'idle' ? (
            <Paper p="xl" withBorder radius="md">
              <Stack gap="xs">
                <SectionLabel>Ready</SectionLabel>
                <Title order={2}>Search a public Overwatch profile</Title>
                <Text c="dimmed">Try the prefilled sample or enter your own BattleTag to load real competitive stats.</Text>
              </Stack>
            </Paper>
          ) : null}

          {status === 'loading' && !profile ? (
            <Paper p="xl" withBorder radius="md">
              <Stack gap="xs">
                <SectionLabel>Loading</SectionLabel>
                <Title order={2}>Pulling live career data</Title>
                <Text c="dimmed">Searching the BattleTag, then loading the public competitive summary and hero splits.</Text>
              </Stack>
            </Paper>
          ) : null}

          {profile ? (
            <>
              <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
                <Paper p="xl" withBorder radius="md">
                  <Group align="center" wrap="nowrap">
                    <Avatar src={profile.avatar} size={76} radius="md" />
                    <Stack gap={4}>
                      <SectionLabel>BattleTag</SectionLabel>
                      <Title order={3}>{profile.battleTag}</Title>
                      <Text c="dimmed">{profile.title ?? 'No player title equipped'}</Text>
                    </Stack>
                  </Group>
                </Paper>

                <MetricCard
                  label="Current Season"
                  value={profile.currentSeason ? `Season ${profile.currentSeason}` : 'Unavailable'}
                  hint={`Main role by playtime: ${profile.headlineRole}`}
                />

                <Paper p="xl" withBorder radius="md">
                  <Stack gap={4}>
                    <SectionLabel>Profile Snapshot</SectionLabel>
                    <Title order={3}>Endorsement {profile.endorsementLevel}</Title>
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
                  <Paper p="xl" withBorder radius="md">
                    <Stack gap="lg">
                      <Group justify="space-between" align="start">
                        <div>
                          <SectionLabel>Competitive Summary</SectionLabel>
                          <Title order={2}>Live profile snapshot</Title>
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
                  <Paper p="xl" withBorder radius="md">
                    <Stack gap="lg">
                      <div>
                        <SectionLabel>Current Comp Ranks</SectionLabel>
                        <Title order={2}>Queue placements</Title>
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
                  <Stack gap="lg">
                    <Paper p="xl" withBorder radius="md">
                      <Stack gap="lg">
                        <Group justify="space-between" align="start">
                          <div>
                            <SectionLabel>Role Splits</SectionLabel>
                            <Title order={2}>Where the games go</Title>
                          </div>
                          <Text c="dimmed" maw={220} ta="right" fz="sm">
                            Sorted by time played in competitive on PC.
                          </Text>
                        </Group>

                        <RoleSplitTable roleRows={profile.roleRows} />
                      </Stack>
                    </Paper>

                    <Paper p="xl" withBorder radius="md">
                      <Stack gap="lg">
                        <div>
                          <SectionLabel>Games Distribution</SectionLabel>
                          <Title order={2}>Tank vs damage vs support</Title>
                        </div>

                        <RoleDistributionChart roleDistribution={roleDistribution} />
                      </Stack>
                    </Paper>
                  </Stack>
                </Grid.Col>

                <Grid.Col span={{ base: 12, lg: 5 }}>
                  <Paper p="xl" withBorder radius="md">
                    <Stack gap="lg">
                      <div>
                        <SectionLabel>Top Heroes</SectionLabel>
                        <Title order={2}>Most played picks</Title>
                      </div>

                      <Stack gap="md">
                        {profile.heroRows.map((row) => (
                          <Paper key={row.hero} p="lg" withBorder radius="md">
                            <Stack gap={6}>
                              <Text c="dimmed" tt="uppercase" fw={600} fz="xs">
                                {row.hero}
                              </Text>
                              <Title order={3}>{formatSeconds(row.bucket.timePlayed)}</Title>
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

              <Paper p="xl" withBorder radius="md">
                <Stack gap="lg">
                  <Group justify="space-between" align="start">
                    <div>
                      <SectionLabel>Overall Totals</SectionLabel>
                      <Title order={2}>Competitive output</Title>
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
