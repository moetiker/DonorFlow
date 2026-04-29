'use client'

import { useState, useCallback } from 'react'

type UseFormSubmitOptions = {
  /** Base API endpoint (e.g., '/api/members') */
  endpoint: string
  /** ID of the entity being edited (null for create) */
  entityId: string | null
  /** Callback after successful save */
  onSuccess: () => void
  /** Error message for failed save */
  saveErrorMessage?: string
  /** Error message for failed delete */
  deleteErrorMessage?: string
}

type UseFormSubmitResult<T> = {
  loading: boolean
  error: string
  setError: (error: string) => void
  clearError: () => void
  /** Submit form data (POST for new, PUT for existing) */
  handleSubmit: (data: T) => Promise<boolean>
  /** Delete entity */
  handleDelete: () => Promise<boolean>
  /** Whether this is an edit (vs create) */
  isEdit: boolean
}

/**
 * Hook for handling form submission in modals
 *
 * @example
 * const { loading, error, handleSubmit, handleDelete, isEdit } = useFormSubmit({
 *   endpoint: '/api/members',
 *   entityId: member?.id || null,
 *   onSuccess: () => { onSave(); onHide(); }
 * })
 *
 * const onSubmit = async (e: React.FormEvent) => {
 *   e.preventDefault()
 *   await handleSubmit(formData)
 * }
 */
export function useFormSubmit<T = Record<string, unknown>>({
  endpoint,
  entityId,
  onSuccess,
  saveErrorMessage = 'Save failed',
  deleteErrorMessage = 'Delete failed'
}: UseFormSubmitOptions): UseFormSubmitResult<T> {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isEdit = entityId !== null

  const clearError = useCallback(() => setError(''), [])

  const handleSubmit = useCallback(async (data: T): Promise<boolean> => {
    setLoading(true)
    setError('')

    try {
      const url = isEdit ? `${endpoint}/${entityId}` : endpoint
      const method = isEdit ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || saveErrorMessage)
      }

      onSuccess()
      return true
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : saveErrorMessage
      setError(message)
      return false
    } finally {
      setLoading(false)
    }
  }, [endpoint, entityId, isEdit, onSuccess, saveErrorMessage])

  const handleDelete = useCallback(async (): Promise<boolean> => {
    if (!entityId) return false

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${endpoint}/${entityId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || deleteErrorMessage)
      }

      onSuccess()
      return true
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : deleteErrorMessage
      setError(message)
      return false
    } finally {
      setLoading(false)
    }
  }, [endpoint, entityId, onSuccess, deleteErrorMessage])

  return {
    loading,
    error,
    setError,
    clearError,
    handleSubmit,
    handleDelete,
    isEdit
  }
}
