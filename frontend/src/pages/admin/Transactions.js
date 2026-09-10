import React, { useState, useEffect } from 'react';
import axios from 'axios';

const AdminTransactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('');

  useEffect(() => { fetchTransactions(); }, [page, filter]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/admin/transactions?page=${page}&limit=20&status=${filter}`, { withCredentials: true });
      setTransactions(res.data.data.transactions);
      setTotal(res.data.data.total);
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  const formatCurrency = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);
  const getStatusBadge = (s) => {
    const colors = { success: 'badge-success', failed: 'badge-danger', pending: 'badge-info', expired: 'badge-warning' };
    return <span className={`badge ${colors[s] || 'badge-info'}`}>{s}</span>;
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-gray-600">Total {total} transaksi</p>
        </div>
        <select value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }} className="input w-40">
          <option value="">Semua</option>
          <option value="pending">Pending</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>ID</th><th>User</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="font-mono text-sm">#{tx.id}</td>
                    <td className="text-sm">{tx.user_email || '-'}</td>
                    <td>{formatCurrency(tx.amount)}</td>
                    <td>{getStatusBadge(tx.status)}</td>
                    <td className="text-sm text-gray-600">{new Date(tx.created_at).toLocaleString('id-ID')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {Math.ceil(total / 20) > 1 && (
          <div className="flex items-center justify-between p-4 border-t">
            <p className="text-sm text-gray-600">Halaman {page} dari {Math.ceil(total / 20)}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-ghost btn-sm disabled:opacity-50">Sebelumnya</button>
              <button onClick={() => setPage(p => Math.min(Math.ceil(total / 20), p + 1))} className="btn btn-ghost btn-sm">Selanjutnya</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminTransactions;
