'use client'

import { useState } from 'react'
import { 
  Users, 
  MessageSquare, 
  Settings, 
  Search,
  Filter,
  Download,
  Plus,
  Mail,
  Phone,
  Calendar,
  MapPin,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Home,
  Menu,
  X,
  BarChart3
} from 'lucide-react'
import Link from 'next/link'

export default function CustomersPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFilter, setSelectedFilter] = useState('all')

  const customers = [
    {
      id: 1,
      name: 'John Smith',
      email: 'john@example.com',
      phone: '+1 (555) 123-4567',
      company: 'Acme Corp',
      location: 'New York, NY',
      status: 'active',
      lastContact: '2 hours ago',
      totalMessages: 145,
      tags: ['VIP', 'Support']
    },
    {
      id: 2,
      name: 'Sarah Johnson',
      email: 'sarah@techstart.com',
      phone: '+1 (555) 987-6543',
      company: 'TechStart Inc',
      location: 'San Francisco, CA',
      status: 'active',
      lastContact: '1 day ago',
      totalMessages: 89,
      tags: ['Enterprise']
    },
    {
      id: 3,
      name: 'Mike Chen',
      email: 'mike.chen@design.co',
      phone: '+1 (555) 456-7890',
      company: 'Design Co',
      location: 'Los Angeles, CA',
      status: 'inactive',
      lastContact: '5 days ago',
      totalMessages: 23,
      tags: ['Prospect']
    },
    {
      id: 4,
      name: 'Emily Rodriguez',
      email: 'emily@marketing.pro',
      phone: '+1 (555) 321-0987',
      company: 'Marketing Pro',
      location: 'Chicago, IL',
      status: 'active',
      lastContact: '3 hours ago',
      totalMessages: 67,
      tags: ['Support', 'Premium']
    },
    {
      id: 5,
      name: 'David Brown',
      email: 'david@startup.io',
      phone: '+1 (555) 654-3210',
      company: 'Startup.io',
      location: 'Austin, TX',
      status: 'pending',
      lastContact: '2 days ago',
      totalMessages: 12,
      tags: ['New']
    }
  ]

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer.company.toLowerCase().includes(searchTerm.toLowerCase())
    
    if (selectedFilter === 'all') return matchesSearch
    return matchesSearch && customer.status === selectedFilter
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'inactive': return 'bg-gray-100 text-gray-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
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
                className="flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium bg-blue-100 text-blue-700"
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
                className="flex items-center space-x-2 w-full px-3 py-2 rounded-md text-base font-medium bg-blue-100 text-blue-700"
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
              <p className="text-gray-600 mt-2">Manage customer profiles and communication history</p>
            </div>
            <button className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center space-x-2">
              <Plus size={20} />
              <span>Add Customer</span>
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Filter */}
            <div className="flex items-center space-x-2">
              <Filter size={20} className="text-gray-400" />
              <select
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            {/* Export */}
            <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <Download size={20} />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Customer Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Messages
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                          {customer.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                          <div className="flex space-x-1 mt-1">
                            {customer.tags.map((tag) => (
                              <span key={tag} className="inline-flex px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        <div className="flex items-center space-x-1 mb-1">
                          <Mail size={14} className="text-gray-400" />
                          <span>{customer.email}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Phone size={14} className="text-gray-400" />
                          <span>{customer.phone}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{customer.company}</div>
                      <div className="flex items-center space-x-1 text-sm text-gray-500">
                        <MapPin size={14} />
                        <span>{customer.location}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(customer.status)}`}>
                        {customer.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center space-x-1">
                        <Calendar size={14} className="text-gray-400" />
                        <span>{customer.lastContact}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {customer.totalMessages}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button className="text-blue-600 hover:text-blue-900">
                          <Eye size={16} />
                        </button>
                        <button className="text-gray-600 hover:text-gray-900">
                          <Edit size={16} />
                        </button>
                        <button className="text-red-600 hover:text-red-900">
                          <Trash2 size={16} />
                        </button>
                        <button className="text-gray-600 hover:text-gray-900">
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="bg-white px-6 py-3 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing <span className="font-medium">1</span> to <span className="font-medium">{filteredCustomers.length}</span> of{' '}
                <span className="font-medium">{customers.length}</span> results
              </div>
              <div className="flex space-x-1">
                <button className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50">
                  Previous
                </button>
                <button className="px-3 py-1 bg-blue-500 text-white rounded text-sm">
                  1
                </button>
                <button className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50">
                  2
                </button>
                <button className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50">
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}