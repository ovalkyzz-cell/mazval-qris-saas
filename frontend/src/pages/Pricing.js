import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { FiCheck } from 'react-icons/fi';

const Pricing = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await axios.get('/api/plans');
      setPlans(res.data.data);
    } catch (error) {
      console.error('Error fetching plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    if (price === 0) return 'Gratis';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(price);
  };

  const getBadgeClass = (badge) => {
    if (badge?.includes('POPULAR')) return 'popular';
    if (badge?.includes('BUSINESS')) return 'border-blue-500';
    if (badge?.includes('RESELLER')) return 'border-purple-500';
    return '';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <div className="skeleton h-8 w-64 mx-auto mb-4"></div>
            <div className="skeleton h-4 w-96 mx-auto"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="card">
                <div className="skeleton h-6 w-24 mb-4"></div>
                <div className="skeleton h-8 w-32 mb-4"></div>
                <div className="skeleton h-4 w-full mb-2"></div>
                <div className="skeleton h-4 w-full mb-2"></div>
                <div className="skeleton h-4 w-full mb-4"></div>
                <div className="skeleton h-10 w-full"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">Pilih Plan yang Tepat</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Mulai gratis dan upgrade sesuai kebutuhan bisnis Anda
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`pricing-card ${getBadgeClass(plan.badge)} animate-slideUp`}
              style={{ animationDelay: `${plan.display_order * 100}ms` }}
            >
              {plan.badge && (
                <div className="text-center mb-4">
                  <span className="text-sm font-semibold text-blue-600">{plan.badge}</span>
                </div>
              )}
              
              <h3 className="text-xl font-bold text-center">{plan.name}</h3>
              
              <div className="text-center py-6">
                <span className="text-3xl font-bold">{formatPrice(plan.price)}</span>
                {plan.price > 0 && (
                  <span className="text-gray-500 text-sm"> / bulan</span>
                )}
              </div>

              <p className="text-sm text-gray-600 text-center mb-6">
                {plan.marketing_text}
              </p>

              <ul className="space-y-3 mb-8">
                {plan.features?.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <FiCheck className="text-green-500 mt-0.5 flex-shrink-0" size={16} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                to="/login"
                className={`btn w-full ${
                  plan.slug === 'pro' ? 'btn-primary' : 'btn-secondary'
                }`}
              >
                {plan.price === 0 ? 'Mulai Gratis' : 'Pilih Plan'}
              </Link>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Pertanyaan Umum</h2>
          
          <div className="space-y-4">
            <div className="card">
              <h4 className="font-semibold mb-2">Apa itu QRIS?</h4>
              <p className="text-gray-600 text-sm">
                QRIS (Quick Response Indonesian Standard) adalah standar kode QR untuk pembayaran digital di Indonesia.
              </p>
            </div>
            
            <div className="card">
              <h4 className="font-semibold mb-2">Bagaimana cara kerja rate limit?</h4>
              <p className="text-gray-600 text-sm">
                Rate limit adalah batas jumlah request API yang dapat Anda lakukan per menit. Setiap plan memiliki rate limit yang berbeda.
              </p>
            </div>
            
            <div className="card">
              <h4 className="font-semibold mb-2">Bisa upgrade/downgrade kapan saja?</h4>
              <p className="text-gray-600 text-sm">
                Ya, Anda dapat mengubah plan kapan saja. Perubahan akan berlaku segera.
              </p>
            </div>

            <div className="card">
              <h4 className="font-semibold mb-2">Apa itu Reseller Access?</h4>
              <p className="text-gray-600 text-sm">
                Reseller Access memungkinkan Anda mengelola multiple customer dan bisnis Anda sendiri.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
