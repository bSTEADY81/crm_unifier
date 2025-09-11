function Error({ statusCode }) {
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
            fontSize: '72px', 
            fontWeight: 'bold', 
            color: '#111827', 
            marginBottom: '8px',
            lineHeight: '1'
          }}>
            {statusCode ? statusCode : 'Error'}
          </h1>
          <h2 style={{ 
            fontSize: '24px', 
            fontWeight: '600', 
            color: '#111827', 
            marginBottom: '8px' 
          }}>
            {statusCode === 404 
              ? 'Page Not Found' 
              : statusCode
              ? `Server Error ${statusCode}` 
              : 'Application Error'}
          </h2>
          <p style={{ 
            color: '#6b7280', 
            marginBottom: '32px' 
          }}>
            {statusCode === 404
              ? "The page you're looking for doesn't exist or has been moved."
              : statusCode
              ? 'A server error occurred. Please try again later.'
              : 'An unexpected error occurred. Please try again or go back to the home page.'}
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
              backgroundColor: '#dc2626',
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
              color: '#dc2626',
              padding: '12px 24px',
              borderRadius: '8px',
              fontWeight: '500',
              border: '1px solid #fecaca',
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

Error.getInitialProps = ({ res, err }) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404
  return { statusCode }
}

export default Error