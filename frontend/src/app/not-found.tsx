'use client'

export const dynamic = 'force-dynamic'

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%)',
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
          <h1 style={{ 
            fontSize: '120px', 
            fontWeight: 'bold', 
            color: '#4f46e5', 
            marginBottom: '16px',
            lineHeight: '1'
          }}>
            404
          </h1>
          <h2 style={{ 
            fontSize: '24px', 
            fontWeight: '600', 
            color: '#111827', 
            marginBottom: '8px' 
          }}>
            Page Not Found
          </h2>
          <p style={{ 
            color: '#6b7280', 
            marginBottom: '32px' 
          }}>
            The page you&rsquo;re looking for doesn&rsquo;t exist or has been moved.
          </p>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <a 
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              backgroundColor: '#4f46e5',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '8px',
              fontWeight: '500',
              textDecoration: 'none'
            }}
          >
            Go Home
          </a>
          
          <button 
            onClick={() => window.history.back()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              backgroundColor: 'white',
              color: '#4f46e5',
              padding: '12px 24px',
              borderRadius: '8px',
              fontWeight: '500',
              border: '1px solid #c7d2fe',
              cursor: 'pointer'
            }}
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  )
}