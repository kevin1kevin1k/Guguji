import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import TransactionList from './pages/TransactionList'
import AddTransaction from './pages/AddTransaction'
import StockDetail from './pages/StockDetail'
import SplitEvents from './pages/SplitEvents'
import Alerts from './pages/Alerts'
import AlertHistory from './pages/AlertHistory'
import Settings from './pages/Settings'
import { Login } from './pages/Login'
import { useAuth } from './contexts/AuthContext'

function NavAuth() {
  const { user, signOut } = useAuth()
  if (user) {
    return (
      <div className="ml-auto flex items-center gap-2">
        <span className="text-xs text-gray-500">{user.email}</span>
        <button onClick={signOut} className="text-xs text-red-500 hover:underline">登出</button>
      </div>
    )
  }
  return <Link to="/login" className="ml-auto text-xs text-blue-600 hover:underline">Login</Link>
}

export default function App() {
  return (
    <BrowserRouter>
      <nav className="p-4 border-b flex gap-4 text-sm items-center">
        <Link to="/" className="font-bold">股股記 Guguji</Link>
        <Link to="/transactions">Transactions</Link>
        <Link to="/split-events">Splits</Link>
        <Link to="/alerts">Alerts</Link>
        <Link to="/alert-history">Alert History</Link>
        <Link to="/settings">Settings</Link>
        <NavAuth />
      </nav>
      <main className="p-4">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/login" element={<Login />} />
          <Route path="/transactions" element={<TransactionList />} />
          <Route path="/transactions/new" element={<AddTransaction />} />
          <Route path="/transactions/:id/edit" element={<AddTransaction />} />
          <Route path="/stocks/:ticker" element={<StockDetail />} />
          <Route path="/split-events" element={<SplitEvents />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/alert-history" element={<AlertHistory />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}
