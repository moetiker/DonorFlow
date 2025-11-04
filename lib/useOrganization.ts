import { useEffect, useState } from 'react'

export function useOrganization() {
  const [organizationName, setOrganizationName] = useState('Gönnerverwaltung')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/organization')
      .then(r => r.json())
      .then(data => {
        if (data.organizationName) {
          setOrganizationName(data.organizationName)
        }
      })
      .catch(() => {
        // Use default on error
        setOrganizationName('Gönnerverwaltung')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  return { organizationName, loading }
}
