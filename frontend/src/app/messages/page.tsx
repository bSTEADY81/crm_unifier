'use client'

import { useState } from 'react'
import { 
  Users, 
  MessageSquare, 
  Settings, 
  Search,
  Send,
  Paperclip,
  Phone,
  Video,
  MoreVertical,
  Star,
  Archive,
  Reply,
  Forward,
  Home,
  Menu,
  X,
  BarChart3,
  Check,
  CheckCheck
} from 'lucide-react'
import Link from 'next/link'

export default function MessagesPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [selectedConversation, setSelectedConversation] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [conversationMessages, setConversationMessages] = useState(messages)

  const conversations = [
    {
      id: 1,
      customer: 'John Smith',
      avatar: 'JS',
      lastMessage: 'Thanks for the quick response! The issue has been resolved.',
      timestamp: '2 min ago',
      unread: 0,
      channel: 'WhatsApp',
      status: 'read'
    },
    {
      id: 2,
      customer: 'Sarah Johnson',
      avatar: 'SJ',
      lastMessage: 'Could you please send me the updated documentation?',
      timestamp: '15 min ago',
      unread: 2,
      channel: 'Email',
      status: 'delivered'
    },
    {
      id: 3,
      customer: 'Mike Chen',
      avatar: 'MC',
      lastMessage: 'The design looks great! When can we schedule a call?',
      timestamp: '1 hour ago',
      unread: 1,
      channel: 'SMS',
      status: 'sent'
    },
    {
      id: 4,
      customer: 'Emily Rodriguez',
      avatar: 'ER',
      lastMessage: 'Perfect, that works for me. See you then!',
      timestamp: '2 hours ago',
      unread: 0,
      channel: 'Messenger',
      status: 'read'
    },
    {
      id: 5,
      customer: 'David Brown',
      avatar: 'DB',
      lastMessage: 'Hi, I need help with setting up my account.',
      timestamp: '3 hours ago',
      unread: 3,
      channel: 'Instagram',
      status: 'delivered'
    }
  ]

  const messages = [
    {
      id: 1,
      sender: 'John Smith',
      content: 'Hi, I\'m having trouble with the login feature. It keeps saying my credentials are incorrect.',
      timestamp: '10:30 AM',
      isCustomer: true,
      channel: 'WhatsApp'
    },
    {
      id: 2,
      sender: 'Support Agent',
      content: 'Hi John! I\'d be happy to help you with that. Let me check your account settings. Can you please confirm your email address?',
      timestamp: '10:32 AM',
      isCustomer: false,
      channel: 'WhatsApp'
    },
    {
      id: 3,
      sender: 'John Smith',
      content: 'Yes, it\'s john@example.com',
      timestamp: '10:33 AM',
      isCustomer: true,
      channel: 'WhatsApp'
    },
    {
      id: 4,
      sender: 'Support Agent',
      content: 'Perfect! I found the issue. Your account was temporarily locked due to multiple failed login attempts. I\'ve unlocked it for you. Please try logging in again and let me know if you still have issues.',
      timestamp: '10:35 AM',
      isCustomer: false,
      channel: 'WhatsApp'
    },
    {
      id: 5,
      sender: 'John Smith',
      content: 'Thanks for the quick response! The issue has been resolved.',
      timestamp: '10:38 AM',
      isCustomer: true,
      channel: 'WhatsApp'
    }
  ]

  const getChannelColor = (channel: string) => {
    switch (channel) {
      case 'WhatsApp': return 'bg-green-100 text-green-800'
      case 'Email': return 'bg-blue-100 text-blue-800'
      case 'SMS': return 'bg-purple-100 text-purple-800'
      case 'Messenger': return 'bg-blue-100 text-blue-800'
      case 'Instagram': return 'bg-pink-100 text-pink-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <Check size={12} className="text-gray-400" />
      case 'delivered': return <CheckCheck size={12} className="text-gray-400" />
      case 'read': return <CheckCheck size={12} className="text-blue-500" />
      default: return null
    }
  }

  const filteredConversations = conversations.filter(conv =>
    conv.customer.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    
    if (!newMessage.trim() || isSending) return
    
    setIsSending(true)
    
    try {
      // Create new message object
      const messageToSend = {
        id: conversationMessages.length + 1,
        sender: 'Support Agent',
        content: newMessage.trim(),
        timestamp: new Date().toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        isCustomer: false,
        channel: 'WhatsApp'
      }
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Here you would make actual API call:
      // const response = await fetch('/api/messages', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     conversationId: selectedConversation,
      //     content: newMessage.trim(),
      //     channel: 'WhatsApp'
      //   })
      // })
      
      // Add message to conversation
      setConversationMessages(prev => [...prev, messageToSend])
      
      // Clear input
      setNewMessage('')
      
      // Show success feedback (optional)
      // You could add a toast notification here
      
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Failed to send message. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
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
                className="flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium bg-blue-100 text-blue-700"
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
                className="flex items-center space-x-2 w-full px-3 py-2 rounded-md text-base font-medium bg-blue-100 text-blue-700"
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
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Conversations Sidebar */}
        <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Messages</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => setSelectedConversation(conversation.id)}
                className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                  selectedConversation === conversation.id ? 'bg-blue-50 border-blue-200' : ''
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                    {conversation.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {conversation.customer}
                      </h3>
                      <div className="flex items-center space-x-1">
                        {getStatusIcon(conversation.status)}
                        <span className="text-xs text-gray-500">{conversation.timestamp}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600 truncate">{conversation.lastMessage}</p>
                      {conversation.unread > 0 && (
                        <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-blue-500 rounded-full">
                          {conversation.unread}
                        </span>
                      )}
                    </div>
                    <div className="mt-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${getChannelColor(conversation.channel)}`}>
                        {conversation.channel}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Message Area */}
        <div className="flex-1 flex flex-col">
          {/* Message Header */}
          <div className="bg-white border-b border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  JS
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-900">John Smith</h3>
                  <p className="text-xs text-gray-500">Active 2 minutes ago</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded">
                  <Phone size={18} />
                </button>
                <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded">
                  <Video size={18} />
                </button>
                <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded">
                  <Star size={18} />
                </button>
                <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded">
                  <Archive size={18} />
                </button>
                <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded">
                  <MoreVertical size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {conversationMessages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isCustomer ? 'justify-start' : 'justify-end'}`}
              >
                <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.isCustomer 
                    ? 'bg-gray-100 text-gray-900' 
                    : 'bg-blue-500 text-white'
                }`}>
                  <p className="text-sm">{message.content}</p>
                  <div className={`flex items-center justify-between mt-1 ${
                    message.isCustomer ? 'text-gray-500' : 'text-blue-100'
                  }`}>
                    <span className="text-xs">{message.timestamp}</span>
                    {!message.isCustomer && (
                      <div className="ml-2">
                        {getStatusIcon('read')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Message Input */}
          <div className="bg-white border-t border-gray-200 p-4">
            <div className="flex items-center space-x-3">
              <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded">
                <Paperclip size={18} />
              </button>
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isSending}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>
              <button 
                onClick={handleSendMessage}
                disabled={isSending || !newMessage.trim()}
                className="bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center min-w-[40px]"
              >
                {isSending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Send size={18} />
                )}
              </button>
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
              <div className="flex items-center space-x-4">
                <button className="hover:text-gray-700">
                  <Reply size={14} className="inline mr-1" />
                  Reply
                </button>
                <button className="hover:text-gray-700">
                  <Forward size={14} className="inline mr-1" />
                  Forward
                </button>
              </div>
              <span>via WhatsApp</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}