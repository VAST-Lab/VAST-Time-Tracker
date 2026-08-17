'use client'
import { TimerProvider } from '@/context/TimerContext'
import GlobalTimer from '@/components/GlobalTimer'
import ThemeToggle from '@/components/ThemeToggle'
import { useAuth } from '@/context/AuthContext'
import { useAdmin } from '@/hooks/useAdmin'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'
import { Clock, Calendar, BarChart, Folder, Users, Briefcase, LogOut } from 'lucide-react'
import { supabase } from '@/utils/supabase/client'

const navItems = [
  { name: 'Time Logs', href: '/', icon: Clock },
  { name: 'Calendar', href: '/calendar', icon: Calendar },
  { name: 'Reports', href: '/reports', icon: BarChart },
  { name: 'Projects', href: '/projects', icon: Folder },
  { name: 'Teams', href: '/teams', icon: Users, adminOnly: true },
  { name: 'Clients', href: '/clients', icon: Briefcase, adminOnly: true },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const isAdmin = useAdmin()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 dark:text-zinc-100">Loading...</div>
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const visibleNavItems = navItems.filter(item => !item.adminOnly || isAdmin)

  return (
    <TimerProvider>
      <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        <aside className="w-64 flex-col border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hidden md:flex">
          <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="font-bold text-xl tracking-tight dark:text-white">TimeTracker</h2>
          </div>
          
          <nav className="flex-1 p-4 space-y-1">
            {visibleNavItems.map((item) => {
              const Icon = item.icon
              return (
                <Link 
                  key={item.name} 
                  href={item.href} 
                  className="flex items-center space-x-3 rounded-md px-3 py-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                >
                  <Icon size={18} />
                  <span className="font-medium">{item.name}</span>
                </Link>
              )
            })}
          </nav>
          
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
            <button 
              onClick={handleSignOut} 
              className="flex w-full items-center space-x-3 rounded-md px-3 py-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              <LogOut size={18} />
              <span className="font-medium">Log Out</span>
            </button>
          </div>
        </aside>
        
        <main className="flex-1 flex flex-col h-screen overflow-hidden dark:bg-zinc-950">
          <header className="h-16 flex items-center justify-between px-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <div className="flex items-center gap-4">
              <div className="md:hidden font-bold dark:text-white">TimeTracker</div>
              <GlobalTimer />
            </div>
            <ThemeToggle />
          </header>

          <div className="flex-1 overflow-y-auto p-6 md:p-8">
              {children}
          </div>
        </main>
      </div>
    </TimerProvider>
  )
}