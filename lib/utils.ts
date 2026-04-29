/**
 * Recursively serializes Date objects to ISO strings for JSON responses
 * Handles nested objects and arrays
 */
export function serializeDates<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (obj instanceof Date) {
    return obj.toISOString() as any
  }

  if (Array.isArray(obj)) {
    return obj.map(serializeDates) as any
  }

  if (typeof obj === 'object') {
    const serialized: any = {}
    for (const [key, value] of Object.entries(obj)) {
      serialized[key] = serializeDates(value)
    }
    return serialized
  }

  return obj
}

/**
 * Returns a display name for a sponsor
 * Prioritizes company name, falls back to first/last name combination
 */
export function getSponsorDisplayName(sponsor: {
  company: string | null
  firstName: string | null
  lastName: string | null
}): string {
  if (sponsor.company) {
    return sponsor.company
  }

  const parts = [sponsor.firstName, sponsor.lastName].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : 'Unbekannt'
}

/**
 * Returns a display name for a member
 */
export function getMemberDisplayName(member: {
  firstName: string
  lastName: string
}): string {
  return `${member.firstName} ${member.lastName}`
}

/**
 * Returns a display name for a group
 */
export function getGroupDisplayName(group: {
  name: string
}): string {
  return group.name
}
