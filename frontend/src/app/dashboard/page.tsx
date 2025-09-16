'use client'

import { useState } from 'react'
import { 
  Users, 
  MessageSquare, 
  Settings, 
  Activity, 
  TrendingUp, 
  Clock, 
  AlertCircle,
  CheckCircle,
  BarChart3,
  PieChart,
  Home,
  Menu,
  X
} from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const stats = [
    {
      title: 'Total Customers',
      value: '2,847',
      change: '+12%',
      trend: 'up',
      icon: Users,
      color: 'bg-blue-500',
      href: '/customers'
    },
    {
      title: 'Messages Today',
      value: '1,203',
      change: '+8%',
      trend: 'up',
      icon: MessageSquare,
      color: 'bg-green-500',
      href: '/messages'
    },
    {
      title: 'Active Providers',
      value: '7',
      change: '0%',
      trend: 'stable',
      icon: Settings,
      color: 'bg-purple-500',
      href: '/providers'
    },
    {
      title: 'Response Time',
      value: '2.4m',
      change: '-15%',
      trend: 'down',
      icon: Clock,
      color: 'bg-yellow-500',
      href: null // No specific page for response time
    }
  ]

  const recentActivity = [
    {
      id: 1,
      type: 'message',
      content: 'New message from john@example.com via WhatsApp',
      time: '2 minutes ago',
      status: 'new'
    },
    {
      id: 2,
      type: 'customer',
      content: 'Customer profile updated: Sarah Johnson',
      time: '15 minutes ago',
      status: 'updated'
    },
    {
      id: 3,
      type: 'provider',
      content: 'Twilio webhook configuration successful',
      time: '1 hour ago',
      status: 'success'
    },
    {
      id: 4,
      type: 'alert',
      content: 'High message volume detected - consider scaling',
      time: '2 hours ago',
      status: 'warning'
    }
  ]

  const providerStatus = [
    { name: 'WhatsApp Business', status: 'active', messages: 456, uptime: '99.9%' },
    { name: 'Twilio SMS', status: 'active', messages: 234, uptime: '99.8%' },
    { name: 'Gmail', status: 'active', messages: 189, uptime: '100%' },
    { name: 'Facebook Messenger', status: 'warning', messages: 67, uptime: '98.5%' },
    { name: 'Instagram DM', status: 'active', messages: 89, uptime: '99.7%' }
  ]

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
                className="flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium bg-blue-100 text-blue-700"
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
                className="flex items-center space-x-2 w-full px-3 py-2 rounded-md text-base font-medium bg-blue-100 text-blue-700"
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
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">Overview of your CRM activity and performance</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <div key={stat.title} className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                  </div>
                  {stat.href ? (
                    <Link href={stat.href} className={`${stat.color} w-12 h-12 rounded-lg flex items-center justify-center hover:opacity-80 transition-opacity cursor-pointer`}>
                      <Icon className="text-white" size={24} />
                    </Link>
                  ) : (
                    <div className={`${stat.color} w-12 h-12 rounded-lg flex items-center justify-center`}>
                      <Icon className="text-white" size={24} />
                    </div>
                  )}
                </div>
                <div className="mt-4 flex items-center">
                  <TrendingUp 
                    size={16} 
                    className={`mr-1 ${
                      stat.trend === 'up' ? 'text-green-500' : 
                      stat.trend === 'down' ? 'text-red-500' : 'text-gray-400'
                    }`} 
                  />
                  <span className={`text-sm font-medium ${
                    stat.trend === 'up' ? 'text-green-600' : 
                    stat.trend === 'down' ? 'text-red-600' : 'text-gray-500'
                  }`}>
                    {stat.change}
                  </span>
                  <span className="text-sm text-gray-500 ml-1">from last month</span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Recent Activity */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
                  <Activity size={20} className="text-gray-400" />
                </div>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start space-x-3">
                      <div className={`w-2 h-2 rounded-full mt-2 ${
                        activity.status === 'new' ? 'bg-blue-500' :
                        activity.status === 'updated' ? 'bg-green-500' :
                        activity.status === 'success' ? 'bg-green-500' :
                        'bg-yellow-500'
                      }`} />
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">{activity.content}</p>
                        <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                      </div>
                      {activity.status === 'warning' && (
                        <AlertCircle size={16} className="text-yellow-500 mt-1" />
                      )}
                      {activity.status === 'success' && (
                        <CheckCircle size={16} className="text-green-500 mt-1" />
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-6">
                  <Link 
                    href="/activity"
                    className="text-blue-500 hover:text-blue-600 text-sm font-medium"
                  >
                    View all activity →
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Provider Status */}
          <div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Provider Status</h2>
                  <PieChart size={20} className="text-gray-400" />
                </div>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {providerStatus.map((provider) => (
                    <div key={provider.name} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${
                          provider.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'
                        }`} />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{provider.name}</p>
                          <p className="text-xs text-gray-500">{provider.messages} messages today</p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-500">{provider.uptime}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6">
                  <Link 
                    href="/providers"
                    className="text-blue-500 hover:text-blue-600 text-sm font-medium"
                  >
                    Manage providers →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}