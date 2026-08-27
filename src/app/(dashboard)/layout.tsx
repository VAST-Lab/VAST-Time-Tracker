'use client'
import { TimerProvider } from '@/context/TimerContext'
import GlobalTimer from '@/components/GlobalTimer'
import ThemeToggle from '@/components/ThemeToggle'
import FormatToggle from '@/components/FormatToggle'
import { useAuth } from '@/context/AuthContext'
import { useAdmin } from '@/hooks/useAdmin'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Clock, Calendar, BarChart, Folder, Users, Briefcase, LogOut, Menu, X } from 'lucide-react'
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
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 dark:text-zinc-100">Loading...</div>
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const visibleNavItems = navItems.filter(item => !item.adminOnly || isAdmin)

  const SidebarContent = () => (
    <>
      <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
        <h2 className="font-bold text-xl tracking-tight dark:text-white">TimeTracker</h2>
        <button className="md:hidden text-zinc-500" onClick={() => setIsMobileMenuOpen(false)}>
          <X size={20} />
        </button>
      </div>
      
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {visibleNavItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link 
              key={item.name} 
              href={item.href} 
              className={`flex items-center space-x-3 rounded-md px-3 py-2 transition-colors ${
                isActive 
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold' 
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium'
              }`}
            >
              <Icon size={18} />
              <span>{item.name}</span>
            </Link>
          )
        })}
      </nav>
      
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
        <button 
          onClick={handleSignOut} 
          className="flex w-full items-center space-x-3 rounded-md px-3 py-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors font-medium"
        >
          <LogOut size={18} />
          <span>Log Out</span>
        </button>
      </div>
    </>
  )

  return (
    <TimerProvider>
      <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        
        {/* Desktop Sidebar */}
        <aside className="w-64 flex-col border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hidden md:flex">
          <SidebarContent />
        </aside>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 md:hidden" onClick={() => setIsMobileMenuOpen(false)}>
            <aside className="w-64 h-full bg-white dark:bg-zinc-900 flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
              <SidebarContent />
            </aside>
          </div>
        )}
        
        <main className="flex-1 flex flex-col h-screen overflow-hidden dark:bg-zinc-950">
          <header className="h-16 flex items-center justify-between px-3 md:px-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 gap-2 md:gap-4">
            <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
              <button className="md:hidden p-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md shrink-0" onClick={() => setIsMobileMenuOpen(true)}>
                <Menu size={20} />
              </button>
              <div className="hidden md:block font-bold dark:text-white shrink-0">TimeTracker</div>
              <div className="flex-1 max-w-2xl min-w-0">
                <GlobalTimer />
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <FormatToggle />
              <ThemeToggle />
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-4 md:p-8">
              {children}
          </div>
        </main>
      </div>
    </TimerProvider>
  )
}