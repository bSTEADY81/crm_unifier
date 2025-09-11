'use client'

import { RefreshCw, Home, AlertTriangle } from 'lucide-react'
import { useEffect } from 'react'

export const dynamic = 'force-dynamic'

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Global application error:', error)
  }, [error])

  return (
    <html>
      <body>
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center">
            <div className="mb-8">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Application Error</h1>
              <p className="text-gray-600 mb-8">
                A critical error occurred in the application. Please refresh the page or try again later.
              </p>
            </div>
            
            <div className="space-y-4">
              <button 
                onClick={reset}
                className="inline-flex items-center justify-center gap-2 w-full bg-red-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
              
              <a
                href="/"
                className="inline-flex items-center justify-center gap-2 w-full bg-white text-red-600 px-6 py-3 rounded-lg font-medium border border-red-200 hover:bg-red-50 transition-colors"
              >
                <Home className="w-4 h-4" />
                Go Home
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}