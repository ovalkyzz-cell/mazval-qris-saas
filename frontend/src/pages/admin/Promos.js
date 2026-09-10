import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { FiPlus, FiCopy, FiCheck } from 'react-icons/fi';

const AdminPromos = () => {
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [formData, setFormData] = useState({ type: 'percentage', value: '', max_usage: '', minimum_amount: '', expires_at: '' });
  const [copied, setCopied] = useState(null);

  useEffect(() => { fetchPromos(); }, []);

  const fetchPromos = async () => {
    try {
      const res = await axios.get('/api/admin/promos', { withCredentials: true });
      setPromos(res.data.data);
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  const createPromo = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/admin/promos', formData, { withCredentials: true });
      toast.success(`Promo created: ${res.data.data.code}`);
      setShowCreate(false);
      setFormData({ type: 'percentage', value: '', max_usage: '', minimum_amount: '', expires_at: '' });
      fetchPromos();
    } catch (error) { toast.error('Gagal membuat promo'); }
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    toast.success('Disalin!');
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Promo Codes</h1><p className="text-gray-600">Total {promos.length} promo</p></div>
        <button onClick={() => setShowCreate(!showCreate)} className="btn btn-primary"><FiPlus size={16} className="mr-2" />Buat Promo</button>
      </div>

      {showCreate && (
        <form onSubmit={createPromo} className="card space-y-4 animate-slideDown">
          <h3 className="font-semibold">Buat Promo Baru</h3>
          <div className="grid grid-cols-2 gap-4">
            <select value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})} className="input">
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed (Rp)</option>
            </select>
            <input type="number" placeholder="Value" value={formData.value} onChange={(e) => setFormData({...formData, value: parseInt(e.target.value)})} className="input" required />
            <input type="number" placeholder="Max Usage" value={formData.max_usage} onChange={(e) => setFormData({...formData, max_usage: parseInt(e.target.value)})} className="input" />
            <input type="number" placeholder="Min Amount" value={formData.minimum_amount} onChange={(e) => setFormData({...formData, minimum_amount: parseInt(e.target.value)})} className="input" />
            <input type="datetime-local" placeholder="Expires" value={formData.expires_at} onChange={(e) => setFormData({...formData, expires_at: e.target.value})} className="input col-span-2" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary">Create</button>
            <button type="button" onClick={() => setShowCreate(false)} className="btn btn-ghost">Cancel</button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Usage</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody>
                {promos.map((promo) => (
                  <tr key={promo.id}>
                    <td className="font-mono">{promo.code}</td>
                    <td>{promo.type === 'percentage' ? '%' : 'Rp'}</td>
                    <td>{promo.type === 'percentage' ? `${promo.value}%` : `Rp${promo.value.toLocaleString()}`}</td>
                    <td>{promo.used_count || 0} / {promo.max_usage || '∞'}</td>
                    <td><span className={`badge ${promo.status === 'active' ? 'badge-success' : promo.status === 'expired' ? 'badge-warning' : 'badge-danger'}`}>{promo.status}</span></td>
                    <td>
                      <button onClick={() => copyCode(promo.code)} className="p-2 hover:bg-gray-100 rounded-lg">
                        {copied === promo.code ? <FiCheck size={16} className="text-green-600" /> : <FiCopy size={16} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPromos;
