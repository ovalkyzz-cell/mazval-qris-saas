import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiCreditCard, FiShield, FiZap, FiGlobe } from 'react-icons/fi';

const Home = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <header className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">MazVal QRIS</h1>
          <div className="flex items-center gap-4">
            {user ? (
              <Link to="/dashboard" className="btn btn-primary">
                Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost">
                  Login
                </Link>
                <Link to="/pricing" className="btn btn-primary">
                  Mulai
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Platform Pembayaran <span className="text-blue-600">QRIS</span> Modern
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Integrasi QRIS mudah, aman, dan profesional untuk bisnis Anda.
            Mulai gratis tanpa kartu kredit.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to={user ? '/dashboard' : '/login'} className="btn btn-primary text-lg px-8 py-3">
              Mulai Sekarang
            </Link>
            <Link to="/pricing" className="btn btn-secondary text-lg px-8 py-3">
              Lihat Harga
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Mengapa Memilih MazVal?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="card text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <FiZap className="text-blue-600" size={24} />
              </div>
              <h3 className="font-semibold mb-2">Instan</h3>
              <p className="text-gray-600 text-sm">QR Code langsung jadi, pembayaran cepat dan mudah</p>
            </div>
            <div className="card text-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <FiShield className="text-green-600" size={24} />
              </div>
              <h3 className="font-semibold mb-2">Aman</h3>
              <p className="text-gray-600 text-sm">Keamanan berlapis dengan enkripsi data</p>
            </div>
            <div className="card text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <FiGlobe className="text-purple-600" size={24} />
              </div>
              <h3 className="font-semibold mb-2">Fleksibel</h3>
              <p className="text-gray-600 text-sm">API lengkap untuk integrasi dengan platform Anda</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
          <p>© Created Mazz-Vall project 2025-2026</p>
        </div>
      </footer>
    </div>
  );
};

export default Home;
