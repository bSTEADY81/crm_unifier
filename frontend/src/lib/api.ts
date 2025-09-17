import { ApiResponse, User, Customer, Message, Provider } from '@/types/api'

class ApiClient {
  private baseUrl: string
  private authToken: string | null = null

  constructor() {
    this.baseUrl = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:3001/api/v1'
  }

  setAuthToken(token: string) {
    this.authToken = token
  }

  clearAuthToken() {
    this.authToken = null
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    }

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`
    }

    console.log(`API Request: ${options.method || 'GET'} ${url}`)

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      })

      console.log(`API Response: ${response.status} ${response.statusText}`)

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`API Error ${response.status}:`, errorText)
        
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`
        
        // Try to parse error response
        try {
          const errorData = JSON.parse(errorText)
          if (errorData.message) {
            errorMessage = errorData.message
          }
        } catch (e) {
          // Use default error message
        }
        
        throw new Error(errorMessage)
      }

      const data = await response.json()
      console.log('API Success:', { endpoint, dataKeys: Object.keys(data) })
      
      return {
        success: true,
        data,
        error: null
      }
    } catch (error) {
      console.error(`API Request Failed for ${url}:`, error)
      
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  // Authentication
  async login(email: string, password: string): Promise<ApiResponse<{ user: User; token: string }>> {
    const response = await this.request<{ user: User; accessToken: string; expiresIn: number }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    
    // Map backend response format to frontend expected format
    if (response.success && response.data) {
      return {
        success: true,
        data: {
          user: response.data.user,
          token: response.data.accessToken // Map accessToken to token
        },
        error: null
      }
    }
    
    return {
      success: false,
      data: null,
      error: response.error
    }
  }

  async register(userData: {
    name: string
    email: string
    password: string
  }): Promise<ApiResponse<{ user: User; token: string }>> {
    const response = await this.request<{ user: User; accessToken: string; expiresIn: number }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    })
    
    // Map backend response format to frontend expected format
    if (response.success && response.data) {
      return {
        success: true,
        data: {
          user: response.data.user,
          token: response.data.accessToken // Map accessToken to token
        },
        error: null
      }
    }
    
    return {
      success: false,
      data: null,
      error: response.error
    }
  }

  async logout(): Promise<ApiResponse<null>> {
    const result = await this.request<null>('/auth/logout', {
      method: 'POST',
    })
    this.clearAuthToken()
    return result
  }

  async refreshToken(): Promise<ApiResponse<{ token: string }>> {
    return this.request('/auth/refresh', {
      method: 'POST',
    })
  }

  // Users
  async getCurrentUser(): Promise<ApiResponse<User>> {
    return this.request('/users/me')
  }

  async updateUser(userId: string, userData: Partial<User>): Promise<ApiResponse<User>> {
    return this.request(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    })
  }

  // Customers
  async getCustomers(params?: {
    page?: number
    limit?: number
    search?: string
    status?: string
  }): Promise<ApiResponse<{ customers: Customer[]; total: number; page: number; limit: number }>> {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.append('page', params.page.toString())
    if (params?.limit) searchParams.append('limit', params.limit.toString())
    if (params?.search) searchParams.append('search', params.search)
    if (params?.status) searchParams.append('status', params.status)

    const queryString = searchParams.toString()
    return this.request(`/customers${queryString ? `?${queryString}` : ''}`)
  }

  async getCustomer(customerId: string): Promise<ApiResponse<Customer>> {
    return this.request(`/customers/${customerId}`)
  }

  async createCustomer(customerData: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<Customer>> {
    return this.request('/customers', {
      method: 'POST',
      body: JSON.stringify(customerData),
    })
  }

  async updateCustomer(customerId: string, customerData: Partial<Customer>): Promise<ApiResponse<Customer>> {
    return this.request(`/customers/${customerId}`, {
      method: 'PUT',
      body: JSON.stringify(customerData),
    })
  }

  async deleteCustomer(customerId: string): Promise<ApiResponse<null>> {
    return this.request(`/customers/${customerId}`, {
      method: 'DELETE',
    })
  }

  // Messages
  async getMessages(params?: {
    page?: number
    limit?: number
    customerId?: string
    channel?: string
    search?: string
  }): Promise<ApiResponse<{ messages: Message[]; total: number; page: number; limit: number }>> {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.append('page', params.page.toString())
    if (params?.limit) searchParams.append('limit', params.limit.toString())
    if (params?.customerId) searchParams.append('customerId', params.customerId)
    if (params?.channel) searchParams.append('channel', params.channel)
    if (params?.search) searchParams.append('search', params.search)

    const queryString = searchParams.toString()
    return this.request(`/messages${queryString ? `?${queryString}` : ''}`)
  }

  async getMessage(messageId: string): Promise<ApiResponse<Message>> {
    return this.request(`/messages/${messageId}`)
  }

  async sendMessage(messageData: {
    customerId: string
    content: string
    channel: string
    metadata?: Record<string, any>
  }): Promise<ApiResponse<Message>> {
    return this.request('/messages', {
      method: 'POST',
      body: JSON.stringify(messageData),
    })
  }

  async markMessageAsRead(messageId: string): Promise<ApiResponse<Message>> {
    return this.request(`/messages/${messageId}/read`, {
      method: 'POST',
    })
  }

  // Conversations
  async getConversations(params?: {
    page?: number
    limit?: number
    status?: string
  }): Promise<ApiResponse<{ conversations: any[]; total: number; page: number; limit: number }>> {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.append('page', params.page.toString())
    if (params?.limit) searchParams.append('limit', params.limit.toString())
    if (params?.status) searchParams.append('status', params.status)

    const queryString = searchParams.toString()
    return this.request(`/conversations${queryString ? `?${queryString}` : ''}`)
  }

  async getConversation(conversationId: string): Promise<ApiResponse<{
    conversation: any
    messages: Message[]
  }>> {
    return this.request(`/conversations/${conversationId}`)
  }

  // Providers
  async getProviders(): Promise<ApiResponse<{ providers: Provider[]; pagination?: any }>> {
    return this.request('/providers')
  }

  async getProvider(providerId: string): Promise<ApiResponse<Provider>> {
    return this.request(`/providers/${providerId}`)
  }

  async createProvider(providerData: Omit<Provider, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<Provider>> {
    return this.request('/providers', {
      method: 'POST',
      body: JSON.stringify(providerData),
    })
  }

  async updateProvider(providerId: string, providerData: Partial<Provider>): Promise<ApiResponse<Provider>> {
    return this.request(`/providers/${providerId}`, {
      method: 'PUT',
      body: JSON.stringify(providerData),
    })
  }

  async deleteProvider(providerId: string): Promise<ApiResponse<null>> {
    return this.request(`/providers/${providerId}`, {
      method: 'DELETE',
    })
  }

  async testProviderConnection(providerId: string): Promise<ApiResponse<{ status: string; message: string }>> {
    return this.request(`/providers/${providerId}/test`, {
      method: 'POST',
    })
  }

  // Analytics
  async getDashboardStats(): Promise<ApiResponse<{
    totalCustomers: number
    totalMessages: number
    activeProviders: number
    averageResponseTime: number
    messagesByChannel: Record<string, number>
    customersByStatus: Record<string, number>
    activityData: Array<{ date: string; messages: number; customers: number }>
  }>> {
    return this.request('/analytics/dashboard')
  }

  async getMessageAnalytics(params?: {
    startDate?: string
    endDate?: string
    channel?: string
  }): Promise<ApiResponse<{
    totalMessages: number
    messagesByDay: Array<{ date: string; count: number }>
    messagesByChannel: Record<string, number>
    averageResponseTime: number
  }>> {
    const searchParams = new URLSearchParams()
    if (params?.startDate) searchParams.append('startDate', params.startDate)
    if (params?.endDate) searchParams.append('endDate', params.endDate)
    if (params?.channel) searchParams.append('channel', params.channel)

    const queryString = searchParams.toString()
    return this.request(`/analytics/messages${queryString ? `?${queryString}` : ''}`)
  }

  // Health check
  async healthCheck(): Promise<ApiResponse<{ status: string; timestamp: string }>> {
    return this.request('/health')
  }
}

// Export singleton instance
export const apiClient = new ApiClient()
export default apiClient