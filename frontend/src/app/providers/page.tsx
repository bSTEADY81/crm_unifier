'use client'

import { useState, useEffect } from 'react'
import { 
  Users, 
  MessageSquare, 
  Settings, 
  Plus,
  Edit,
  Trash2,
  Power,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  Webhook,
  Home,
  Menu,
  X,
  BarChart3,
  ExternalLink,
  Copy,
  Eye,
  EyeOff,
  Loader2
} from 'lucide-react'
import Link from 'next/link'
import ProviderModal from '@/components/ProviderModal'
import { apiClient } from '@/lib/api'

interface Provider {
  id: string
  name: string
  type: string
  status: string
  config: Record<string, any>
  description?: string
  isActive: boolean
  messageCount: number
  lastHealthCheck?: string
  errorMessage?: string
  createdAt: string
  updatedAt: string
  connectionStatus?: any
}

export default function ProvidersPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({})
  const [testingConnection, setTestingConnection] = useState<Record<string, boolean>>({})
  const [connectionResults, setConnectionResults] = useState<Record<string, {status: 'success' | 'error', message: string} | null>>({})
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)
  
  // Data state
  const [providers, setProviders] = useState<Provider[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Delete confirmation state
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean
    provider: Provider | null
    isDeleting: boolean
  }>({
    isOpen: false,
    provider: null,
    isDeleting: false
  })

  // Fetch providers from API
  const fetchProviders = async () => {
    try {
      setIsLoading(true)
      const response = await apiClient.getProviders()
      
      if (response.success && response.data) {
        setProviders(response.data.providers || [])
        setError(null)
      } else {
        throw new Error(response.error || 'Failed to fetch providers')
      }
    } catch (err) {
      console.error('Error fetching providers:', err)
      setError(err instanceof Error ? err.message : 'Failed to load providers')
      setProviders([])
    } finally {
      setIsLoading(false)
    }
  }

  // Load providers on component mount
  useEffect(() => {
    fetchProviders()
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100'
      case 'warning': return 'text-yellow-600 bg-yellow-100'
      case 'inactive': return 'text-gray-600 bg-gray-100'
      case 'error': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle size={16} className="text-green-600" />
      case 'warning': return <AlertCircle size={16} className="text-yellow-600" />
      case 'inactive': return <Clock size={16} className="text-gray-600" />
      case 'error': return <AlertCircle size={16} className="text-red-600" />
      default: return <Clock size={16} className="text-gray-600" />
    }
  }

  const getProviderIcon = (type: string) => {
    switch (type) {
      case 'whatsapp': return '📱'
      case 'sms': return '💬'
      case 'email': return '📧'
      case 'facebook': return '📘'
      case 'instagram': return '📷'
      default: return '🔌'
    }
  }

  const toggleApiKey = (providerId: string) => {
    setShowApiKey(prev => ({
      ...prev,
      [providerId]: !prev[providerId]
    }))
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    // You could add a toast notification here
  }

  const testConnection = async (provider: Provider) => {
    setTestingConnection(prev => ({ ...prev, [provider.id]: true }))
    setConnectionResults(prev => ({ ...prev, [provider.id]: null }))
    
    try {
      const response = await apiClient.testProviderConnection(provider.id)
      
      if (response.success && response.data) {
        setConnectionResults(prev => ({
          ...prev,
          [provider.id]: {
            status: response.data.status === 'success' ? 'success' : 'error',
            message: response.data.message || 'Connection test completed'
          }
        }))
      } else {
        setConnectionResults(prev => ({
          ...prev,
          [provider.id]: {
            status: 'error',
            message: response.error || 'Connection test failed'
          }
        }))
      }
      
      // Refresh providers to get updated status
      await fetchProviders()
      
    } catch (error) {
      setConnectionResults(prev => ({
        ...prev,
        [provider.id]: {
          status: 'error',
          message: 'Connection test failed. Please try again.'
        }
      }))
    } finally {
      setTestingConnection(prev => ({ ...prev, [provider.id]: false }))
    }
  }

  const handleAddProvider = () => {
    setSelectedProvider(null)
    setModalMode('create')
    setIsModalOpen(true)
  }

  const handleEditProvider = (provider: Provider) => {
    setSelectedProvider(provider)
    setModalMode('edit')
    setIsModalOpen(true)
  }

  const handleSaveProvider = async (providerData: any) => {
    try {
      let response
      
      if (modalMode === 'create') {
        response = await apiClient.createProvider(providerData)
      } else if (selectedProvider) {
        response = await apiClient.updateProvider(selectedProvider.id, providerData)
      } else {
        throw new Error('No provider selected for update')
      }

      if (!response.success) {
        throw new Error(response.error || `Failed to ${modalMode} provider`)
      }

      // Refresh providers list
      await fetchProviders()
      setIsModalOpen(false)
      setSelectedProvider(null)
    } catch (error) {
      // Re-throw error to be handled by modal
      throw error
    }
  }

  const handleToggleProvider = async (provider: Provider) => {
    try {
      const response = await apiClient.updateProvider(provider.id, {
        isActive: !provider.isActive
      })

      if (!response.success) {
        throw new Error(response.error || 'Failed to toggle provider status')
      }

      // Refresh providers list
      await fetchProviders()
    } catch (error) {
      console.error('Error toggling provider:', error)
      // You could add a toast notification here
    }
  }

  const handleDeleteProvider = (provider: Provider) => {
    setDeleteConfirmation({
      isOpen: true,
      provider,
      isDeleting: false
    })
  }

  const confirmDeleteProvider = async () => {
    if (!deleteConfirmation.provider) return

    setDeleteConfirmation(prev => ({ ...prev, isDeleting: true }))

    try {
      const response = await apiClient.deleteProvider(deleteConfirmation.provider.id)

      if (!response.success) {
        throw new Error(response.error || 'Failed to delete provider')
      }

      // Refresh providers list
      await fetchProviders()
      setDeleteConfirmation({ isOpen: false, provider: null, isDeleting: false })
    } catch (error) {
      console.error('Error deleting provider:', error)
      setDeleteConfirmation(prev => ({ ...prev, isDeleting: false }))
      // You could add a toast notification here
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <Loader2 className="animate-spin" size={24} />
          <span>Loading providers...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
                className="flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
              >
                <Home size={16} />
                <span>Home</span>
              </Link>
              <Link 
                href="/dashboard"
                className="flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
              >
                <BarChart3 size={16} />
                <span>Dashboard</span>
              </Link>
              <Link 
                href="/customers"
                className="flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
              >
                <Users size={16} />
                <span>Customers</span>
              </Link>
              <Link 
                href="/messages"
                className="flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
              >
                <MessageSquare size={16} />
                <span>Messages</span>
              </Link>
              <Link 
                href="/providers"
                className="flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium bg-blue-100 text-blue-700"
              >
                <Settings size={16} />
                <span>Providers</span>
              </Link>
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
                <BarChart3 size={20} />
                <span>Dashboard</span>
              </Link>
              <Link 
                href="/customers"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center space-x-2 w-full px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-100"
              >
                <Users size={20} />
                <span>Customers</span>
              </Link>
              <Link 
                href="/messages"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center space-x-2 w-full px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-100"
              >
                <MessageSquare size={20} />
                <span>Messages</span>
              </Link>
              <Link 
                href="/providers"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center space-x-2 w-full px-3 py-2 rounded-md text-base font-medium bg-blue-100 text-blue-700"
              >
                <Settings size={20} />
                <span>Providers</span>
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Providers</h1>
              <p className="text-gray-600 mt-2">Configure communication providers and webhooks</p>
            </div>
            <button 
              onClick={handleAddProvider}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center space-x-2"
            >
              <Plus size={20} />
              <span>Add Provider</span>
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <AlertCircle className="text-red-600" size={20} />
              <span className="text-red-800 font-medium">Error loading providers</span>
            </div>
            <p className="text-red-700 mt-1">{error}</p>
            <button 
              onClick={fetchProviders}
              className="mt-3 text-red-600 hover:text-red-800 underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Providers</p>
                <p className="text-2xl font-bold text-gray-900">{providers.length}</p>
              </div>
              <Settings className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-2xl font-bold text-green-600">
                  {providers.filter(p => p.status === 'active').length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Messages</p>
                <p className="text-2xl font-bold text-gray-900">
                  {providers.reduce((sum, p) => sum + (p.messageCount || 0), 0).toLocaleString()}
                </p>
              </div>
              <MessageSquare className="w-8 h-8 text-purple-500" />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Webhooks</p>
                <p className="text-2xl font-bold text-gray-900">{providers.length}</p>
              </div>
              <Webhook className="w-8 h-8 text-yellow-500" />
            </div>
          </div>
        </div>

        {/* Provider Cards */}
        {providers.length === 0 && !error ? (
          <div className="text-center py-12">
            <Settings className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No providers configured</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by adding your first communication provider.</p>
            <div className="mt-6">
              <button
                onClick={handleAddProvider}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="-ml-1 mr-2 h-5 w-5" />
                Add Provider
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-6">
            {providers.map((provider) => (
              <div key={provider.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-2xl">
                        {getProviderIcon(provider.type)}
                      </div>
                      <div>
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{provider.name}</h3>
                          <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(provider.status)}`}>
                            {getStatusIcon(provider.status)}
                            <span className="capitalize">{provider.status}</span>
                          </div>
                        </div>
                        <p className="text-gray-600 text-sm mb-2">{provider.description}</p>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <div className="flex items-center space-x-1">
                            <Clock size={14} />
                            <span>Last check: {provider.lastHealthCheck ? new Date(provider.lastHealthCheck).toLocaleString() : 'Never'}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <MessageSquare size={14} />
                            <span>{(provider.messageCount || 0).toLocaleString()} messages</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => handleEditProvider(provider)}
                        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                        title="Edit provider"
                      >
                        <Edit size={18} />
                      </button>
                      <button 
                        onClick={() => handleToggleProvider(provider)}
                        className={`p-2 rounded ${
                          provider.isActive 
                            ? 'text-yellow-600 hover:text-yellow-900 hover:bg-yellow-50' 
                            : 'text-green-600 hover:text-green-900 hover:bg-green-50'
                        }`}
                        title={provider.isActive ? 'Deactivate provider' : 'Activate provider'}
                      >
                        <Power size={18} />
                      </button>
                      <button 
                        onClick={() => handleDeleteProvider(provider)}
                        className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded"
                        title="Delete provider"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Configuration Details */}
                  <div className="mt-6 grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Webhook Configuration</h4>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Webhook URL</label>
                          <div className="flex items-center space-x-2">
                            <code className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm font-mono">
                              {`${window.location.origin}/api/v1/webhooks/${provider.type.toLowerCase()}`}
                            </code>
                            <button 
                              onClick={() => copyToClipboard(`${window.location.origin}/api/v1/webhooks/${provider.type.toLowerCase()}`)}
                              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                            >
                              <Copy size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Provider Settings</h4>
                      <div className="space-y-2">
                        {Object.entries(provider.config || {}).map(([key, value]) => {
                          const isSensitive = key.toLowerCase().includes('token') || key.toLowerCase().includes('secret') || key.toLowerCase().includes('key')
                          const displayValue = isSensitive ? '•••••••••••••••••••••••' : value
                          
                          return (
                            <div key={key} className="flex justify-between items-center">
                              <span className="text-xs font-medium text-gray-500 capitalize">
                                {key.replace(/([A-Z])/g, ' $1').toLowerCase()}:
                              </span>
                              <span className="text-sm text-gray-900 font-mono">
                                {typeof value === 'boolean' ? (value ? '✓' : '✗') : displayValue}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Test Connection */}
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Zap size={16} className="text-yellow-500" />
                        <span className="text-sm font-medium text-gray-900">Connection Status</span>
                      </div>
                      <button 
                        onClick={() => testConnection(provider)}
                        disabled={testingConnection[provider.id]}
                        className="bg-blue-500 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                      >
                        {testingConnection[provider.id] ? (
                          <>
                            <Loader2 className="animate-spin" size={14} />
                            <span>Testing...</span>
                          </>
                        ) : (
                          <>
                            <Zap size={14} />
                            <span>Test Connection</span>
                          </>
                        )}
                      </button>
                    </div>
                    
                    {/* Connection Test Results */}
                    {connectionResults[provider.id] && (
                      <div className={`mt-3 p-3 rounded-lg text-sm ${
                        connectionResults[provider.id]?.status === 'success' 
                          ? 'bg-green-50 text-green-800 border border-green-200' 
                          : 'bg-red-50 text-red-800 border border-red-200'
                      }`}>
                        <div className="flex items-center space-x-2">
                          {connectionResults[provider.id]?.status === 'success' ? (
                            <CheckCircle size={16} className="text-green-600" />
                          ) : (
                            <AlertCircle size={16} className="text-red-600" />
                          )}
                          <span className="font-medium">
                            {connectionResults[provider.id]?.status === 'success' ? 'Success' : 'Error'}
                          </span>
                        </div>
                        <p className="mt-1">{connectionResults[provider.id]?.message}</p>
                      </div>
                    )}

                    {/* Error Message */}
                    {provider.errorMessage && (
                      <div className="mt-3 p-3 bg-red-50 text-red-800 border border-red-200 rounded-lg text-sm">
                        <div className="flex items-center space-x-2">
                          <AlertCircle size={16} className="text-red-600" />
                          <span className="font-medium">Error</span>
                        </div>
                        <p className="mt-1">{provider.errorMessage}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Provider Modal */}
      <ProviderModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedProvider(null)
        }}
        onSave={handleSaveProvider}
        provider={selectedProvider}
        mode={modalMode}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirmation.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Delete Provider</h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete "{deleteConfirmation.provider?.name}"? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirmation({ isOpen: false, provider: null, isDeleting: false })}
                disabled={deleteConfirmation.isDeleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteProvider}
                disabled={deleteConfirmation.isDeleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50 flex items-center space-x-2"
              >
                {deleteConfirmation.isDeleting ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}