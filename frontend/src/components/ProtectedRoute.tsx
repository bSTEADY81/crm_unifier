'use client'

import { useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2 } from 'lucide-react'

interface ProtectedRouteProps {
  children: ReactNode
  requireAuth?: boolean
  redirectTo?: string
  allowedRoles?: string[]
}

export default function ProtectedRoute({
  children,
  requireAuth = true,
  redirectTo = '/',
  allowedRoles = []
}: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading) {
      if (requireAuth && !isAuthenticated) {
        // Redirect to login or home page if not authenticated
        router.push(redirectTo)
        return
      }

      if (allowedRoles.length > 0 && user) {
        // Check if user has required role
        if (!allowedRoles.includes(user.role)) {
          // Redirect to unauthorized page or home
          router.push('/unauthorized')
          return
        }
      }
    }
  }, [isAuthenticated, isLoading, user, requireAuth, allowedRoles, router, redirectTo])

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin h-12 w-12 text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // If authentication is required but user is not authenticated, don't render children
  if (requireAuth && !isAuthenticated) {
    return null
  }

  // If role restrictions exist and user doesn't have required role, don't render children
  if (allowedRoles.length > 0 && user && !allowedRoles.includes(user.role)) {
    return null
  }

  return <>{children}</>
}

// Higher-order component version for pages
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options: {
    requireAuth?: boolean
    redirectTo?: string
    allowedRoles?: string[]
  } = {}
) {
  return function AuthenticatedComponent(props: P) {
    return (
      <ProtectedRoute {...options}>
        <Component {...props} />
      </ProtectedRoute>
    )
  }
}

// Hook for conditional rendering based on auth state
export function useAuthGuard() {
  const { user, isAuthenticated, isLoading } = useAuth()

  const canAccess = (requiredRoles: string[] = []) => {
    if (!isAuthenticated || !user) return false
    if (requiredRoles.length === 0) return true
    return requiredRoles.includes(user.role)
  }

  const isAdmin = () => canAccess(['admin'])
  const isAgent = () => canAccess(['admin', 'agent'])
  const isViewer = () => canAccess(['admin', 'agent', 'viewer'])

  return {
    user,
    isAuthenticated,
    isLoading,
    canAccess,
    isAdmin,
    isAgent,
    isViewer,
  }
}