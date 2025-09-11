'use client'

import { RefreshCw, Home, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'

export const dynamic = 'force-dynamic'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Something went wrong!</h1>
          <p className="text-gray-600 mb-8">
            We encountered an unexpected error. Please try again or go back to the home page.
          </p>
          {process.env.NODE_ENV === 'development' && (
            <details className="text-left bg-red-50 p-4 rounded-lg mb-8">
              <summary className="cursor-pointer text-sm font-medium text-red-800 mb-2">
                Error Details (Development)
              </summary>
              <pre className="text-xs text-red-700 overflow-auto">
                {error.message}
                {error.stack}
              </pre>
            </details>
          )}
        </div>
        
        <div className="space-y-4">
          <button 
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 w-full bg-red-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-red-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
          
          <Link 
            href="/"
            className="inline-flex items-center justify-center gap-2 w-full bg-white text-red-600 px-6 py-3 rounded-lg font-medium border border-red-200 hover:bg-red-50 transition-colors"
          >
            <Home className="w-4 h-4" />
            Go Home
          </Link>
        </div>
      </div>
    </div>
  )
}