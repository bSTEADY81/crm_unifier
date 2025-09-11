function Error({ statusCode }) {
  return (
    <div style={{
      color: '#000',
      background: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, Roboto, "Segoe UI", "Fira Sans", Avenir, "Helvetica Neue", "Lucida Grande", sans-serif',
      height: '100vh',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div>
        <h1 style={{
          display: 'inline-block',
          borderRight: '1px solid rgba(0, 0, 0,.3)',
          margin: 0,
          marginRight: '20px',
          padding: '10px 23px 10px 0',
          fontSize: '24px',
          fontWeight: 500,
          verticalAlign: 'top'
        }}>
          {statusCode}
        </h1>
        <div style={{
          display: 'inline-block',
          textAlign: 'left',
          lineHeight: '49px',
          height: '49px',
          verticalAlign: 'middle'
        }}>
          <h2 style={{
            fontSize: '14px',
            fontWeight: 'normal',
            lineHeight: 'inherit',
            margin: 0,
            padding: 0
          }}>
            {statusCode === 404
              ? 'This page could not be found.'
              : 'An error occurred on server.'}
          </h2>
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