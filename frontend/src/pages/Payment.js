import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { FiCopy, FiCheck, FiRefreshCw, FiExternalLink } from 'react-icons/fi';

const Payment = ({ user }) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [payment, setPayment] = useState(null);
  const [status, setStatus] = useState('pending');
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState(null);

  useEffect(() => {
    if (payment?.expired_at) {
      const interval = setInterval(() => {
        const now = new Date();
        const expired = new Date(payment.expired_at);
        const diff = Math.max(0, Math.floor((expired - now) / 1000));
        setCountdown(diff);
        
        if (diff === 0) {
          clearInterval(interval);
          setStatus('expired');
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [payment]);

  useEffect(() => {
    if (payment?.transaction_id && status === 'pending') {
      const interval = setInterval(async () => {
        try {
          const res = await axios.get(`/api/payments/${payment.transaction_id}/status`, {
            withCredentials: true
          });
          if (res.data.data.status !== 'pending') {
            setStatus(res.data.data.status);
            if (res.data.data.status === 'success') {
              toast.success('Pembayaran berhasil!');
            } else if (res.data.data.status === 'failed') {
              toast.error('Pembayaran gagal');
            }
          }
        } catch (error) {
          console.error('Status check error:', error);
        }
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [payment?.transaction_id, status]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!amount || amount <= 0) {
      toast.error('Masukkan jumlah yang valid');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/payments/create', {
        amount: parseInt(amount),
        description,
        promo_code: promoCode || undefined
      }, { withCredentials: true });

      setPayment(res.data.data);
      setStatus('pending');
      toast.success('Pembayaran berhasil dibuat');
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Gagal membuat pembayaran';
      toast.error(message);
      
      if (error.response?.data?.error?.code === 'DAILY_LIMIT_EXCEEDED') {
        toast.error('Limit harian tercapai. Upgrade plan untuk melanjutkan.');
      }
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Disalin ke clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(value);
  };

  const formatCountdown = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'success':
        return <span className="badge badge-success">✓ BERHASIL</span>;
      case 'failed':
        return <span className="badge badge-danger">GAGAL</span>;
      case 'expired':
        return <span className="badge badge-warning">KEDALUWARSA</span>;
      default:
        return <span className="badge badge-info">MENUNGGU</span>;
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-2xl font-bold">Buat Pembayaran</h1>
        <p className="text-gray-600">Buat QRIS payment baru</p>
      </div>

      {!payment ? (
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Jumlah (Rp)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input"
              placeholder="Masukkan jumlah"
              min="1000"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Deskripsi (Opsional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input"
              placeholder="Deskripsi pembayaran"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kode Promo (Opsional)
            </label>
            <input
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              className="input"
              placeholder="GOVAL-XXX-XXX"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Memproses...
              </span>
            ) : (
              'Buat Pembayaran'
            )}
          </button>
        </form>
      ) : (
        <div className="card animate-slideUp">
          <div className="text-center mb-6">
            {getStatusBadge()}
            <h2 className="text-3xl font-bold mt-4">{formatCurrency(payment.total_amount || payment.amount)}</h2>
            {payment.discount_amount > 0 && (
              <p className="text-green-600 text-sm mt-1">
                Diskon: -{formatCurrency(payment.discount_amount)}
              </p>
            )}
          </div>

          {/* QR Code */}
          <div className="qr-container mb-6">
            {payment.qr_url ? (
              <img
                src={payment.qr_url}
                alt="QRIS Payment"
                className="w-full max-w-xs mx-auto"
              />
            ) : payment.qris_image ? (
              <img
                src={payment.qris_image}
                alt="QRIS Payment"
                className="w-full max-w-xs mx-auto"
              />
            ) : (
              <div className="w-48 h-48 bg-gray-100 mx-auto flex items-center justify-center">
                <span className="text-gray-500">QR Code</span>
              </div>
            )}
          </div>

          {/* Payment Details */}
          <div className="space-y-3 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Transaction ID</span>
              <span className="font-mono">{payment.transaction_id}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Status</span>
              {getStatusBadge()}
            </div>
            {countdown !== null && countdown > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Sisa Waktu</span>
                <span className={`font-mono ${countdown < 60 ? 'text-red-600' : ''}`}>
                  {formatCountdown(countdown)}
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {payment.payment_url && (
              <a
                href={payment.payment_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary w-full flex items-center justify-center gap-2"
              >
                <FiExternalLink size={16} />
                Buka Halaman Pembayaran
              </a>
            )}

            {payment.qr_url && (
              <button
                onClick={() => copyToClipboard(payment.qr_url)}
                className="btn btn-ghost w-full flex items-center justify-center gap-2"
              >
                {copied ? <FiCheck size={16} /> : <FiCopy size={16} />}
                {copied ? 'Disalin!' : 'Salin Link QR'}
              </button>
            )}

            <button
              onClick={() => { setPayment(null); setStatus('pending'); setCountdown(null); }}
              className="btn btn-ghost w-full"
            >
              <FiRefreshCw size={16} className="mr-2" />
              Buat Pembayaran Baru
            </button>
          </div>

          {/* Status Message */}
          {status === 'success' && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
              <p className="text-green-800 font-medium">✓ Pembayaran berhasil</p>
            </div>
          )}

          {status === 'expired' && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
              <p className="text-yellow-800 font-medium">Pembayaran telah kedaluwarsa</p>
              <button
                onClick={() => { setPayment(null); setStatus('pending'); }}
                className="btn btn-primary mt-3 text-sm"
              >
                Buat Pembayaran Baru
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Payment;
