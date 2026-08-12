'use client'

import { useState, useEffect, useCallback } from 'react'

type UseDataFetchingOptions = {
  /** Skip initial fetch (useful for conditional loading) */
  skip?: boolean
}

type UseDataFetchingResult<T> = {
  data: T
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Generic hook for data fetching with loading and error states
 *
 * @example
 * const { data: members, loading, refetch } = useDataFetching<Member[]>(
 *   '/api/members?include=all',
 *   []
 * )
 */
export function useDataFetching<T>(
  endpoint: string,
  initialValue: T,
  options: UseDataFetchingOptions = {}
): UseDataFetchingResult<T> {
  const [data, setData] = useState<T>(initialValue)
  const [loading, setLoading] = useState(!options.skip)
  const [error, setError] = useState<Error | null>(null)

  // Does not switch the spinner on itself: the initial state already reflects
  // the pending load, and refetch() sets it from the caller's event handler.
  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(endpoint)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const result = await response.json()
      setData(result)
      setError(null)
    } catch (err) {
      console.error(`Error fetching ${endpoint}:`, err)
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setLoading(false)
    }
  }, [endpoint])

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    await fetchData()
  }, [fetchData])

  useEffect(() => {
    if (options.skip) return
    // Wrapped in an async function so the load starts after the effect has
    // run, instead of updating state synchronously inside it.
    const run = async () => {
      await fetchData()
    }
    void run()
  }, [fetchData, options.skip])

  return { data, loading, error, refetch }
}
