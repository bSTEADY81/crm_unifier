'use client'

import { useEffect } from 'react'

export const dynamic = 'force-dynamic'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Application error:', error)
  }, [error])

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #fef2f2 0%, #fce7f3 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        maxWidth: '448px',
        width: '100%',
        textAlign: 'center'
      }}>
        <div style={{ marginBottom: '32px' }}>
          <div style={{
            margin: '0 auto 16px',
            width: '64px',
            height: '64px',
            backgroundColor: '#fecaca',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span style={{ color: '#dc2626', fontSize: '24px' }}>⚠️</span>
          </div>
          <h1 style={{ 
            fontSize: '30px', 
            fontWeight: 'bold', 
            color: '#111827', 
            marginBottom: '8px' 
          }}>
            Something went wrong!
          </h1>
          <p style={{ 
            color: '#6b7280', 
            marginBottom: '32px' 
          }}>
            We encountered an unexpected error. Please try again or go back to the home page.
          </p>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <button 
            onClick={reset}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              backgroundColor: '#dc2626',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '8px',
              fontWeight: '500',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Try Again
          </button>
          
          <a 
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              backgroundColor: 'white',
              color: '#dc2626',
              padding: '12px 24px',
              borderRadius: '8px',
              fontWeight: '500',
              border: '1px solid #fecaca',
              textDecoration: 'none'
            }}
          >
            Go Home
          </a>
        </div>
      </div>
    </div>
  )
}