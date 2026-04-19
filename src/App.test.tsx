import { render, screen } from '@testing-library/react'
import { AuthProvider } from './contexts/AuthContext'
import App from './App'

vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}))

test('renders app title', () => {
  render(<AuthProvider><App /></AuthProvider>)
  expect(screen.getByText('股股記 Guguji')).toBeInTheDocument()
})
