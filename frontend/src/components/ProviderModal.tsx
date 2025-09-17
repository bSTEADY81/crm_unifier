'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, TestTube, Check, AlertCircle, Info } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Select from '@radix-ui/react-select'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

// Provider types and their configurations
const providerTypes = [
  { value: 'whatsapp', label: 'WhatsApp Business', icon: '📱' },
  { value: 'sms', label: 'Twilio SMS', icon: '💬' },
  { value: 'email', label: 'Gmail', icon: '📧' },
  { value: 'facebook', label: 'Facebook Messenger', icon: '📘' },
  { value: 'instagram', label: 'Instagram DM', icon: '📷' }
]

// Provider-specific credential schemas
const credentialSchemas = {
  whatsapp: z.object({
    accessToken: z.string().min(1, 'Access token is required'),
    phoneNumberId: z.string().min(1, 'Phone number ID is required'),
    webhookVerifyToken: z.string().min(1, 'Webhook verify token is required')
  }),
  sms: z.object({
    accountSid: z.string().min(1, 'Account SID is required'),
    authToken: z.string().min(1, 'Auth token is required'),
    phoneNumber: z.string().min(1, 'Phone number is required')
  }),
  email: z.object({
    clientId: z.string().min(1, 'Client ID is required'),
    clientSecret: z.string().min(1, 'Client secret is required'),
    refreshToken: z.string().min(1, 'Refresh token is required')
  }),
  facebook: z.object({
    pageAccessToken: z.string().min(1, 'Page access token is required'),
    webhookVerifyToken: z.string().min(1, 'Webhook verify token is required'),
    appSecret: z.string().min(1, 'App secret is required')
  }),
  instagram: z.object({
    accessToken: z.string().min(1, 'Access token is required'),
    webhookVerifyToken: z.string().min(1, 'Webhook verify token is required'),
    appSecret: z.string().min(1, 'App secret is required')
  })
}

const baseProviderSchema = z.object({
  name: z.string().min(1, 'Provider name is required').max(255, 'Name too long'),
  type: z.enum(['whatsapp', 'sms', 'email', 'facebook', 'instagram']),
  description: z.string().optional()
})

interface Provider {
  id?: string
  name: string
  type: string
  status: string
  config: Record<string, any>
  description?: string
  isActive: boolean
  messageCount: number
  lastHealthCheck?: string
  createdAt: string
  updatedAt: string
}

interface ProviderModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (provider: any) => Promise<void>
  provider?: Provider | null
  mode: 'create' | 'edit'
}

interface CredentialFieldProps {
  name: string
  label: string
  type?: string
  placeholder?: string
  required?: boolean
  helpText?: string
  value: string
  onChange: (value: string) => void
  error?: string
}

function CredentialField({ 
  name, 
  label, 
  type = 'text', 
  placeholder, 
  required = false, 
  helpText, 
  value, 
  onChange, 
  error 
}: CredentialFieldProps) {
  const [showValue, setShowValue] = useState(false)
  
  const isPassword = type === 'password' || name.toLowerCase().includes('token') || name.toLowerCase().includes('secret')
  const inputType = isPassword && !showValue ? 'password' : 'text'

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <input
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            error ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder={placeholder}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowValue(!showValue)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showValue ? '👁️' : '🙈'}
          </button>
        )}
      </div>
      {helpText && (
        <p className="mt-1 text-xs text-gray-500 flex items-start gap-1">
          <Info size={12} className="mt-0.5 flex-shrink-0" />
          {helpText}
        </p>
      )}
      {error && (
        <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
          <AlertCircle size={16} />
          {error}
        </p>
      )}
    </div>
  )
}

