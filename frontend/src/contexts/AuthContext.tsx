'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { apiClient } from '@/lib/api'
import { User } from '@/types/api'

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<boolean>
  register: (name: string, email: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  refreshAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedToken = localStorage.getItem('auth_token')
        const storedUser = localStorage.getItem('auth_user')

        if (storedToken && storedUser) {
          // Set token in API client
          apiClient.setAuthToken(storedToken)
          
          // Verify token is still valid by fetching current user
          const response = await apiClient.getCurrentUser()
          
          if (response.success && response.data) {
            setUser(response.data)
            setToken(storedToken)
          } else {
            // Token is invalid, clear stored data
            localStorage.removeItem('auth_token')
            localStorage.removeItem('auth_user')
            apiClient.clearAuthToken()
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
        // Clear invalid stored data
        localStorage.removeItem('auth_token')
        localStorage.removeItem('auth_user')
        apiClient.clearAuthToken()
      } finally {
        setIsLoading(false)
      }
    }

    initializeAuth()
  }, [])

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true)
      const response = await apiClient.login(email, password)

      if (response.success && response.data) {
        const { user: userData, token: authToken } = response.data
        
        setUser(userData)
        setToken(authToken)
        
        // Store in localStorage
        localStorage.setItem('auth_token', authToken)
        localStorage.setItem('auth_user', JSON.stringify(userData))
        
        // Set token in API client
        apiClient.setAuthToken(authToken)
        
        return true
      } else {
        console.error('Login failed:', response.error)
        return false
      }
    } catch (error) {
      console.error('Login error:', error)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const register = async (name: string, email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true)
      const response = await apiClient.register({ name, email, password })

      if (response.success && response.data) {
        const { user: userData, token: authToken } = response.data
        
        setUser(userData)
        setToken(authToken)
        
        // Store in localStorage
        localStorage.setItem('auth_token', authToken)
        localStorage.setItem('auth_user', JSON.stringify(userData))
        
        // Set token in API client
        apiClient.setAuthToken(authToken)
        
        return true
      } else {
        console.error('Registration failed:', response.error)
        return false
      }
    } catch (error) {
      console.error('Registration error:', error)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async (): Promise<void> => {
    try {
      // Call logout API
      await apiClient.logout()
    } catch (error) {
      console.error('Logout API error:', error)
    } finally {
      // Clear state regardless of API success
      setUser(null)
      setToken(null)
      
      // Clear localStorage
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      
      // Clear token from API client
      apiClient.clearAuthToken()
    }
  }

  const refreshAuth = async (): Promise<void> => {
    try {
      const response = await apiClient.getCurrentUser()
      
      if (response.success && response.data) {
        setUser(response.data)
        localStorage.setItem('auth_user', JSON.stringify(response.data))
      } else {
        // If refresh fails, logout user
        await logout()
      }
    } catch (error) {
      console.error('Auth refresh error:', error)
      await logout()
    }
  }

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated: !!user && !!token,
    login,
    register,
    logout,
    refreshAuth,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext