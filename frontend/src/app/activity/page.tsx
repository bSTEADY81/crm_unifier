'use client'

import { useState } from 'react'
import { 
  Activity, 
  MessageSquare, 
  Users, 
  Settings, 
  AlertCircle,
  Clock,
  Filter,
  Search,
  Calendar,
  Home,
  BarChart3,
  Menu,
  X
} from 'lucide-react'
import Link from 'next/link'

export default function ActivityPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [filterType, setFilterType] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const activityData = [
    {
      id: 1,
      type: 'message',
      icon: MessageSquare,
      title: 'New message received',
      description: 'john@example.com sent a message via WhatsApp',
      time: '2 minutes ago',
      timestamp: new Date(Date.now() - 2 * 60 * 1000),
      status: 'new',
      details: 'Thanks for the quick response! The issue has been resolved.'
    },
    {
      id: 2,
      type: 'customer',
      icon: Users,
      title: 'Customer profile updated',
      description: 'Sarah Johnson profile information changed',
      time: '15 minutes ago',
      timestamp: new Date(Date.now() - 15 * 60 * 1000),
      status: 'updated',
      details: 'Contact information and company details updated'
    },
    {
      id: 3,
      type: 'provider',
      icon: Settings,
      title: 'Provider configuration successful',
      description: 'Twilio webhook configuration completed',
      time: '1 hour ago',
      timestamp: new Date(Date.now() - 60 * 60 * 1000),
      status: 'success',
      details: 'Webhook URL verified and connection tested successfully'
    },
    {
      id: 4,
      type: 'alert',
      icon: AlertCircle,
      title: 'High message volume detected',
      description: 'Consider scaling infrastructure',
      time: '2 hours ago',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      status: 'warning',
      details: 'Message volume exceeded 1000 messages/hour threshold'
    },
    {
      id: 5,
      type: 'customer',
      icon: Users,
      title: 'New customer registered',
      description: 'Mike Chen created a new account',
      time: '3 hours ago',
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
      status: 'new',
      details: 'Registration completed via email verification'
    },
    {
      id: 6,
      type: 'message',
      icon: MessageSquare,
      title: 'Message sent successfully',
      description: 'Response sent to Emily Rodriguez via Email',
      time: '4 hours ago',
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
      status: 'success',
      details: 'Support ticket #1234 resolved and response delivered'
    },
    {
      id: 7,
      type: 'provider',
      icon: Settings,
      title: 'Provider status warning',
      description: 'Facebook Messenger connection unstable',
      time: '5 hours ago',
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
      status: 'warning',
      details: 'Connection timeout detected, automatic retry in progress'
    },
    {
      id: 8,
      type: 'customer',
      icon: Users,
      title: 'Customer interaction logged',
      description: 'David Brown phone call completed',
      time: '6 hours ago',
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
      status: 'updated',
      details: 'Call duration: 15 minutes, Status: Account setup assistance'
    },
    {
      id: 9,
      type: 'message',
      icon: MessageSquare,
      title: 'Bulk message campaign sent',
      description: '500 promotional messages delivered via SMS',
      time: '1 day ago',
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
      status: 'success',
      details: 'Campaign "Monthly Newsletter" completed with 98% delivery rate'
    },
    {
      id: 10,
      type: 'alert',
      icon: AlertCircle,
      title: 'System maintenance completed',
      description: 'Database optimization finished',
      time: '1 day ago',
      timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000),
      status: 'success',
      details: 'Scheduled maintenance completed 15 minutes ahead of schedule'
    }
  ]

  const filteredActivity = activityData.filter(item => {
    const matchesType = filterType === 'all' || item.type === filterType
    const matchesSearch = searchQuery === '' || 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesType && matchesSearch
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-500 text-blue-100'
      case 'success': return 'bg-green-500 text-green-100'
      case 'warning': return 'bg-yellow-500 text-yellow-100'
      case 'updated': return 'bg-purple-500 text-purple-100'
      default: return 'bg-gray-500 text-gray-100'
    }
  }

  const getStatusBorder = (status: string) => {
    switch (status) {
      case 'new': return 'border-l-blue-500'
      case 'success': return 'border-l-green-500'
      case 'warning': return 'border-l-yellow-500'
      case 'updated': return 'border-l-purple-500'
      default: return 'border-l-gray-500'
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
                className="flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
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
                className="flex items-center space-x-2 w-full px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-100"
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
          <h1 className="text-3xl font-bold text-gray-900">Activity Log</h1>
          <p className="text-gray-600 mt-2">Complete history of system events and user interactions</p>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search activity..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Filter by Type */}
            <div className="relative">
              <Filter size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Types</option>
                <option value="message">Messages</option>
                <option value="customer">Customers</option>
                <option value="provider">Providers</option>
                <option value="alert">Alerts</option>
              </select>
            </div>

            {/* Date Range */}
            <div className="relative">
              <Calendar size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <select className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                <option>Last 24 hours</option>
                <option>Last 7 days</option>
                <option>Last 30 days</option>
                <option>All time</option>
              </select>
            </div>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Activity Feed ({filteredActivity.length} items)
              </h2>
              <Activity size={20} className="text-gray-400" />
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {filteredActivity.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.id} className={`p-6 border-l-4 ${getStatusBorder(item.status)} hover:bg-gray-50 transition-colors`}>
                  <div className="flex items-start space-x-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getStatusColor(item.status)}`}>
                      <Icon size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            item.status === 'new' ? 'bg-blue-100 text-blue-800' :
                            item.status === 'success' ? 'bg-green-100 text-green-800' :
                            item.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-purple-100 text-purple-800'
                          }`}>
                            {item.status}
                          </span>
                          <Clock size={14} className="text-gray-400" />
                          <span className="text-sm text-gray-500">{item.time}</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                      <p className="text-xs text-gray-500 mt-2">{item.details}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {filteredActivity.length === 0 && (
            <div className="p-12 text-center">
              <Activity size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No activity found</h3>
              <p className="text-gray-500">Try adjusting your search criteria or filters</p>
            </div>
          )}
        </div>

        {/* Load More */}
        {filteredActivity.length > 0 && (
          <div className="mt-8 text-center">
            <button className="bg-white border border-gray-300 rounded-lg px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Load More Activity
            </button>
          </div>
        )}
      </main>
    </div>
  )
}