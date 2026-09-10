import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FiUsers, FiUserCheck, FiCreditCard, FiDollarSign, FiActivity, FiShield } from 'react-icons/fi';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await axios.get('/api/admin/dashboard', { withCredentials: true });
      setStats(res.data.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(value);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-48"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="card">
              <div className="skeleton h-4 w-24 mb-2"></div>
              <div className="skeleton h-8 w-16"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Users', value: stats?.totalUsers || 0, icon: FiUsers, color: 'blue' },
    { label: 'Online Users', value: stats?.onlineUsers || 0, icon: FiActivity, color: 'green' },
    { label: 'Resellers', value: stats?.totalResellers || 0, icon: FiUserCheck, color: 'purple' },
    { label: 'Transactions Today', value: stats?.transactionsToday || 0, icon: FiCreditCard, color: 'yellow' },
    { label: 'Successful', value: stats?.successfulPayments || 0, icon: FiCreditCard, color: 'green' },
    { label: 'Pending', value: stats?.pendingPayments || 0, icon: FiCreditCard, color: 'yellow' },
    { label: 'Failed', value: stats?.failedPayments || 0, icon: FiCreditCard, color: 'red' },
    { label: 'Total Revenue', value: formatCurrency(stats?.totalRevenue || 0), icon: FiDollarSign, color: 'green' },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-gray-600">Overview system</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, idx) => (
          <div key={idx} className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">{stat.label}</p>
                <p className="text-2xl font-bold mt-1">{stat.value}</p>
              </div>
              <div className={`w-12 h-12 bg-${stat.color}-100 rounded-lg flex items-center justify-center`}>
                <stat.icon className={`text-${stat.color}-600`} size={24} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold mb-4">System Info</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500">Active Subscriptions</span>
              <span className="font-medium">{stats?.activeSubscriptions || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">API Requests Today</span>
              <span className="font-medium">{stats?.apiRequestsToday || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Security Events</span>
              <span className="font-medium">{stats?.securityEvents || 0}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <a href="/admin/users" className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-center">
              <FiUsers className="mx-auto text-gray-600 mb-2" size={24} />
              <span className="text-sm">Users</span>
            </a>
            <a href="/admin/resellers" className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-center">
              <FiUserCheck className="mx-auto text-gray-600 mb-2" size={24} />
              <span className="text-sm">Resellers</span>
            </a>
            <a href="/admin/transactions" className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-center">
              <FiCreditCard className="mx-auto text-gray-600 mb-2" size={24} />
              <span className="text-sm">Transactions</span>
            </a>
            <a href="/admin/promos" className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-center">
              <FiShield className="mx-auto text-gray-600 mb-2" size={24} />
              <span className="text-sm">Promos</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
