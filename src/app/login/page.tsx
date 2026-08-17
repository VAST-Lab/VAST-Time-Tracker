'use client'
import { useState, useEffect, Suspense } from 'react'
import { supabase } from '@/utils/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginContent() {
  const searchParams = useSearchParams()
  const inviteEmail = searchParams.get('email')

  const [email, setEmail] = useState(inviteEmail || '')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [isSignUp, setIsSignUp] = useState(!!inviteEmail)
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    if (inviteEmail) {
      setEmail(inviteEmail)
      setIsSignUp(true)
    }
  }, [inviteEmail])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setError('Missing Supabase Environment Variables.')
      return
    }
    
    let authError = null

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: { data: { full_name: fullName } }
      })
      authError = error
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      authError = error
    }
    
    if (authError) {
      setError(authError.message)
    } else {
      router.push('/')
    }
  }

  return (
    <div className="w-full max-w-md rounded-lg bg-white dark:bg-zinc-900 p-8 shadow-sm border border-zinc-200 dark:border-zinc-800">
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        {isSignUp ? 'Create Account' : 'Sign In'}
      </h1>
      {inviteEmail && <p className="mb-4 text-sm text-green-600 dark:text-green-400">You have been invited! Complete your profile below.</p>}
      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
      
      <form onSubmit={handleAuth} className="space-y-4">
        {isSignUp && (
          <input 
            type="text" 
            placeholder="Name" 
            value={fullName} 
            onChange={e => setFullName(e.target.value)} 
            required 
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white" 
          />
        )}
        <input 
          type="email" 
          placeholder="Email" 
          value={email} 
          onChange={e => setEmail(e.target.value)} 
          readOnly={!!inviteEmail}
          required 
          className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white read-only:opacity-50" 
        />
        <input 
          type="password" 
          placeholder="Password" 
          value={password} 
          onChange={e => setPassword(e.target.value)} 
          required 
          className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white" 
        />
        <button 
          type="submit" 
          className="w-full rounded-md bg-zinc-900 dark:bg-zinc-100 py-2 font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white transition-colors"
        >
          {isSignUp ? 'Sign Up' : 'Log In'}
        </button>
      </form>
      
      {!inviteEmail && (
        <button 
          type="button"
          onClick={() => { setIsSignUp(!isSignUp); setError(''); }} 
          className="mt-4 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:underline w-full text-center"
        >
          {isSignUp ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
        </button>
      )}
    </div>
  )
}

export default function Login() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <Suspense fallback={<div className="dark:text-white">Loading...</div>}>
        <LoginContent />
      </Suspense>
    </div>
  )
}