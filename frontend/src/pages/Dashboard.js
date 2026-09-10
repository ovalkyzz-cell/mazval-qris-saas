import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { FiCreditCard, FiTrendingUp, FiClock, FiCheck, FiX, FiArrowUp } from 'react-icons/fi';

const Dashboard = ({ user: propUser }) => {
  const { user: authUser } = useAuth();
  const user = propUser || authUser;
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await axios.get('/api/payments/history', { withCredentials: true });
      const transactions = res.data.data.transactions;
      
      const today = new Date().toISOString().split('T')[0];
      const todayTx = transactions.filter(t => t.created_at.startsWith(today));
      
      setStats({
        todayCount: todayTx.length,
        total: res.data.data.total,
        successful: transactions.filter(t => t.status === 'success').length,
        pending: transactions.filter(t => t.status === 'pending').length,
        failed: transactions.filter(t => t.status === 'failed').length,
        dailyLimit: user?.subscription?.daily_limit || 5,
        todayUsage: user?.todayUsage || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscription = user?.subscription;
  const todayUsage = user?.todayUsage || 0;
  const dailyLimit = subscription?.daily_limit || 5;
  const limitReached = todayUsage >= dailyLimit;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-48"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card">
              <div className="skeleton h-4 w-24 mb-2"></div>
              <div className="skeleton h-8 w-16"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-600">Selamat datang, {user?.name || 'User'}</p>
        </div>
        <Link to="/payment" className="btn btn-primary inline-flex items-center gap-2">
          <FiCreditCard size={18} />
          Buat Pembayaran
        </Link>
      </div>

      {/* Current Plan */}
      <div className="card bg-gradient-to-r from-gray-900 to-gray-800 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-300 text-sm">Plan Saat Ini</p>
            <h2 className="text-2xl font-bold mt-1">{subscription?.plan_name || 'Free'}</h2>
            {subscription?.expired_at && (
              <p className="text-gray-400 text-sm mt-2">
                Berlaku hingga: {new Date(subscription.expired_at).toLocaleDateString('id-ID')}
              </p>
            )}
          </div>
          {!subscription || subscription.plan_slug === 'free' ? (
            <Link to="/pricing" className="btn bg-white text-gray-900 hover:bg-gray-100">
              <FiArrowUp size={16} className="mr-2" />
              Upgrade
            </Link>
          ) : null}
        </div>
      </div>

      {/* Daily Limit Warning */}
      {limitReached && (
        <div className="card bg-yellow-50 border-yellow-200">
          <div className="flex items-start gap-3">
            <FiClock className="text-yellow-600 mt-0.5" size={20} />
            <div>
              <p className="font-medium text-yellow-800">Limit harian sudah tercapai</p>
              <p className="text-sm text-yellow-700 mt-1">
                Upgrade plan untuk mendapatkan kapasitas transaksi yang lebih besar.
              </p>
              <Link to="/pricing" className="btn btn-primary mt-3 text-sm">
                Upgrade Plan
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Transaksi Hari Ini</p>
              <p className="text-2xl font-bold mt-1">{todayUsage} / {dailyLimit}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <FiCreditCard className="text-blue-600" size={24} />
            </div>
          </div>
          <div className="mt-3">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min((todayUsage / dailyLimit) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Total Transaksi</p>
              <p className="text-2xl font-bold mt-1">{stats?.total || 0}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <FiTrendingUp className="text-purple-600" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Berhasil</p>
              <p className="text-2xl font-bold mt-1 text-green-600">{stats?.successful || 0}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <FiCheck className="text-green-600" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Gagal</p>
              <p className="text-2xl font-bold mt-1 text-red-600">{stats?.failed || 0}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <FiX className="text-red-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h3 className="font-semibold mb-4">Aksi Cepat</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link to="/payment" className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-center transition-colors">
            <FiCreditCard className="mx-auto text-gray-600 mb-2" size={24} />
            <span className="text-sm">Buat Pembayaran</span>
          </Link>
          <Link to="/transactions" className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-center transition-colors">
            <FiTrendingUp className="mx-auto text-gray-600 mb-2" size={24} />
            <span className="text-sm">Riwayat</span>
          </Link>
          <Link to="/chat" className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-center transition-colors">
            <FiClock className="mx-auto text-gray-600 mb-2" size={24} />
            <span className="text-sm">Chat</span>
          </Link>
          <Link to="/pricing" className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-center transition-colors">
            <FiArrowUp className="mx-auto text-gray-600 mb-2" size={24} />
            <span className="text-sm">Upgrade</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
