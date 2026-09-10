import React from 'react';
import { useAuth } from '../context/AuthContext';
import { FiUser, FiMail, FiCalendar } from 'react-icons/fi';

const Profile = ({ user: propUser }) => {
  const { user: authUser } = useAuth();
  const user = propUser || authUser;

  if (!user) {
    return <div className="text-center py-8">Loading...</div>;
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-2xl font-bold">Profil Saya</h1>
        <p className="text-gray-600">Kelola informasi profil Anda</p>
      </div>

      <div className="card">
        <div className="flex items-center gap-4 mb-6">
          <img
            src={user.avatar || `https://ui-avatars.com/api/?name=${user.name || 'U'}&size=80`}
            alt={user.name}
            className="w-20 h-20 rounded-full"
          />
          <div>
            <h2 className="text-xl font-semibold">{user.name || 'User'}</h2>
            <p className="text-gray-500">{user.email}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <FiUser className="text-gray-400" size={20} />
            <div>
              <p className="text-sm text-gray-500">Nama</p>
              <p className="font-medium">{user.name || '-'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <FiMail className="text-gray-400" size={20} />
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-medium">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <FiCalendar className="text-gray-400" size={20} />
            <div>
              <p className="text-sm text-gray-500">Bergabung</p>
              <p className="font-medium">{formatDate(user.created_at)}</p>
            </div>
          </div>
        </div>
      </div>

      {user.subscription && (
        <div className="card">
          <h3 className="font-semibold mb-4">Subscription</h3>
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{user.subscription.plan_name}</p>
                <p className="text-sm text-gray-500">
                  Berlaku hingga: {formatDate(user.subscription.expired_at)}
                </p>
              </div>
              <span className={`badge ${user.subscription.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                {user.subscription.status}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
