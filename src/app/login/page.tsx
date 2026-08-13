'use client'
import { useState } from 'react'
import { supabase } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setError('Missing Supabase Environment Variables.')
      return
    }
    
    let authError = null

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
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
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-sm border border-zinc-200">
        <h1 className="mb-6 text-2xl font-bold text-zinc-900">
          {isSignUp ? 'Create Account' : 'Sign In'}
        </h1>
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        
        <form onSubmit={handleAuth} className="space-y-4">
          <input 
            type="email" 
            placeholder="Email" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            required 
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900" 
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            required 
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900" 
          />
          <button 
            type="submit" 
            className="w-full rounded-md bg-zinc-900 py-2 font-medium text-white hover:bg-zinc-800 transition-colors"
          >
            {isSignUp ? 'Sign Up' : 'Log In'}
          </button>
        </form>
        
        <button 
          type="button"
          onClick={() => setIsSignUp(!isSignUp)} 
          className="mt-4 text-sm text-zinc-600 hover:text-zinc-900 hover:underline w-full text-center"
        >
          {isSignUp ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
        </button>
      </div>
    </div>
  )
}