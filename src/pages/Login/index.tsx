import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

type Tab = 'signin' | 'signup'

export function Login() {
  const { user, signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (user) navigate('/')
  }, [user, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)
    try {
      if (tab === 'signin') {
        const { error } = await signIn(email, password)
        if (error) setError(error.message)
        else navigate('/')
      } else {
        const { error } = await signUp(email, password)
        if (error) setError(error.message)
        else setMessage('確認信已寄出，請至信箱驗證後再登入。')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-16">
      <h1 className="text-2xl font-bold mb-6 text-center">股股記 Guguji</h1>
      <div className="flex border-b mb-6">
        <button
          type="button"
          className={`flex-1 py-2 text-sm font-medium ${tab === 'signin' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
          onClick={() => { setTab('signin'); setError(null); setMessage(null) }}
        >
          登入
        </button>
        <button
          type="button"
          className={`flex-1 py-2 text-sm font-medium ${tab === 'signup' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
          onClick={() => { setTab('signup'); setError(null); setMessage(null) }}
        >
          註冊
        </button>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="login-email" className="block text-sm font-medium mb-1">Email</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div>
          <label htmlFor="login-password" className="block text-sm font-medium mb-1">密碼</label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        {message && <p className="text-green-600 text-sm">{message}</p>}
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white rounded py-2 text-sm font-medium disabled:opacity-50"
        >
          {loading ? '處理中...' : tab === 'signin' ? '登入' : '註冊'}
        </button>
      </form>
    </div>
  )
}
