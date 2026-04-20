import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Login } from './index'
import { useAuth } from '../../contexts/AuthContext'
import type { AuthError } from '@supabase/supabase-js'

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

function renderLogin() {
  return render(<Login />)
}

function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('密碼'), { target: { value: password } })
  fireEvent.submit(document.querySelector('form')!)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useAuth).mockReturnValue({
    user: null,
    session: null,
    loading: false,
    signIn: vi.fn().mockResolvedValue({ error: null }),
    signUp: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn(),
  })
})

describe('Login', () => {
  it('shows 登入 tab active by default', () => {
    renderLogin()
    const tabs = screen.getAllByRole('button', { name: '登入' })
    const tabBtn = tabs.find(b => b.getAttribute('type') === 'button')!
    expect(tabBtn.className).toContain('border-blue-600')
  })

  it('switches to 註冊 tab when clicked', () => {
    renderLogin()
    const signupTabBtn = screen.getAllByRole('button', { name: '註冊' }).find(b => b.getAttribute('type') === 'button')!
    fireEvent.click(signupTabBtn)
    expect(signupTabBtn.className).toContain('border-blue-600')
  })

  it('calls signIn with email/password and navigates to / on success', async () => {
    const signIn = vi.fn().mockResolvedValue({ error: null })
    vi.mocked(useAuth).mockReturnValue({ user: null, session: null, loading: false, signIn, signUp: vi.fn(), signOut: vi.fn() })
    renderLogin()
    fillAndSubmit('a@b.com', 'pass123')
    await waitFor(() => expect(signIn).toHaveBeenCalledWith('a@b.com', 'pass123'))
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('shows error message when signIn fails', async () => {
    const err = { message: 'Invalid credentials' } as AuthError
    vi.mocked(useAuth).mockReturnValue({
      user: null, session: null, loading: false,
      signIn: vi.fn().mockResolvedValue({ error: err }),
      signUp: vi.fn(), signOut: vi.fn(),
    })
    renderLogin()
    fillAndSubmit('a@b.com', 'wrong')
    await waitFor(() => expect(screen.getByText('Invalid credentials')).toBeInTheDocument())
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('calls signUp and shows confirmation message on success', async () => {
    const signUp = vi.fn().mockResolvedValue({ error: null })
    vi.mocked(useAuth).mockReturnValue({ user: null, session: null, loading: false, signIn: vi.fn(), signUp, signOut: vi.fn() })
    renderLogin()
    fireEvent.click(screen.getByRole('button', { name: '註冊' }))
    fillAndSubmit('new@user.com', 'pass123')
    await waitFor(() => expect(signUp).toHaveBeenCalledWith('new@user.com', 'pass123'))
    expect(screen.getByText(/確認信已寄出/)).toBeInTheDocument()
  })

  it('redirects to / immediately when user is already logged in', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'u1', email: 'a@b.com' } as never,
      session: null, loading: false,
      signIn: vi.fn(), signUp: vi.fn(), signOut: vi.fn(),
    })
    renderLogin()
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'))
  })
})
