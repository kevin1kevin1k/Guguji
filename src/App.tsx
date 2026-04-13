import Dashboard from './pages/Dashboard'
import TransactionList from './pages/TransactionList'
import AddTransaction from './pages/AddTransaction'
import StockDetail from './pages/StockDetail'
import SplitEvents from './pages/SplitEvents'
import Alerts from './pages/Alerts'
import AlertHistory from './pages/AlertHistory'
import Settings from './pages/Settings'

const PAGES = [
  { name: 'Dashboard', component: Dashboard },
  { name: 'TransactionList', component: TransactionList },
  { name: 'AddTransaction', component: AddTransaction },
  { name: 'StockDetail', component: StockDetail },
  { name: 'SplitEvents', component: SplitEvents },
  { name: 'Alerts', component: Alerts },
  { name: 'AlertHistory', component: AlertHistory },
  { name: 'Settings', component: Settings },
]

export default function App() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">股股記 Guguji</h1>
      <ul className="space-y-2">
        {PAGES.map(({ name }) => (
          <li key={name} className="text-blue-600 underline cursor-pointer">
            {name}
          </li>
        ))}
      </ul>
    </div>
  )
}
