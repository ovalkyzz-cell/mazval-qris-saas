import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { FiSearch, FiBan, FiCheck, FiUserX, FiUserCheck } from 'react-icons/fi';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  useEffect(() => {
    fetchUsers();
  }, [page, search]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/admin/users?page=${page}&limit=${limit}&search=${search}`, {
        withCredentials: true
      });
      setUsers(res.data.data.users);
      setTotal(res.data.data.total);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (userId, status) => {
    try {
      await axios.put(`/api/admin/users/${userId}/status`, { status }, {
        withCredentials: true
      });
      toast.success(`User ${status}`);
      fetchUsers();
    } catch (error) {
      toast.error('Gagal update status');
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-gray-600">Total {total} users</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Cari user..."
              className="input pl-10 w-64"
            />
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <img
                          src={user.avatar || `https://ui-avatars.com/api/?name=${user.name || 'U'}`}
                          alt={user.name}
                          className="w-8 h-8 rounded-full"
                        />
                        <div>
                          <p className="font-medium">{user.name || '-'}</p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${user.role_name === 'ADMIN' ? 'badge-danger' : user.role_name === 'RESELLER' ? 'badge-info' : 'badge-success'}`}>
                        {user.role_name}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${user.status === 'active' ? 'badge-success' : user.status === 'banned' ? 'badge-danger' : 'badge-warning'}`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="text-sm text-gray-600">
                      {user.last_login ? new Date(user.last_login).toLocaleString('id-ID') : '-'}
                    </td>
                    <td>
                      <div className="flex gap-1">
                        {user.status === 'active' ? (
                          <button
                            onClick={() => updateStatus(user.id, 'banned')}
                            className="p-2 hover:bg-red-100 rounded-lg text-red-600"
                            title="Ban"
                          >
                            <FiBan size={16} />
                          </button>
                        ) : (
                          <button
                            onClick={() => updateStatus(user.id, 'active')}
                            className="p-2 hover:bg-green-100 rounded-lg text-green-600"
                            title="Activate"
                          >
                            <FiCheck size={16} />
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

        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t">
            <p className="text-sm text-gray-600">Halaman {page} dari {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-ghost btn-sm disabled:opacity-50">
                Sebelumnya
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn btn-ghost btn-sm disabled:opacity-50">
                Selanjutnya
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUsers;
