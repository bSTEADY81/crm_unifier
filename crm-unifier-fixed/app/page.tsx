'use client'

import { useState, useEffect } from 'react'
import { Users, MessageSquare, Settings, Menu, X, LogIn, Home, ArrowRight, Loader2 } from 'lucide-react'
import AuthModal from '@/components/auth-modal'

export default function Page() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('home')
  const [isLoading, setIsLoading] = useState(false)
  const [notification, setNotification] = useState('')
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)

  // Simulate loading state for demo
  const handleSectionClick = (section: string) => {
    setIsLoading(true)
    setActiveSection(section)
    setNotification(`Loading ${section}...`)
    
    setTimeout(() => {
      setIsLoading(false)
      setNotification(`${section.charAt(0).toUpperCase() + section.slice(1)} section loaded`)
      setTimeout(() => setNotification(''), 3000)
    }, 1000)
  }

  const sections = [
    {
      id: 'customers',
      title: 'Customers',
      description: 'Manage customer profiles and view unified timelines',
      icon: Users,
      color: 'bg-blue-500',
      features: ['Customer profiles', 'Communication history', 'Activity timeline', 'Contact management']
    },
    {
      id: 'messages',
      title: 'Messages',
      description: 'Search and filter messages across all channels',
      icon: MessageSquare,
      color: 'bg-green-500',
      features: ['Unified inbox', 'Multi-channel support', 'Advanced search', 'Message filters']
    },
    {
      id: 'providers',
      title: 'Providers',
      description: 'Configure communication providers and webhooks',
      icon: Settings,
      color: 'bg-purple-500',
      features: ['API integrations', 'Webhook management', 'Provider settings', 'Connection status']
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
              <button 
                onClick={() => handleSectionClick('home')}
                className="flex items-center space-x-2 text-xl font-bold text-gray-800 hover:text-blue-600 transition-colors"
              >
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                  CU
                </div>
                <span>CRM Unifier</span>
              </button>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-6">
              <button 
                onClick={() => handleSectionClick('home')}
                className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeSection === 'home' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:text-blue-600'
                }`}
              >
                <Home size={16} />
                <span>Home</span>
              </button>
              {sections.map((section) => {
                const Icon = section.icon
                return (
                  <button
                    key={section.id}
                    onClick={() => handleSectionClick(section.id)}
                    className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeSection === section.id ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:text-blue-600'
                    }`}
                  >
                    <Icon size={16} />
                    <span>{section.title}</span>
                  </button>
                )
              })}
              <button 
                onClick={() => setIsAuthModalOpen(true)}
                className="flex items-center space-x-1 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors"
              >
                <LogIn size={16} />
                <span>Sign In</span>
              </button>
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
              <button 
                onClick={() => {
                  handleSectionClick('home')
                  setIsMenuOpen(false)
                }}
                className={`flex items-center space-x-2 w-full px-3 py-2 rounded-md text-base font-medium ${
                  activeSection === 'home' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Home size={20} />
                <span>Home</span>
              </button>
              {sections.map((section) => {
                const Icon = section.icon
                return (
                  <button
                    key={section.id}
                    onClick={() => {
                      handleSectionClick(section.id)
                      setIsMenuOpen(false)
                    }}
                    className={`flex items-center space-x-2 w-full px-3 py-2 rounded-md text-base font-medium ${
                      activeSection === section.id ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon size={20} />
                    <span>{section.title}</span>
                  </button>
                )
              })}
              <button 
                onClick={() => {
                  setIsAuthModalOpen(true)
                  setIsMenuOpen(false)
                }}
                className="flex items-center space-x-2 w-full bg-blue-500 text-white px-3 py-2 rounded-md hover:bg-blue-600"
              >
                <LogIn size={20} />
                <span>Sign In</span>
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Notification Bar */}
      {notification && (
        <div className="bg-blue-500 text-white px-4 py-2 text-center text-sm animate-pulse">
          {notification}
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="animate-spin h-12 w-12 text-blue-500 mb-4" />
            <p className="text-gray-600">Loading content...</p>
          </div>
        ) : (
          <>
            {activeSection === 'home' && (
              <>
                {/* Hero Section */}
                <div className="text-center mb-12">
                  <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
                    CRM Unifier
                  </h1>
                  <p className="text-xl text-gray-600 mb-8">
                    Unified customer correspondence platform
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button 
                      onClick={() => setIsAuthModalOpen(true)}
                      className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center space-x-2"
                    >
                      <span>Get Started</span>
                      <ArrowRight size={20} />
                    </button>
                    <button className="bg-white text-blue-500 px-6 py-3 rounded-lg border-2 border-blue-500 hover:bg-blue-50 transition-colors">
                      View Demo
                    </button>
                  </div>
                </div>

                {/* Feature Cards */}
                <div className="grid md:grid-cols-3 gap-6">
                  {sections.map((section) => {
                    const Icon = section.icon
                    return (
                      <div
                        key={section.id}
                        onClick={() => handleSectionClick(section.id)}
                        className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-all cursor-pointer transform hover:-translate-y-1"
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
                        <button className="mt-4 text-blue-500 font-medium flex items-center space-x-1 hover:text-blue-600">
                          <span>Learn more</span>
                          <ArrowRight size={16} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* Individual Section Views */}
            {activeSection !== 'home' && (
              <div className="bg-white rounded-xl shadow-lg p-8">
                {sections.filter(s => s.id === activeSection).map((section) => {
                  const Icon = section.icon
                  return (
                    <div key={section.id}>
                      <div className="flex items-center space-x-4 mb-6">
                        <div className={`${section.color} w-16 h-16 rounded-xl flex items-center justify-center`}>
                          <Icon className="text-white" size={32} />
                        </div>
                        <div>
                          <h1 className="text-3xl font-bold text-gray-900">{section.title}</h1>
                          <p className="text-gray-600">{section.description}</p>
                        </div>
                      </div>
                      
                      <div className="border-t pt-6">
                        <h2 className="text-xl font-semibold mb-4">Features</h2>
                        <div className="grid md:grid-cols-2 gap-4">
                          {section.features.map((feature, idx) => (
                            <div key={idx} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                              <div className="w-2 h-2 bg-blue-500 rounded-full" />
                              <span className="text-gray-700">{feature}</span>
                            </div>
                          ))}
                        </div>
                        
                        <div className="mt-8 p-6 bg-blue-50 rounded-lg">
                          <p className="text-blue-800 mb-4">
                            This section is currently being developed. Full functionality will be available soon.
                          </p>
                          <button 
                            onClick={() => setIsAuthModalOpen(true)}
                            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors"
                          >
                            Request Early Access
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
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
