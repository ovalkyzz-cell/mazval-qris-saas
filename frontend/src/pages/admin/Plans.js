import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { FiEdit2, FiSave } from 'react-icons/fi';

const AdminPlans = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({});

  useEffect(() => { fetchPlans(); }, []);

  const fetchPlans = async () => {
    try {
      const res = await axios.get('/api/admin/plans', { withCredentials: true });
      setPlans(res.data.data);
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  const updatePlan = async (planId) => {
    try {
      await axios.put(`/api/admin/plans/${planId}`, formData, { withCredentials: true });
      toast.success('Plan updated');
      setEditing(null);
      fetchPlans();
    } catch (error) { toast.error('Gagal update plan'); }
  };

  const formatCurrency = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

  return (
    <div className="space-y-6 animate-fadeIn">
      <div><h1 className="text-2xl font-bold">Plans</h1><p className="text-gray-600">Kelola subscription plans</p></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <div key={plan.id} className={`card ${plan.badge?.includes('POPULAR') ? 'border-2 border-blue-500' : ''}`}>
            {plan.badge && <p className="text-sm text-blue-600 font-semibold mb-2">{plan.badge}</p>}
            <h3 className="text-xl font-bold">{plan.name}</h3>
            {editing === plan.id ? (
              <div className="mt-4 space-y-3">
                <input type="number" placeholder="Price" value={formData.price || ''} onChange={(e) => setFormData({...formData, price: parseInt(e.target.value)})} className="input w-full" />
                <input type="number" placeholder="Daily Limit" value={formData.daily_limit || ''} onChange={(e) => setFormData({...formData, daily_limit: parseInt(e.target.value)})} className="input w-full" />
                <input type="number" placeholder="Rate Limit (RPM)" value={formData.rate_limit || ''} onChange={(e) => setFormData({...formData, rate_limit: parseInt(e.target.value)})} className="input w-full" />
                <div className="flex gap-2">
                  <button onClick={() => updatePlan(plan.id)} className="btn btn-primary btn-sm flex-1"><FiSave size={14} className="mr-1" />Save</button>
                  <button onClick={() => setEditing(null)} className="btn btn-ghost btn-sm">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                <p className="text-2xl font-bold">{formatCurrency(plan.price)}</p>
                <p className="text-sm text-gray-600">Daily: {plan.daily_limit} tx</p>
                <p className="text-sm text-gray-600">Rate: {plan.rate_limit} RPM</p>
                <button onClick={() => { setEditing(plan.id); setFormData({ price: plan.price, daily_limit: plan.daily_limit, rate_limit: plan.rate_limit }); }} className="btn btn-ghost btn-sm mt-2"><FiEdit2 size={14} className="mr-1" />Edit</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminPlans;
