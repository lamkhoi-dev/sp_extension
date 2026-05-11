# AffiliateHub - Admin Dashboard

Modern admin dashboard cho quản lý Affiliate Marketing (Shopee & TikTok), Zalo Bot và hoàn 50% hoa hồng cho referrer.

## 🚀 Tech Stack

- **React 19** + **Vite 8** - Fast development & build
- **Tailwind CSS v4** - Utility-first CSS framework
- **React Router v7** - Client-side routing
- **Recharts** - Beautiful charts
- **Framer Motion** - Smooth animations
- **Lucide React** - Modern icons

## 📁 Cấu trúc thư mục

```
src/
├── components/
│   ├── charts/          # Chart components (CommissionChart, PieChart, etc.)
│   ├── layout/          # Layout components (Sidebar, Header, MainLayout)
│   └── ui/              # Reusable UI components (Button, Card, Modal, etc.)
├── context/
│   └── ThemeContext.jsx # Dark/Light mode context
├── data/
│   └── dummyData.js     # Mock data for demo
├── pages/
│   ├── Login.jsx        # Login page
│   ├── Dashboard.jsx    # Dashboard overview
│   ├── Users.jsx        # User/Referrer management
│   ├── ConvertLogs.jsx  # Convert link history
│   ├── Orders.jsx       # Orders & Commission
│   ├── Payouts.jsx      # Payout management
│   └── Reports.jsx      # Reports & Analytics
├── App.jsx              # Main app with routing
├── main.jsx             # Entry point
└── index.css            # Global styles & Tailwind config
```

## 🎨 Features

### Pages
1. **Login Page** (`/login`) - Modern login với Google OAuth option
2. **Dashboard** (`/`) - KPI cards, charts, top referrers, notifications
3. **Quản lý User** (`/users`) - CRUD users với data table
4. **Lịch sử Convert** (`/convert-logs`) - Log convert link affiliate
5. **Đơn hàng** (`/orders`) - Quản lý orders từ Shopee/TikTok
6. **Hoàn tiền** (`/payouts`) - Quản lý payout 50% cho users
7. **Báo cáo** (`/reports`) - Analytics & export

### UI/UX
- ✅ Dark mode mặc định + Light mode toggle
- ✅ Responsive design (mobile, tablet, desktop)
- ✅ Collapsible sidebar
- ✅ Glassmorphism effects
- ✅ Smooth animations
- ✅ Modern gradient colors (Blue #3B82F6 + Purple #8B5CF6)

## 🛠️ Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🌐 Routes

| Route | Page | Description |
|-------|------|-------------|
| `/login` | Login | Trang đăng nhập |
| `/` | Dashboard | Tổng quan hệ thống |
| `/users` | Users | Quản lý user/referrer |
| `/convert-logs` | Convert Logs | Lịch sử convert link |
| `/orders` | Orders | Đơn hàng & commission |
| `/payouts` | Payouts | Hoàn tiền cho user |
| `/reports` | Reports | Báo cáo & analytics |

## 📊 Demo Data

Project sử dụng dummy data trong `src/data/dummyData.js` để demo:
- 8 users với thông tin commission
- 10 orders từ Shopee/TikTok
- 8 convert logs
- 5 payout records
- Chart data cho 7/30 ngày

## 🎯 Color Palette

- **Primary**: Blue (#3B82F6)
- **Accent**: Purple (#8B5CF6)
- **Background Dark**: #0F172A / #020617
- **Shopee**: #EE4D2D
- **TikTok**: #00F2EA

## 📝 License

MIT License
