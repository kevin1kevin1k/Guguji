import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import TransactionList from './pages/TransactionList'
import AddTransaction from './pages/AddTransaction'
import StockDetail from './pages/StockDetail'
import SplitEvents from './pages/SplitEvents'
import Alerts from './pages/Alerts'
import AlertHistory from './pages/AlertHistory'
import Settings from './pages/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <nav className="p-4 border-b flex gap-4 text-sm">
        <Link to="/" className="font-bold">股股記 Guguji</Link>
        <Link to="/transactions">Transactions</Link>
        <Link to="/split-events">Splits</Link>
        <Link to="/alerts">Alerts</Link>
        <Link to="/alert-history">Alert History</Link>
        <Link to="/settings">Settings</Link>
      </nav>
      <main className="p-4">
        <Routes>
          <Route path="/" element={<Dashboard />} />
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
