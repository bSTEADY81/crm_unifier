'use client'

import { useState, useEffect } from 'react'
import { Users, MessageSquare, Settings, Menu, X, LogIn, Home, ArrowRight, LogOut } from 'lucide-react'
import AuthModal from '@/components/AuthModal'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'

export default function HomePage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false) // Track client-side mount
  const { user, logout, isAuthenticated, isLoading } = useAuth()

  // Handle hydration and ensure client-side rendering
  useEffect(() => {
    setIsMounted(true)
    
    // Listen for auth state changes from the modal
    const handleAuthChange = () => {
      console.log('HomePage: Received auth-state-changed event')
      // Force re-render by updating a local state
      setIsMounted(prev => !prev)
      setTimeout(() => setIsMounted(true), 10)
    }
    
    window.addEventListener('auth-state-changed', handleAuthChange)
    return () => window.removeEventListener('auth-state-changed', handleAuthChange)
  }, [])

  // Debug logging
  console.log('HomePage: Rendering with auth state:', {
    isAuthenticated,
    hasUser: !!user,
    userName: user?.name,
    isLoading,
    isMounted
  })


  const sections = [
    {
      id: 'customers',
      title: 'Customers',
      description: 'Manage customer profiles and view unified timelines',
      icon: Users,
      color: 'bg-blue-500',
      features: ['Customer profiles', 'Communication history', 'Activity timeline', 'Contact management'],
      href: '/customers'
    },
    {
      id: 'messages',
      title: 'Messages',
      description: 'Search and filter messages across all channels',
      icon: MessageSquare,
      color: 'bg-green-500',
      features: ['Unified inbox', 'Multi-channel support', 'Advanced search', 'Message filters'],
      href: '/messages'
    },
    {
      id: 'providers',
      title: 'Providers',
      description: 'Configure communication providers and webhooks',
      icon: Settings,
      color: 'bg-purple-500',
      features: ['API integrations', 'Webhook management', 'Provider settings', 'Connection status'],
      href: '/providers'
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Navigation Header */}
      <nav className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link 
                href="/"
                className="flex items-center space-x-2 text-xl font-bold text-gray-800 hover:text-blue-600 transition-colors"
              >
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                  CU
                </div>
                <span>CRM Unifier</span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-6">
              <Link 
                href="/"
                className="flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors bg-blue-100 text-blue-700"
              >
                <Home size={16} />
                <span>Home</span>
              </Link>
              <Link 
                href="/dashboard"
                className="flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
              >
                <Settings size={16} />
                <span>Dashboard</span>
              </Link>
              {sections.map((section) => {
                const Icon = section.icon
                return (
                  <Link
                    key={section.id}
                    href={section.href}
                    className="flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
                  >
                    <Icon size={16} />
                    <span>{section.title}</span>
                  </Link>
                )
              })}
              {!isMounted || isLoading ? (
                // Loading state
                <div className="flex items-center space-x-1 bg-gray-200 px-4 py-2 rounded-md animate-pulse">
                  <div className="w-4 h-4 bg-gray-300 rounded"></div>
                  <div className="w-16 h-4 bg-gray-300 rounded"></div>
                </div>
              ) : isAuthenticated ? (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-700">Welcome, <span className="font-medium text-blue-600">{user?.name}</span></span>
                  <button 
                    onClick={() => logout()}
                    className="flex items-center space-x-1 bg-red-500 text-white px-3 py-2 rounded-md hover:bg-red-600 transition-colors text-sm"
                  >
                    <LogOut size={14} />
                    <span>Sign Out</span>
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setIsAuthModalOpen(true)}
                  data-auth-button="sign-in"
                  className="flex items-center space-x-1 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors"
                >
                  <LogIn size={16} />
                  <span>Sign In</span>
                </button>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 rounded-md text-gray-700 hover:bg-gray-100"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden bg-white border-t">
            <div className="px-2 pt-2 pb-3 space-y-1">
              <Link 
                href="/"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center space-x-2 w-full px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-100"
              >
                <Home size={20} />
                <span>Home</span>
              </Link>
              <Link 
                href="/dashboard"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center space-x-2 w-full px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-100"
              >
                <Settings size={20} />
                <span>Dashboard</span>
              </Link>
              {sections.map((section) => {
                const Icon = section.icon
                return (
                  <Link
                    key={section.id}
                    href={section.href}
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center space-x-2 w-full px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-100"
                  >
                    <Icon size={20} />
                    <span>{section.title}</span>
                  </Link>
                )
              })}
              {!isMounted || isLoading ? (
                // Loading state for mobile
                <div className="w-full bg-gray-200 px-3 py-2 rounded-md animate-pulse">
                  <div className="flex items-center space-x-2">
                    <div className="w-5 h-5 bg-gray-300 rounded"></div>
                    <div className="w-20 h-4 bg-gray-300 rounded"></div>
                  </div>
                </div>
              ) : isAuthenticated ? (
                <>
                  <div className="w-full bg-blue-50 text-blue-700 px-3 py-2 rounded-md mb-2">
                    <span className="text-sm">Welcome, <span className="font-medium">{user?.name}</span></span>
                  </div>
                  <button 
                    onClick={() => {
                      logout()
                      setIsMenuOpen(false)
                    }}
                    className="flex items-center space-x-2 w-full bg-red-500 text-white px-3 py-2 rounded-md hover:bg-red-600"
                  >
                    <LogOut size={20} />
                    <span>Sign Out</span>
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => {
                    setIsAuthModalOpen(true)
                    setIsMenuOpen(false)
                  }}
                  data-auth-button="sign-in"
                  className="flex items-center space-x-2 w-full bg-blue-500 text-white px-3 py-2 rounded-md hover:bg-blue-600"
                >
                  <LogIn size={20} />
                  <span>Sign In</span>
                </button>
              )}
            </div>
          </div>
        )}
      </nav>


      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            CRM Unifier
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Unified customer correspondence platform
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {!isMounted || isLoading ? (
              // Loading state for hero button
              <div className="bg-gray-200 px-6 py-3 rounded-lg animate-pulse flex items-center justify-center space-x-2">
                <div className="w-24 h-5 bg-gray-300 rounded"></div>
                <div className="w-5 h-5 bg-gray-300 rounded"></div>
              </div>
            ) : isAuthenticated ? (
              <Link 
                href="/dashboard"
                className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center space-x-2"
              >
                <span>Go to Dashboard</span>
                <ArrowRight size={20} />
              </Link>
            ) : (
              <button 
                onClick={() => setIsAuthModalOpen(true)}
                data-auth-button="sign-in"
                className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center space-x-2"
              >
                <span>Get Started</span>
                <ArrowRight size={20} />
              </button>
            )}
            {!isAuthenticated && (
              <Link 
                href="/dashboard"
                className="bg-white text-blue-500 px-6 py-3 rounded-lg border-2 border-blue-500 hover:bg-blue-50 transition-colors text-center"
              >
                View Dashboard
              </Link>
            )}
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {sections.map((section) => {
            const Icon = section.icon
            return (
              <Link
                key={section.id}
                href={section.href}
                className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-all cursor-pointer transform hover:-translate-y-1 block"
              >
                <div className={`${section.color} w-12 h-12 rounded-lg flex items-center justify-center mb-4`}>
                  <Icon className="text-white" size={24} />
                </div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                  {section.title}
                </h2>
                <p className="text-gray-600 mb-4">
                  {section.description}
                </p>
                <ul className="space-y-2">
                  {section.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center space-x-2 text-sm text-gray-600">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 text-blue-500 font-medium flex items-center space-x-1 hover:text-blue-600">
                  <span>Learn more</span>
                  <ArrowRight size={16} />
                </div>
              </Link>
            )
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p className="text-sm">© 2025 CRM Unifier. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  )
}