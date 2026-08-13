'use client'
import { TimerProvider } from '@/context/TimerContext'
import GlobalTimer from '@/components/GlobalTimer'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'
import { Clock, Calendar, BarChart, Folder, Users, Briefcase, LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

const navItems = [
  { name: 'Time Logs', href: '/', icon: Clock },
  { name: 'Calendar', href: '/calendar', icon: Calendar },
  { name: 'Reports', href: '/reports', icon: BarChart },
  { name: 'Projects', href: '/projects', icon: Folder },
  { name: 'Teams', href: '/teams', icon: Users },
  { name: 'Clients', href: '/clients', icon: Briefcase },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center bg-zinc-50">Loading...</div>
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex min-h-screen bg-zinc-50 text-zinc-900">
      <aside className="w-64 flex-col border-r border-zinc-200 bg-white hidden md:flex">
        <div className="p-6 border-b border-zinc-200">
          <h2 className="font-bold text-xl tracking-tight">TimeTracker</h2>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link 
                key={item.name} 
                href={item.href} 
                className="flex items-center space-x-3 rounded-md px-3 py-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
              >
                <Icon size={18} />
                <span className="font-medium">{item.name}</span>
              </Link>
            )
          })}
        </nav>
        
        <div className="p-4 border-t border-zinc-200">
          <button 
            onClick={handleSignOut} 
            className="flex w-full items-center space-x-3 rounded-md px-3 py-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
          >
            <LogOut size={18} />
            <span className="font-medium">Log Out</span>
          </button>
        </div>
      </aside>
      
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
          {/* Header Area with Global Timer */}
          <header className="h-16 flex items-center justify-between px-6 border-b border-zinc-200 bg-white">
            <div className="md:hidden font-bold">TimeTracker</div>
            <div className="flex-1 flex justify-center md:justify-end">
              <GlobalTimer />
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-6 md:p-8">
              {children}
          </div>
        </main>
    </div>
  )
}