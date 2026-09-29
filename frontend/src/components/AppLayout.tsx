import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { FlaskConical, LayoutDashboard, ListChecks, LogOut, MessageCircle, Wallet, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { MentorChat } from './MentorChat'

const NAV = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/profile', label: 'My money', icon: Wallet },
  { to: '/simulate', label: 'What-if', icon: FlaskConical },
  { to: '/plan', label: 'Plan', icon: ListChecks },
  { to: '/mentor', label: 'Mentor', icon: MessageCircle },
]

export function AppLayout() {
  const { signOut, user } = useAuth()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const onMentorPage = location.pathname.startsWith('/mentor')

  useEffect(() => setDrawerOpen(false), [location.pathname])

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-gray-200 bg-white px-4 py-6 lg:flex lg:sticky lg:top-0 lg:h-screen">
        <Logo />
        <nav className="mt-8 flex-1 space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to}
                     className={({ isActive }) =>
                       `flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${isActive
                         ? 'bg-brand-50 font-medium text-brand-800' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
              <Icon className="h-4 w-4" aria-hidden /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-gray-100 pt-4">
          <p className="truncate px-3 text-xs text-gray-400">{user?.email}</p>
          <button onClick={signOut}
                  className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
            <LogOut className="h-4 w-4" aria-hidden /> Log out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <button onClick={signOut} className="text-gray-500" aria-label="Log out">
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      <main className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-gray-200 bg-white lg:hidden">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to}
                   className={({ isActive }) =>
                     `flex flex-col items-center gap-0.5 py-2 text-[11px] ${isActive ? 'text-brand-800' : 'text-gray-500'}`}>
            <Icon className="h-5 w-5" aria-hidden /> {label}
          </NavLink>
        ))}
      </nav>

      {/* Mentor drawer */}
      {!onMentorPage && (
        <button onClick={() => setDrawerOpen(true)}
                className="fixed bottom-20 right-4 z-30 inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-3 text-sm font-medium text-white shadow-lg hover:bg-brand-800 lg:bottom-6 lg:right-6">
          <MessageCircle className="h-4 w-4" aria-hidden /> Ask FinMentor
        </button>
      )}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/20" onClick={() => setDrawerOpen(false)}>
          <div role="dialog" aria-label="FinMentor chat"
               className="flex h-full w-full max-w-md flex-col bg-gray-50 p-4 shadow-xl"
               onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <p className="font-medium text-gray-900">FinMentor</p>
              <button onClick={() => setDrawerOpen(false)} aria-label="Close chat" className="text-gray-500 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <MentorChat compact />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Logo() {
  return (
    <div className="flex items-center gap-2 px-1">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-semibold text-white">F</span>
      <span className="text-base font-medium text-gray-900">FinMentor</span>
    </div>
  )
}
