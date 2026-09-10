# MazVal QRIS - SaaS Payment Platform

Platform pembayaran QRIS modern, aman, dan profesional.

## Features

- **Free Plan** - 5 transaksi/hari, 5 RPM
- **Basic Plan** - Rp10.000/bulan, 30 RPM
- **Pro Plan** - Rp25.000/bulan, 120 RPM
- **Business Plan** - Rp35.000/bulan, 300 RPM
- **Reseller Access** - Rp35.000/bulan, kelola multiple customer

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL
- **Cache**: Redis
- **Frontend**: React.js, Tailwind CSS
- **Auth**: Google OAuth 2.0
- **Payment**: QRIS API (buatqris.site)

## Quick Start

### Using Docker

```bash
# Clone repository
git clone https://github.com/ovalkyzz-cell/mazval-qris-saas.git
cd mazval-qris-saas

# Copy environment file
cp backend/.env.example backend/.env

# Edit .env with your credentials
nano backend/.env

# Start services
docker-compose up -d

# Run migrations
docker-compose exec backend npm run migrate

# Seed data
docker-compose exec backend npm run seed
```

### Manual Setup

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Setup database
# Create PostgreSQL database named qris_saas

# Run migrations
cd ../backend
npm run migrate

# Seed data
npm run seed

# Start backend
npm run dev

# Start frontend (in separate terminal)
cd ../frontend
npm start
```

## Environment Variables

See `backend/.env.example` for required variables.

## API Endpoints

- `POST /api/payments/create` - Create QRIS payment
- `GET /api/payments/:id/status` - Check payment status
- `GET /api/payments/history` - Transaction history
- `GET /api/health` - Health check

## License

© Created Mazz-Vall project 2025-2026
