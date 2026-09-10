import React, { useState, useEffect } from 'react';
import axios from 'axios';

const AdminAuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => { fetchLogs(); }, [page]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/admin/audit-logs?page=${page}&limit=50`, { withCredentials: true });
      setLogs(res.data.data.logs);
      setTotal(res.data.data.total);
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  const getActionColor = (action) => {
    if (action.includes('LOGIN') || action.includes('LOGOUT')) return 'text-blue-600';
    if (action.includes('BAN') || action.includes('SECURITY')) return 'text-red-600';
    if (action.includes('CREATE') || action.includes('APPROVE')) return 'text-green-600';
    return 'text-gray-600';
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        <p className="text-gray-600">Total {total} logs</p>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th><th>IP</th></tr></thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="text-sm whitespace-nowrap">{new Date(log.created_at).toLocaleString('id-ID')}</td>
                    <td className="text-sm">{log.actor_email || 'System'}</td>
                    <td><span className={`text-sm font-medium ${getActionColor(log.action)}`}>{log.action}</span></td>
                    <td className="text-sm text-gray-600">{log.target_type} #{log.target_id || '-'}</td>
                    <td className="text-sm font-mono text-gray-500">{log.ip_address || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {Math.ceil(total / 50) > 1 && (
          <div className="flex items-center justify-between p-4 border-t">
            <p className="text-sm text-gray-600">Halaman {page} dari {Math.ceil(total / 50)}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-ghost btn-sm disabled:opacity-50">Sebelumnya</button>
              <button onClick={() => setPage(p => Math.min(Math.ceil(total / 50), p + 1))} className="btn btn-ghost btn-sm">Selanjutnya</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAuditLogs;
