import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiUser, FiShield, FiCreditCard, FiLogOut } from 'react-icons/fi';

const Settings = ({ user: propUser }) => {
  const { user: authUser, logout } = useAuth();
  const user = propUser || authUser;

  const menuItems = [
    {
      icon: FiUser,
      label: 'Profil',
      description: 'Kelola informasi profil Anda',
      link: '/profile'
    },
    {
      icon: FiCreditCard,
      label: 'Subscription',
      description: 'Lihat dan kelola plan Anda',
      link: '/pricing'
    },
    {
      icon: FiShield,
      label: 'Keamanan',
      description: 'Pengaturan keamanan akun',
      link: '#'
    }
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-2xl font-bold">Pengaturan</h1>
        <p className="text-gray-600">Kelola akun dan preferensi Anda</p>
      </div>

      <div className="card">
        <div className="space-y-1">
          {menuItems.map((item, idx) => (
            <Link
              key={idx}
              to={item.link}
              className="flex items-center gap-4 p-4 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <item.icon size={20} className="text-gray-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{item.label}</p>
                <p className="text-sm text-gray-500">{item.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="card">
        <button
          onClick={logout}
          className="w-full flex items-center gap-4 p-4 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
            <FiLogOut size={20} />
          </div>
          <div className="text-left">
            <p className="font-medium">Logout</p>
            <p className="text-sm text-red-500">Keluar dari akun Anda</p>
          </div>
        </button>
      </div>

      <div className="text-center text-sm text-gray-500">
        <p>© Created Mazz-Vall project 2025-2026</p>
      </div>
    </div>
  );
};

export default Settings;