export default function ProviderModal({ isOpen, onClose, onSave, provider, mode }: ProviderModalProps) {
  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [connectionTestResult, setConnectionTestResult] = useState<any>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'whatsapp' as keyof typeof credentialSchemas,
    description: '',
    config: {} as Record<string, string>
  })

  // Initialize form data when provider changes or modal opens
  useEffect(() => {
    if (provider && mode === 'edit') {
      setFormData({
        name: provider.name,
        type: provider.type as keyof typeof credentialSchemas,
        description: provider.description || '',
        config: provider.config || {}
      })
      setStep(2) // Go directly to credentials for editing
    } else {
      setFormData({
        name: '',
        type: 'whatsapp',
        description: '',
        config: {}
      })
      setStep(1)
    }
    setErrors({})
    setConnectionTestResult(null)
  }, [provider, mode, isOpen])

  // Listen for Gmail OAuth response
  useEffect(() => {
    const handleGmailAuth = () => {
      const hash = window.location.hash
      if (hash.includes('gmail-auth=')) {
        try {
          const authData = hash.split('gmail-auth=')[1]
          const tokens = JSON.parse(decodeURIComponent(authData))
          
          if (tokens.refresh_token && formData.type === 'email') {
            setFormData(prev => ({
              ...prev,
              config: {
                ...prev.config,
                refreshToken: tokens.refresh_token,
                // Optionally pre-fill other fields if they match
                clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || prev.config.clientId,
                // Note: Don't auto-fill client secret for security
              }
            }))
            
            // Clear the hash
            window.location.hash = ''
            
            // Show success message
            setConnectionTestResult({
              success: true,
              message: `Successfully authenticated with Gmail (${tokens.email})`,
              details: 'Refresh token has been automatically filled in the form.'
            })
          }
        } catch (error) {
          console.error('Failed to parse Gmail auth response:', error)
        }
      }
    }

    // Check on mount and listen for hash changes
    handleGmailAuth()
    window.addEventListener('hashchange', handleGmailAuth)
    
    return () => {
      window.removeEventListener('hashchange', handleGmailAuth)
    }
  }, [formData.type])

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.name.trim()) {
      newErrors.name = 'Provider name is required'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const validateStep2 = () => {
    const newErrors: Record<string, string> = {}
    const schema = credentialSchemas[formData.type]
    
    try {
      schema.parse(formData.config)
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message
          }
        })
      }
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2)
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  const testConnection = async () => {
    if (!validateStep2()) return

    setIsTestingConnection(true)
    setConnectionTestResult(null)

    try {
      // For edit mode, test using the provider ID
      const testEndpoint = mode === 'edit' && provider?.id 
        ? `/api/v1/providers/${provider.id}/test`
        : '/api/v1/providers/test-config'

      const response = await fetch(testEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          type: formData.type,
          config: formData.config
        })
      })

      const result = await response.json()
      
      setConnectionTestResult({
        success: response.ok && result.status === 'success',
        message: result.message || (response.ok ? 'Connection successful!' : 'Connection failed'),
        details: result.details,
        responseTime: result.responseTime
      })
    } catch (error) {
      setConnectionTestResult({
        success: false,
        message: 'Failed to test connection. Please check your network and try again.',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsTestingConnection(false)
    }
  }

  const handleSubmit = async () => {
    if (!validateStep2()) return

    setIsLoading(true)
    setErrors({})

    try {
      const payload = {
        name: formData.name,
        type: formData.type,
        config: formData.config,
        description: formData.description
      }

      await onSave(payload)
      onClose()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save provider'
      setErrors({ submit: errorMessage })
    } finally {
      setIsLoading(false)
    }
  }

  const updateConfig = (key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      config: { ...prev.config, [key]: value }
    }))
    // Clear error when user types
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: '' }))
    }
  }

  const getCredentialFields = () => {
    switch (formData.type) {
      case 'whatsapp':
        return [
          { name: 'accessToken', label: 'Access Token', type: 'password', required: true, helpText: 'Your WhatsApp Business API access token' },
          { name: 'phoneNumberId', label: 'Phone Number ID', required: true, helpText: 'The ID of your WhatsApp Business phone number' },
          { name: 'webhookVerifyToken', label: 'Webhook Verify Token', type: 'password', required: true, helpText: 'Token used to verify webhook requests' }
        ]
      case 'sms':
        return [
          { name: 'accountSid', label: 'Account SID', required: true, helpText: 'Your Twilio Account SID' },
          { name: 'authToken', label: 'Auth Token', type: 'password', required: true, helpText: 'Your Twilio Auth Token' },
          { name: 'phoneNumber', label: 'Phone Number', required: true, helpText: 'Your Twilio phone number (e.g., +15551234567)' }
        ]
      case 'email':
        return [
          { name: 'clientId', label: 'Client ID', required: true, helpText: 'Gmail API Client ID' },
          { name: 'clientSecret', label: 'Client Secret', type: 'password', required: true, helpText: 'Gmail API Client Secret' },
          { name: 'refreshToken', label: 'Refresh Token', type: 'password', required: true, helpText: 'OAuth refresh token for Gmail access' }
        ]
      case 'facebook':
        return [
          { name: 'pageAccessToken', label: 'Page Access Token', type: 'password', required: true, helpText: 'Facebook Page access token' },
          { name: 'webhookVerifyToken', label: 'Webhook Verify Token', type: 'password', required: true, helpText: 'Token for webhook verification' },
          { name: 'appSecret', label: 'App Secret', type: 'password', required: true, helpText: 'Facebook App Secret' }
        ]
      case 'instagram':
        return [
          { name: 'accessToken', label: 'Access Token', type: 'password', required: true, helpText: 'Instagram Business API access token' },
          { name: 'webhookVerifyToken', label: 'Webhook Verify Token', type: 'password', required: true, helpText: 'Token for webhook verification' },
          { name: 'appSecret', label: 'App Secret', type: 'password', required: true, helpText: 'Instagram App Secret' }
        ]
      default:
        return []
    }
  }

  if (!isOpen) return null

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-50 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto z-50">
          {/* Header */}
          <div className="flex justify-between items-center p-6 border-b">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {mode === 'edit' ? 'Edit Provider' : 'Add New Provider'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {step === 1 ? 'Configure basic settings' : 'Set up credentials and test connection'}
              </p>
            </div>
            <Dialog.Close asChild>
              <button className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={24} />
              </button>
            </Dialog.Close>
          </div>

          {/* Progress indicator */}
          {mode === 'create' && (
            <div className="px-6 py-4 border-b bg-gray-50">
              <div className="flex items-center space-x-4">
                <div className={`flex items-center space-x-2 ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200'
                  }`}>
                    1
                  </div>
                  <span className="text-sm font-medium">Basic Info</span>
                </div>
                <div className={`h-px flex-1 ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`} />
                <div className={`flex items-center space-x-2 ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200'
                  }`}>
                    2
                  </div>
                  <span className="text-sm font-medium">Credentials</span>
                </div>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="p-6">
            {step === 1 && mode === 'create' && (
              <div>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Provider Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.name ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="e.g., My WhatsApp Business"
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                  )}
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Provider Type <span className="text-red-500">*</span>
                  </label>
                  <Select.Root value={formData.type} onValueChange={(value) => 
                    setFormData(prev => ({ ...prev, type: value as keyof typeof credentialSchemas, config: {} }))
                  }>
                    <Select.Trigger className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between">
                      <Select.Value />
                      <Select.Icon />
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content className="bg-white border border-gray-300 rounded-lg shadow-lg z-50">
                        <Select.Viewport className="p-1">
                          {providerTypes.map((type) => (
                            <Select.Item 
                              key={type.value} 
                              value={type.value}
                              className="px-3 py-2 cursor-pointer hover:bg-blue-50 rounded flex items-center gap-2"
                            >
                              <Select.ItemText>
                                <span className="mr-2">{type.icon}</span>
                                {type.label}
                              </Select.ItemText>
                            </Select.Item>
                          ))}
                        </Select.Viewport>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description (Optional)
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Brief description of this provider's purpose..."
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                    {providerTypes.find(p => p.value === formData.type)?.icon}
                    {providerTypes.find(p => p.value === formData.type)?.label} Credentials
                  </h3>
                  
                  {getCredentialFields().map((field) => (
                    <CredentialField
                      key={field.name}
                      name={field.name}
                      label={field.label}
                      type={field.type}
                      required={field.required}
                      helpText={field.helpText}
                      value={formData.config[field.name] || ''}
                      onChange={(value) => updateConfig(field.name, value)}
                      error={errors[field.name]}
                    />
                  ))}

                  {/* Gmail OAuth Helper */}
                  {formData.type === 'email' && (
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          <Info className="text-blue-600" size={20} />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-blue-900 mb-2">
                            Need a refresh token?
                          </h4>
                          <p className="text-sm text-blue-700 mb-3">
                            Use Google OAuth Playground to get your refresh token, or click below to authenticate directly.
                          </p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                window.open('/api/auth/gmail', '_blank', 'width=500,height=600')
                              }}
                              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 flex items-center gap-2"
                            >
                              🔐 Authenticate with Gmail
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                window.open('https://developers.google.com/oauthplayground/', '_blank')
                              }}
                              className="px-3 py-1.5 bg-white text-blue-600 text-sm border border-blue-300 rounded hover:bg-blue-50 flex items-center gap-2"
                            >
                              🔧 OAuth Playground
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Connection Test */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-900">Test Connection</h4>
                    <button
                      type="button"
                      onClick={testConnection}
                      disabled={isTestingConnection}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isTestingConnection ? (
                        <>
                          <Loader2 className="animate-spin" size={16} />
                          Testing...
                        </>
                      ) : (
                        <>
                          <TestTube size={16} />
                          Test Connection
                        </>
                      )}
                    </button>
                  </div>
                  
                  {connectionTestResult && (
                    <div className={`p-3 rounded-lg ${
                      connectionTestResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                    }`}>
                      <div className="flex items-start gap-2">
                        {connectionTestResult.success ? (
                          <Check className="text-green-600 mt-0.5" size={16} />
                        ) : (
                          <AlertCircle className="text-red-600 mt-0.5" size={16} />
                        )}
                        <div>
                          <p className={`text-sm font-medium ${
                            connectionTestResult.success ? 'text-green-800' : 'text-red-800'
                          }`}>
                            {connectionTestResult.message}
                          </p>
                          {connectionTestResult.details && (
                            <p className={`text-xs mt-1 ${
                              connectionTestResult.success ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {connectionTestResult.details}
                            </p>
                          )}
                          {connectionTestResult.responseTime && (
                            <p className="text-xs text-gray-500 mt-1">
                              Response time: {connectionTestResult.responseTime}ms
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {errors.submit && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{errors.submit}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center p-6 border-t bg-gray-50">
            <div>
              {step > 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Back
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              {step === 1 && mode === 'create' ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Saving...
                    </>
                  ) : (
                    <>{mode === 'edit' ? 'Update Provider' : 'Create Provider'}</>
                  )}
                </button>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}