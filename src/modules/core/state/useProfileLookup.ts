import { useMemo, useState } from 'react'
import { loadProfile } from '../data/profileApi'
import {
  readCachedProfile,
  readLastProfile,
  storeCachedProfile,
} from '../data/profileCache'
import { buildPieDistribution } from '../business/profileUtils'

const INITIAL_TAG = 'TeKrop#2217'

export function useProfileLookup() {
  const initialProfile = readLastProfile()
  const [inputValue, setInputValue] = useState(() => initialProfile?.battleTag ?? INITIAL_TAG)
  const [profile, setProfile] = useState(() => initialProfile)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(() =>
    initialProfile ? 'success' : 'idle',
  )
  const [errorMessage, setErrorMessage] = useState('')
  const [isCachedProfile, setIsCachedProfile] = useState(() => Boolean(initialProfile))

  const roleDistribution = useMemo(
    () => (profile ? buildPieDistribution(profile.roleRows) : null),
    [profile],
  )

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

  return {
    errorMessage,
    inputValue,
    isCachedProfile,
    profile,
    roleDistribution,
    runLookup,
    setInputValue,
    status,
  }
}
