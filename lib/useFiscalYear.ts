'use client'

import { useEffect, useState } from 'react'

export function useCurrentFiscalYear() {
  const [currentFiscalYearId, setCurrentFiscalYearId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/fiscal-years')
      .then(r => r.json())
      .then(years => {
        const now = new Date()
        const current = years.find((y: any) =>
          new Date(y.startDate) <= now && new Date(y.endDate) >= now
        )
        if (current) {
          setCurrentFiscalYearId(current.id)
        }
      })
      .catch(error => {
        console.error('Error loading fiscal year:', error)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  return { currentFiscalYearId, loading }
}
