'use client'

import { useState } from 'react'
import { X, Mail, Lock, User, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { login, register } = useAuth()
  const [isSignUp, setIsSignUp] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    confirmPassword: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    setIsLoading(true)

    // Validation
    const newErrors: Record<string, string> = {}
    
    if (!formData.email) {
      newErrors['email'] = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors['email'] = 'Invalid email address'
    }
    
    if (!formData.password) {
      newErrors['password'] = 'Password is required'
    } else if (formData.password.length < 8) {
      newErrors['password'] = 'Password must be at least 8 characters'
    }
    
    if (isSignUp) {
      if (!formData.name) {
        newErrors['name'] = 'Name is required'
      }
      if (formData.password !== formData.confirmPassword) {
        newErrors['confirmPassword'] = 'Passwords do not match'
      }
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      setIsLoading(false)
      return
    }

    // Call real authentication API
    try {
      let success = false
      
      console.log(`AuthModal: Attempting ${isSignUp ? 'registration' : 'login'} for:`, formData.email)
      
      if (isSignUp) {
        success = await register(formData.name, formData.email, formData.password)
      } else {
        success = await login(formData.email, formData.password)
      }
      
      if (success) {
        console.log('AuthModal: Authentication successful')
        
        // Reset form
        setFormData({
          email: '',
          password: '',
          name: '',
          confirmPassword: ''
        })
        
        // Close modal first
        onClose()
        
        // Force a small delay to ensure state propagation, then trigger re-render
        setTimeout(() => {
          // Force the page to re-render by triggering a window event
          window.dispatchEvent(new Event('auth-state-changed'))
          
          // As a fallback, force page refresh if the event doesn't work
          // This ensures the UI always updates after successful authentication
          setTimeout(() => {
            if (document.querySelector('[data-auth-button="sign-in"]')) {
              console.log('AuthModal: UI not updated, forcing page refresh')
              window.location.reload()
            }
          }, 500)
        }, 100)
      } else {
        console.log('AuthModal: Authentication failed - no success response', result.error)
        
        // Handle specific error messages from API
        let errorMessage = isSignUp ? 'Registration failed. Please check your details and try again.' : 'Invalid email or password. Please try again.'
        
        if (result.error) {
          // Conflict errors (user already exists)
          if (result.error.includes('already exists') || result.error.includes('conflict')) {
            errorMessage = 'An account with this email already exists. Please sign in instead.'
          }
          // Validation errors
          else if (result.error.includes('validation') || result.error.includes('Password must')) {
            errorMessage = result.error
          }
          // Bad request errors
          else if (result.error.includes('Invalid') || result.error.includes('required')) {
            errorMessage = 'Please check your input and try again. Make sure all fields are filled correctly.'
          }
        }
        
        setErrors({
          submit: errorMessage
        })
      }
    } catch (error) {
      console.error('AuthModal: Authentication error caught:', error)
      let errorMessage = 'An unexpected error occurred. Please try again.'
      
      // Handle specific error types
      if (error instanceof Error) {
        console.log('AuthModal: Error message analysis:', error.message)
        
        // Network connectivity issues
        if (error.message.includes('fetch') || error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
          errorMessage = 'Unable to connect to server. Please check your internet connection and try again.'
        }
        // Server errors
        else if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
          errorMessage = 'Server error occurred. Please try again in a few moments.'
        }
        // Conflict errors (user already exists)
        else if (error.message.includes('409') || error.message.includes('already exists') || error.message.includes('conflict')) {
          errorMessage = 'An account with this email already exists. Please sign in instead.'
        }
        // Bad request errors
        else if (error.message.includes('400') || error.message.includes('validation')) {
          errorMessage = 'Please check your input and try again. Make sure your email is valid and password is at least 8 characters.'
        }
        // Unauthorized errors
        else if (error.message.includes('401') || error.message.includes('unauthorized')) {
          errorMessage = isSignUp ? 'Registration not authorized. Please try again.' : 'Invalid email or password.'
        }
        // Not found errors (API endpoint issues)
        else if (error.message.includes('404') || error.message.includes('Not Found')) {
          errorMessage = 'Service temporarily unavailable. Please try again later.'
        }
        // Use the actual error message if it's user-friendly
        else if (error.message.length < 100 && !error.message.includes('TypeError') && !error.message.includes('undefined')) {
          errorMessage = error.message
        }
      }
      
      console.log('AuthModal: Final error message:', errorMessage)
      setErrors({
        submit: errorMessage
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
    // Clear error for this field when user types
    if (errors[e.target.name]) {
      setErrors({
        ...errors,
        [e.target.name]: ''
      })
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {isSignUp && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors['name'] ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="John Doe"
                />
              </div>
              {errors['name'] && (
                <p className="mt-1 text-sm text-red-600">{errors['name']}</p>
              )}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors['email'] ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="you@example.com"
              />
            </div>
            {errors['email'] && (
              <p className="mt-1 text-sm text-red-600">{errors['email']}</p>
            )}
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className={`w-full pl-10 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors['password'] ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors['password'] && (
              <p className="mt-1 text-sm text-red-600">{errors['password']}</p>
            )}
          </div>

          {isSignUp && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors['confirmPassword'] ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="••••••••"
                />
              </div>
              {errors['confirmPassword'] && (
                <p className="mt-1 text-sm text-red-600">{errors['confirmPassword']}</p>
              )}
            </div>
          )}

          {!isSignUp && (
            <div className="mb-6 flex items-center justify-between">
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" />
                <span className="text-sm text-gray-600">Remember me</span>
              </label>
              <a href="#" className="text-sm text-blue-500 hover:text-blue-600">
                Forgot password?
              </a>
            </div>
          )}

          {errors['submit'] && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{errors['submit']}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin mr-2" size={20} />
                Processing...
              </>
            ) : (
              <>{isSignUp ? 'Sign Up' : 'Sign In'}</>
            )}
          </button>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp)
                  setFormData({
                    email: '',
                    password: '',
                    name: '',
                    confirmPassword: ''
                  })
                  setErrors({})
                }}
                className="text-blue-500 hover:text-blue-600 font-medium"
              >
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </button>
            </p>
          </div>

          <div className="mt-6 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
            >
              Google
            </button>
            <button
              type="button"
              className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
            >
              GitHub
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}