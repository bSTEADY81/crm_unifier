import { NextRequest, NextResponse } from 'next/server'

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify'
].join(' ')

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  if (!code) {
    // Redirect to Google OAuth
    const clientId = process.env['GOOGLE_CLIENT_ID']
    const redirectUri = `${process.env['NEXTAUTH_URL']}/api/auth/gmail`
    
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.set('client_id', clientId!)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', GMAIL_SCOPES)
    authUrl.searchParams.set('access_type', 'offline')
    authUrl.searchParams.set('prompt', 'consent')
    authUrl.searchParams.set('state', state || 'default')

    return NextResponse.redirect(authUrl.toString())
  }

  // Exchange code for tokens
  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env['GOOGLE_CLIENT_ID']!,
        client_secret: process.env['GOOGLE_CLIENT_SECRET']!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env['NEXTAUTH_URL']}/api/auth/gmail`,
      }),
    })

    const tokens = await tokenResponse.json()

    if (!tokenResponse.ok) {
      throw new Error(tokens.error_description || 'Failed to exchange code')
    }

    // Get user email for identification
    const userResponse = await fetch('https://gmail.googleapis.com/gmail/v1/profile', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    })
    
    const userProfile = await userResponse.json()

    // Redirect back to providers page with tokens in URL hash (client-side only)
    const redirectUrl = new URL('/providers', process.env['NEXTAUTH_URL']!)
    redirectUrl.hash = `gmail-auth=${encodeURIComponent(JSON.stringify({
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      email: userProfile.emailAddress,
      expires_in: tokens.expires_in
    }))}`

    return NextResponse.redirect(redirectUrl.toString())
    
  } catch (error) {
    console.error('Gmail OAuth error:', error)
    const errorUrl = new URL('/providers', process.env['NEXTAUTH_URL']!)
    errorUrl.searchParams.set('error', 'gmail_oauth_failed')
    return NextResponse.redirect(errorUrl.toString())
  }
}