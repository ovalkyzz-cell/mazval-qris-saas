import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FiUsers, FiCreditCard, FiTrendingUp } from 'react-icons/fi';

const ResellerDashboard = () => {
  const [stats, setStats] = useState({ customers: 0, transactions: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await axios.get('/api/reseller/customers', { withCredentials: true });
      setStats({ customers: res.data.data.length, transactions: 0 });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-2xl font-bold">Reseller Dashboard</h1>
        <p className="text-gray-600">Overview bisnis Anda</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Total Customers</p>
              <p className="text-2xl font-bold mt-1">{stats.customers}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <FiUsers className="text-blue-600" size={24} />
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Total Transactions</p>
              <p className="text-2xl font-bold mt-1">{stats.transactions}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <FiCreditCard className="text-green-600" size={24} />
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Revenue</p>
              <p className="text-2xl font-bold mt-1">Rp0</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <FiTrendingUp className="text-purple-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3">
          <a href="/reseller/customers" className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-center">
            <FiUsers className="mx-auto text-gray-600 mb-2" size={24} />
            <span className="text-sm">Manage Customers</span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default ResellerDashboard;
