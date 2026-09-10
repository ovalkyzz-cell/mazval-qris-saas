import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  FiHome, FiUsers, FiUserCheck, FiCreditCard, FiPackage, 
  FiTag, FiShield, FiActivity, FiSettings, FiLogOut, FiMenu, FiX
} from 'react-icons/fi';

const AdminLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuItems = [
    { path: '/admin', label: 'Dashboard', icon: FiHome },
    { path: '/admin/users', label: 'Users', icon: FiUsers },
    { path: '/admin/resellers', label: 'Resellers', icon: FiUserCheck },
    { path: '/admin/transactions', label: 'Transactions', icon: FiCreditCard },
    { path: '/admin/plans', label: 'Plans', icon: FiPackage },
    { path: '/admin/promos', label: 'Promo Codes', icon: FiTag },
    { path: '/admin/audit-logs', label: 'Audit Logs', icon: FiShield },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <header className="lg:hidden bg-gray-900 text-white px-4 py-3 fixed top-0 left-0 right-0 z-30">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-800 rounded-lg"
          >
            {sidebarOpen ? <FiX size={20} /> : <FiMenu size={20} />}
          </button>
          <h1 className="text-lg font-bold">Admin Panel</h1>
          <div className="w-10"></div>
        </div>
      </header>

      {/* Sidebar */}
      <aside className={`sidebar bg-gray-900 text-white ${sidebarOpen ? 'open' : ''} lg:translate-x-0`}>
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-xl font-bold">MazVal Admin</h1>
          <p className="text-sm text-gray-400">QRIS Payment Platform</p>
        </div>

        <nav className="p-4 space-y-1">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-link text-gray-300 hover:text-white hover:bg-gray-800 ${isActive(item.path) ? 'active bg-gray-800 text-white' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800">
          <div className="flex items-center gap-3 p-3">
            <img
              src={user?.avatar || `https://ui-avatars.com/api/?name=${user?.name || 'A'}`}
              alt={user?.name}
              className="w-10 h-10 rounded-full"
            />
            <div className="flex-1">
              <p className="text-sm font-medium">{user?.name || 'Admin'}</p>
              <p className="text-xs text-gray-400">Administrator</p>
            </div>
            <button
              onClick={logout}
              className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white"
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

export default AdminLayout;
