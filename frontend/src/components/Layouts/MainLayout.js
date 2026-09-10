import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  FiHome, FiCreditCard, FiMessageSquare, FiUser, FiSettings, 
  FiLogOut, FiMenu, FiX, FiChevronDown, FiTrendingUp
} from 'react-icons/fi';

const MainLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const menuItems = [
    { path: '/dashboard', label: 'Dashboard', icon: FiHome },
    { path: '/payment', label: 'Buat Pembayaran', icon: FiCreditCard },
    { path: '/transactions', label: 'Transaksi', icon: FiTrendingUp },
    { path: '/chat', label: 'Chat', icon: FiMessageSquare },
    { path: '/profile', label: 'Profil', icon: FiUser },
    { path: '/settings', label: 'Pengaturan', icon: FiSettings },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 fixed top-0 left-0 right-0 z-30">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            {sidebarOpen ? <FiX size={20} /> : <FiMenu size={20} />}
          </button>
          <h1 className="text-lg font-bold">MazVal QRIS</h1>
          <div className="w-10"></div>
        </div>
      </header>

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''} lg:translate-x-0`}>
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold">MazVal QRIS</h1>
          <p className="text-sm text-gray-500">Payment Platform</p>
        </div>

        <nav className="p-4 space-y-1">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-link ${isActive(item.path) ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg"
            >
              <img
                src={user?.avatar || `https://ui-avatars.com/api/?name=${user?.name || 'U'}`}
                alt={user?.name}
                className="w-10 h-10 rounded-full"
              />
              <div className="flex-1 text-left">
                <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
              <FiChevronDown size={16} className="text-gray-400" />
            </button>

            {userMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                <Link
                  to="/profile"
                  className="block px-4 py-3 hover:bg-gray-50 text-sm"
                  onClick={() => setUserMenuOpen(false)}
                >
                  Profil Saya
                </Link>
                <Link
                  to="/pricing"
                  className="block px-4 py-3 hover:bg-gray-50 text-sm"
                  onClick={() => setUserMenuOpen(false)}
                >
                  Upgrade Plan
                </Link>
                <hr className="border-gray-200" />
                <button
                  onClick={() => { logout(); setUserMenuOpen(false); }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm text-red-600 flex items-center gap-2"
                >
                  <FiLogOut size={16} />
                  Logout
                </button>
              </div>
            )}
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

export default MainLayout;
