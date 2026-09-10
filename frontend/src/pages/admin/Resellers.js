import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const AdminResellers = () => {
  const [resellers, setResellers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResellers();
  }, []);

  const fetchResellers = async () => {
    try {
      const res = await axios.get('/api/admin/resellers', { withCredentials: true });
      setResellers(res.data.data);
    } catch (error) {
      console.error('Error fetching resellers:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateReseller = async (resellerId, data) => {
    try {
      await axios.put(`/api/admin/resellers/${resellerId}`, data, { withCredentials: true });
      toast.success('Reseller updated');
      fetchResellers();
    } catch (error) {
      toast.error('Gagal update reseller');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-2xl font-bold">Resellers</h1>
        <p className="text-gray-600">Total {resellers.length} resellers</p>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          </div>
        ) : resellers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Belum ada reseller</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Business</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Rate Limit</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {resellers.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.business_name || '-'}</td>
                    <td className="text-sm text-gray-600">{r.email}</td>
                    <td>
                      <span className={`badge ${r.status === 'active' ? 'badge-success' : r.status === 'pending' ? 'badge-warning' : 'badge-danger'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td>{r.custom_rate_limit} RPM</td>
                    <td>
                      <div className="flex gap-1">
                        {r.status === 'pending' && (
                          <button onClick={() => updateReseller(r.id, { status: 'active' })} className="btn btn-success btn-sm">
                            Approve
                          </button>
                        )}
                        {r.status === 'active' && (
                          <button onClick={() => updateReseller(r.id, { status: 'suspended' })} className="btn btn-danger btn-sm">
                            Suspend
                          </button>
                        )}
                      </div>
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

export default AdminResellers;
