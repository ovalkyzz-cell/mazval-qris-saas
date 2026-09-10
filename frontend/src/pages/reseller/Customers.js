import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ResellerCustomers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await axios.get('/api/reseller/customers', { withCredentials: true });
      setCustomers(res.data.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-2xl font-bold">Customers</h1>
        <p className="text-gray-600">Total {customers.length} customers</p>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          </div>
        ) : customers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Belum ada customer</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <img
                          src={c.avatar || `https://ui-avatars.com/api/?name=${c.name || 'U'}`}
                          alt={c.name}
                          className="w-8 h-8 rounded-full"
                        />
                        <div>
                          <p className="font-medium">{c.name || '-'}</p>
                          <p className="text-sm text-gray-500">{c.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${c.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="text-sm text-gray-600">
                      {c.last_login ? new Date(c.last_login).toLocaleString('id-ID') : '-'}
                    </td>
                    <td className="text-sm text-gray-600">
                      {new Date(c.created_at).toLocaleDateString('id-ID')}
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

export default ResellerCustomers;
