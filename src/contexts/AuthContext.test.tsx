import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { AuthError, Session } from '@supabase/supabase-js'
import { AuthProvider, useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    },
  },
}))

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

const mockSubscription = { data: { subscription: { unsubscribe: vi.fn() } } }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null } as never)
  vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue(mockSubscription as never)
})

describe('AuthContext', () => {
  it('starts with loading=true then resolves to loading=false with null user', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toBeNull()
    expect(result.current.session).toBeNull()
  })

  it('exposes user from session after getSession resolves', async () => {
    const fakeUser = { id: 'u1', email: 'a@b.com' }
    const fakeSession = { user: fakeUser } as Session
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: fakeSession }, error: null } as never)
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toBe(fakeUser)
    expect(result.current.session).toBe(fakeSession)
  })

  it('signIn calls signInWithPassword and returns null error on success', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({ data: {} as never, error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    let ret!: { error: AuthError | null }
    await act(async () => { ret = await result.current.signIn('x@y.com', 'pass123') })
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'x@y.com', password: 'pass123' })
    expect(ret.error).toBeNull()
  })

  it('signIn returns error on failure', async () => {
    const err = { message: 'Invalid login' } as AuthError
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({ data: {} as never, error: err })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    let ret!: { error: AuthError | null }
    await act(async () => { ret = await result.current.signIn('x@y.com', 'wrong') })
    expect(ret.error).toBe(err)
  })

  it('signUp calls supabase.auth.signUp', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({ data: {} as never, error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { await result.current.signUp('new@user.com', 'pass123') })
    expect(supabase.auth.signUp).toHaveBeenCalledWith({ email: 'new@user.com', password: 'pass123' })
  })

  it('signOut calls supabase.auth.signOut', async () => {
    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { await result.current.signOut() })
    expect(supabase.auth.signOut).toHaveBeenCalled()
  })

  it('useAuth throws when used outside AuthProvider', () => {
    expect(() => renderHook(() => useAuth())).toThrow('useAuth must be used within AuthProvider')
  })
})
