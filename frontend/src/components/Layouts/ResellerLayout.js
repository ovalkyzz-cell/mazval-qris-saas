import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  FiHome, FiUsers, FiCreditCard, FiSettings, FiLogOut, FiMenu, FiX
} from 'react-icons/fi';

const ResellerLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuItems = [
    { path: '/reseller', label: 'Dashboard', icon: FiHome },
    { path: '/reseller/customers', label: 'Customers', icon: FiUsers },
    { path: '/reseller/transactions', label: 'Transactions', icon: FiCreditCard },
    { path: '/settings', label: 'Settings', icon: FiSettings },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <header className="lg:hidden bg-blue-600 text-white px-4 py-3 fixed top-0 left-0 right-0 z-30">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-blue-700 rounded-lg"
          >
            {sidebarOpen ? <FiX size={20} /> : <FiMenu size={20} />}
          </button>
          <h1 className="text-lg font-bold">Reseller Panel</h1>
          <div className="w-10"></div>
        </div>
      </header>

      {/* Sidebar */}
      <aside className={`sidebar bg-blue-600 text-white ${sidebarOpen ? 'open' : ''} lg:translate-x-0`}>
        <div className="p-6 border-b border-blue-500">
          <h1 className="text-xl font-bold">MazVal Reseller</h1>
          <p className="text-sm text-blue-200">Reseller Dashboard</p>
        </div>

        <nav className="p-4 space-y-1">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-link text-blue-100 hover:text-white hover:bg-blue-700 ${isActive(item.path) ? 'active bg-blue-700 text-white' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-blue-500">
          <div className="flex items-center gap-3 p-3">
            <img
              src={user?.avatar || `https://ui-avatars.com/api/?name=${user?.name || 'R'}`}
              alt={user?.name}
              className="w-10 h-10 rounded-full"
            />
            <div className="flex-1">
              <p className="text-sm font-medium">{user?.name || 'Reseller'}</p>
              <p className="text-xs text-blue-200">Reseller Account</p>
            </div>
            <button
              onClick={logout}
              className="p-2 hover:bg-blue-700 rounded-lg text-blue-200 hover:text-white"
            >
              <FiLogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen pt-16 lg:pt-0">
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-20"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default ResellerLayout;
