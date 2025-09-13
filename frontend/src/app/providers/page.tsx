'use client'

import { useState } from 'react'
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
  Activity,
  Home,
  Menu,
  X,
  BarChart3,
  ExternalLink,
  Copy,
  Eye,
  EyeOff
} from 'lucide-react'
import Link from 'next/link'

export default function ProvidersPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({})
  const [testingConnection, setTestingConnection] = useState<Record<number, boolean>>({})
  const [connectionResults, setConnectionResults] = useState<Record<number, {status: 'success' | 'error', message: string} | null>>({})

  const providers = [
    {
      id: 1,
      name: 'WhatsApp Business',
      type: 'whatsapp',
      status: 'active',
      description: 'WhatsApp Business API integration',
      lastSync: '2 minutes ago',
      messagesCount: 1245,
      webhookUrl: 'https://api.crmunifier.com/webhooks/whatsapp',
      apiKey: 'wa_sk_test_1234567890abcdef',
      config: {
        phoneNumber: '+1 (555) 123-4567',
        businessName: 'CRM Unifier Support'
      }
    },
    {
      id: 2,
      name: 'Twilio SMS',
      type: 'sms',
      status: 'active',
      description: 'SMS messaging via Twilio',
      lastSync: '5 minutes ago',
      messagesCount: 856,
      webhookUrl: 'https://api.crmunifier.com/webhooks/twilio',
      apiKey: 'tw_sk_test_abcdef1234567890',
      config: {
        accountSid: 'AC1234567890abcdef',
        phoneNumber: '+1 (555) 987-6543'
      }
    },
    {
      id: 3,
      name: 'Gmail',
      type: 'email',
      status: 'active',
      description: 'Email integration via Gmail API',
      lastSync: '10 minutes ago',
      messagesCount: 432,
      webhookUrl: 'https://api.crmunifier.com/webhooks/gmail',
      apiKey: 'gm_sk_test_fedcba0987654321',
      config: {
        email: 'support@crmunifier.com',
        oauthConnected: true
      }
    },
    {
      id: 4,
      name: 'Facebook Messenger',
      type: 'messenger',
      status: 'warning',
      description: 'Facebook Messenger integration',
      lastSync: '2 hours ago',
      messagesCount: 234,
      webhookUrl: 'https://api.crmunifier.com/webhooks/facebook',
      apiKey: 'fb_sk_test_9876543210fedcba',
      config: {
        pageId: '1234567890123456',
        appId: '9876543210123456'
      }
    },
    {
      id: 5,
      name: 'Instagram DM',
      type: 'instagram',
      status: 'inactive',
      description: 'Instagram Direct Messages',
      lastSync: '1 day ago',
      messagesCount: 89,
      webhookUrl: 'https://api.crmunifier.com/webhooks/instagram',
      apiKey: 'ig_sk_test_abcd1234efgh5678',
      config: {
        businessAccount: '@crmunifier',
        connected: false
      }
    }
  ]

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
      case 'messenger': return '💬'
      case 'instagram': return '📷'
      default: return '🔌'
    }
  }

  const toggleApiKey = (providerId: number) => {
    setShowApiKey(prev => ({
      ...prev,
      [providerId]: !prev[providerId]
    }))
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    // You could add a toast notification here
  }

  const testConnection = async (provider: any) => {
    setTestingConnection(prev => ({ ...prev, [provider.id]: true }))
    setConnectionResults(prev => ({ ...prev, [provider.id]: null }))
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Simulate different results based on provider status
      const isSuccess = provider.status === 'active' || Math.random() > 0.3
      
      if (isSuccess) {
        setConnectionResults(prev => ({
          ...prev,
          [provider.id]: {
            status: 'success',
            message: `Successfully connected to ${provider.name}. All systems operational.`
          }
        }))
      } else {
        setConnectionResults(prev => ({
          ...prev,
          [provider.id]: {
            status: 'error',
            message: `Failed to connect to ${provider.name}. Please check your configuration.`
          }
        }))
      }
      
      // Here you would make actual API call:
      // const response = await fetch(`/api/providers/${provider.id}/test`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' }
      // })
      
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
            <button className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center space-x-2">
              <Plus size={20} />
              <span>Add Provider</span>
            </button>
          </div>
        </div>

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
                  {providers.reduce((sum, p) => sum + p.messagesCount, 0).toLocaleString()}
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
                          <span>Last sync: {provider.lastSync}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <MessageSquare size={14} />
                          <span>{provider.messagesCount.toLocaleString()} messages</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded">
                      <Activity size={18} />
                    </button>
                    <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded">
                      <Edit size={18} />
                    </button>
                    <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded">
                      <Power size={18} />
                    </button>
                    <button className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded">
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
                            {provider.webhookUrl}
                          </code>
                          <button 
                            onClick={() => copyToClipboard(provider.webhookUrl)}
                            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                          >
                            <Copy size={16} />
                          </button>
                          <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded">
                            <ExternalLink size={16} />
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">API Key</label>
                        <div className="flex items-center space-x-2">
                          <code className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm font-mono">
                            {showApiKey[provider.id] ? provider.apiKey : '••••••••••••••••'}
                          </code>
                          <button 
                            onClick={() => toggleApiKey(provider.id)}
                            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                          >
                            {showApiKey[provider.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                          <button 
                            onClick={() => copyToClipboard(provider.apiKey)}
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
                      {Object.entries(provider.config).map(([key, value]) => (
                        <div key={key} className="flex justify-between items-center">
                          <span className="text-xs font-medium text-gray-500 capitalize">
                            {key.replace(/([A-Z])/g, ' $1').toLowerCase()}:
                          </span>
                          <span className="text-sm text-gray-900">
                            {typeof value === 'boolean' ? (value ? '✓' : '✗') : value}
                          </span>
                        </div>
                      ))}
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
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
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
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}