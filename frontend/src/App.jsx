import { useEffect, useMemo, useState } from 'react';

// API base URL: dùng VITE_API_URL nếu có (production), fallback về '' (dev proxy)
const API_BASE = import.meta.env.VITE_API_URL || '';

const STATUS_OPTIONS = ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'];

const STATUS_LABEL = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  shipping: 'Đang giao',
  delivered: 'Đã giao',
  cancelled: 'Đã hủy'
};

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'orders', label: 'Đơn hàng', icon: '📦' },
  { id: 'create', label: 'Tạo đơn', icon: '➕' },
  { id: 'system', label: 'Hệ thống', icon: '⚙️' }
];

const initialForm = {
  customer_name: '',
  product_name: '',
  quantity: 1,
  price: '',
  shipping_address: '',
  note: ''
};

function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(value || 0));
}

function formatDate(value) {
  return new Date(value).toLocaleString('vi-VN');
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [health, setHealth] = useState(null);
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [filters, setFilters] = useState({ search: '', status: '' });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  function showToast(msg, type = 'info') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function fetchHealth() {
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      setHealth(await res.json());
    } catch {
      setHealth(null);
    }
  }

  async function fetchOrders() {
    const query = new URLSearchParams();
    if (filters.search) query.set('search', filters.search);
    if (filters.status) query.set('status', filters.status);
    const res = await fetch(`${API_BASE}/api/orders?${query.toString()}`);
    setOrders(await res.json());
  }

  async function fetchStats() {
    const res = await fetch(`${API_BASE}/api/orders/stats`);
    setStats(await res.json());
  }

  async function loadData() {
    setLoading(true);
    try {
      await Promise.all([fetchHealth(), fetchOrders(), fetchStats()]);
    } catch {
      showToast('Không thể tải dữ liệu từ server.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    fetchOrders().catch(() => showToast('Không thể tải danh sách đơn hàng.', 'error'));
  }, [filters.search, filters.status]);

  const totalVisibleAmount = useMemo(
    () => orders.reduce((sum, o) => sum + o.total_amount, 0),
    [orders]
  );

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  async function handleCreateOrder(e) {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, quantity: Number(form.quantity), price: Number(form.price) })
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.errors?.join(', ') || data.message || 'Tạo đơn thất bại', 'error'); return; }
      setForm(initialForm);
      showToast('Tạo đơn hàng thành công.', 'success');
      setActiveTab('orders');
      await Promise.all([fetchOrders(), fetchStats()]);
    } catch {
      showToast('Lỗi kết nối server khi tạo đơn hàng.', 'error');
    }
  }

  async function handleStatusChange(orderId, nextStatus) {
    try {
      const res = await fetch(`${API_BASE}/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.message || 'Cập nhật thất bại', 'error'); return; }
      showToast(`Đơn #${orderId} → "${STATUS_LABEL[nextStatus]}"`, 'success');
      await Promise.all([fetchOrders(), fetchStats()]);
    } catch {
      showToast('Lỗi kết nối server.', 'error');
    }
  }

  async function handleDelete(orderId) {
    if (!window.confirm(`Xóa đơn hàng #${orderId}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/orders/${orderId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { showToast(data.message || 'Xóa thất bại', 'error'); return; }
      showToast(`Đã xóa đơn #${orderId}.`, 'success');
      await Promise.all([fetchOrders(), fetchStats()]);
    } catch {
      showToast('Lỗi kết nối server.', 'error');
    }
  }

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">🚚</span>
          <div>
            <div className="brand-name">OrderTrack</div>
            <div className="brand-sub">Management System</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="nav-icon">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className={`health-dot ${health?.ok ? 'online' : 'offline'}`} />
          <span>{health?.ok ? 'API Online' : 'API Offline'}</span>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        <div className="topbar">
          <div>
            <h1 className="page-title">{TABS.find(t => t.id === activeTab)?.label}</h1>
            <p className="page-sub">
              {activeTab === 'dashboard' && 'Tổng quan hệ thống và thống kê đơn hàng'}
              {activeTab === 'orders' && `${orders.length} đơn hàng • Tổng: ${formatCurrency(totalVisibleAmount)}`}
              {activeTab === 'create' && 'Điền thông tin để tạo đơn hàng mới'}
              {activeTab === 'system' && 'Thông tin kỹ thuật và trạng thái hệ thống'}
            </p>
          </div>
          <button className="refresh-btn" onClick={loadData} disabled={loading}>
            {loading ? '⏳' : '🔄'} Làm mới
          </button>
        </div>

        {toast && (
          <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
        )}

        <div className="tab-content">
          {activeTab === 'dashboard' && (
            <DashboardTab health={health} stats={stats} orders={orders} formatCurrency={formatCurrency} setActiveTab={setActiveTab} />
          )}
          {activeTab === 'orders' && (
            <OrdersTab
              orders={orders} filters={filters} setFilters={setFilters} loading={loading}
              expandedOrderId={expandedOrderId} setExpandedOrderId={setExpandedOrderId}
              onStatusChange={handleStatusChange} onDelete={handleDelete}
              formatCurrency={formatCurrency} formatDate={formatDate}
            />
          )}
          {activeTab === 'create' && (
            <CreateTab form={form} onChange={handleChange} onSubmit={handleCreateOrder} />
          )}
          {activeTab === 'system' && (
            <SystemTab health={health} formatDate={formatDate} />
          )}
        </div>
      </main>
    </div>
  );
}

/* ─── Dashboard Tab ─── */
function DashboardTab({ health, stats, orders, formatCurrency, setActiveTab }) {
  const recentOrders = orders.slice(0, 5);

  return (
    <div className="dashboard">
      {/* Stat cards */}
      <div className="stat-cards">
        <StatCard icon="📦" label="Tổng đơn hàng" value={stats?.total_orders ?? 0} color="blue" />
        <StatCard icon="⏳" label="Chờ xác nhận" value={stats?.by_status?.pending ?? 0} color="yellow" />
        <StatCard icon="🚚" label="Đang giao" value={stats?.by_status?.shipping ?? 0} color="purple" />
        <StatCard icon="✅" label="Đã giao" value={stats?.by_status?.delivered ?? 0} color="green" />
        <StatCard icon="❌" label="Đã hủy" value={stats?.by_status?.cancelled ?? 0} color="red" />
        <StatCard icon="💰" label="Doanh thu (đã giao)" value={formatCurrency(stats?.total_revenue ?? 0)} color="teal" large />
      </div>

      {/* Status breakdown */}
      <div className="dash-row">
        <div className="card">
          <h3 className="card-title">Phân bổ trạng thái</h3>
          <div className="status-bars">
            {STATUS_OPTIONS.map(s => {
              const count = stats?.by_status?.[s] ?? 0;
              const total = stats?.total_orders || 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={s} className="bar-row">
                  <span className={`status-badge status-${s}`}>{STATUS_LABEL[s]}</span>
                  <div className="bar-track">
                    <div className={`bar-fill bar-${s}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="bar-count">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent orders */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Đơn hàng gần đây</h3>
            <button className="link-btn" onClick={() => setActiveTab('orders')}>Xem tất cả →</button>
          </div>
          <div className="recent-list">
            {recentOrders.length === 0 && <p className="muted">Chưa có đơn hàng nào.</p>}
            {recentOrders.map(o => (
              <div key={o.id} className="recent-item">
                <div>
                  <div className="recent-name">{o.customer_name}</div>
                  <div className="recent-product">{o.product_name} × {o.quantity}</div>
                </div>
                <div className="recent-right">
                  <span className={`status-badge status-${o.status}`}>{STATUS_LABEL[o.status]}</span>
                  <div className="recent-amount">{formatCurrency(o.total_amount)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color, large }) {
  return (
    <div className={`stat-card stat-${color}`}>
      <div className="stat-icon">{icon}</div>
      <div>
        <div className="stat-label">{label}</div>
        <div className={`stat-value ${large ? 'stat-value-lg' : ''}`}>{value}</div>
      </div>
    </div>
  );
}

/* ─── Orders Tab ─── */
function OrdersTab({ orders, filters, setFilters, loading, expandedOrderId, setExpandedOrderId, onStatusChange, onDelete, formatCurrency, formatDate }) {
  return (
    <div className="card">
      <div className="toolbar">
        <input
          className="search-input"
          placeholder="🔍  Tìm theo khách hàng, sản phẩm..."
          value={filters.search}
          onChange={e => setFilters(p => ({ ...p, search: e.target.value }))}
        />
        <select
          value={filters.status}
          onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}
        >
          <option value="">Tất cả trạng thái</option>
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
      </div>

      {loading && <div className="loading-bar" />}

      <div className="table-wrapper">
        <table className="orders-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Khách hàng</th>
              <th>Sản phẩm</th>
              <th>SL</th>
              <th>Đơn giá</th>
              <th>Thành tiền</th>
              <th>Trạng thái</th>
              <th>Đổi trạng thái</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr><td colSpan="9" className="empty-cell">Không có đơn hàng nào.</td></tr>
            ) : (
              orders.map(order => (
                <OrderRow
                  key={order.id}
                  order={order}
                  expanded={expandedOrderId === order.id}
                  onToggle={() => setExpandedOrderId(p => p === order.id ? null : order.id)}
                  onStatusChange={onStatusChange}
                  onDelete={onDelete}
                  formatCurrency={formatCurrency}
                  formatDate={formatDate}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OrderRow({ order, expanded, onToggle, onStatusChange, onDelete, formatCurrency, formatDate }) {
  return (
    <>
      <tr className={expanded ? 'row-expanded' : ''}>
        <td><span className="order-id">#{order.id}</span></td>
        <td>
          <div className="cell-primary">{order.customer_name}</div>
          <div className="cell-sub">{order.shipping_address}</div>
        </td>
        <td>
          <div className="cell-primary">{order.product_name}</div>
          {order.note && <div className="cell-sub">📝 {order.note}</div>}
        </td>
        <td>{order.quantity}</td>
        <td>{formatCurrency(order.price)}</td>
        <td><strong>{formatCurrency(order.total_amount)}</strong></td>
        <td><span className={`status-badge status-${order.status}`}>{STATUS_LABEL[order.status]}</span></td>
        <td>
          <select
            defaultValue={order.status}
            onChange={e => onStatusChange(order.id, e.target.value)}
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </td>
        <td>
          <div className="action-group">
            <button className="btn-outline small" onClick={onToggle}>
              {expanded ? '▲ Ẩn' : '▼ Lịch sử'}
            </button>
            <button className="btn-danger small" onClick={() => onDelete(order.id)}>🗑</button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="history-row">
          <td colSpan="9">
            <div className="history-panel">
              <div className="history-meta">
                <span>🕐 Tạo lúc: {formatDate(order.created_at)}</span>
                <span>🔄 Cập nhật: {formatDate(order.updated_at)}</span>
              </div>
              <div className="history-timeline">
                {order.status_history.map((entry, i) => (
                  <div key={i} className="timeline-item">
                    <div className={`timeline-dot dot-${entry.status}`} />
                    <span className={`status-badge status-${entry.status}`}>{STATUS_LABEL[entry.status]}</span>
                    <span className="timeline-time">{formatDate(entry.changed_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ─── Create Tab ─── */
function CreateTab({ form, onChange, onSubmit }) {
  return (
    <div className="create-layout">
      <div className="card create-card">
        <h3 className="card-title">Thông tin đơn hàng</h3>
        <form className="order-form" onSubmit={onSubmit}>
          <div className="form-row">
            <label className="form-label">
              Tên khách hàng <span className="required">*</span>
              <input name="customer_name" value={form.customer_name} onChange={onChange} placeholder="Nguyễn Văn A" />
            </label>
            <label className="form-label">
              Tên sản phẩm <span className="required">*</span>
              <input name="product_name" value={form.product_name} onChange={onChange} placeholder="Giày thể thao" />
            </label>
          </div>

          <div className="form-row">
            <label className="form-label">
              Số lượng <span className="required">*</span>
              <input type="number" min="1" name="quantity" value={form.quantity} onChange={onChange} />
            </label>
            <label className="form-label">
              Đơn giá (VND) <span className="required">*</span>
              <input type="number" min="0" name="price" value={form.price} onChange={onChange} placeholder="850000" />
            </label>
          </div>

          <label className="form-label">
            Địa chỉ giao hàng <span className="required">*</span>
            <input name="shipping_address" value={form.shipping_address} onChange={onChange} placeholder="12 Lê Lợi, Quận 1, TP.HCM" />
          </label>

          <label className="form-label">
            Ghi chú
            <textarea name="note" value={form.note} onChange={onChange} placeholder="Giao giờ hành chính..." rows="3" />
          </label>

          <button className="btn-primary" type="submit">➕ Tạo đơn hàng</button>
        </form>
      </div>

      <div className="card create-hint">
        <h3 className="card-title">Hướng dẫn</h3>
        <ul className="hint-list">
          <li>Các trường có dấu <span className="required">*</span> là bắt buộc</li>
          <li>Đơn hàng mới sẽ có trạng thái <span className="status-badge status-pending">Chờ xác nhận</span></li>
          <li>Sau khi tạo, bạn có thể đổi trạng thái trong tab <strong>Đơn hàng</strong></li>
          <li>Lịch sử trạng thái được lưu tự động mỗi lần thay đổi</li>
        </ul>
      </div>
    </div>
  );
}

/* ─── System Tab ─── */
function SystemTab({ health, formatDate }) {
  const apiBase = import.meta.env.VITE_API_URL || window.location.origin;

  const endpoints = [
    { method: 'GET', path: '/api/health', desc: 'Kiểm tra trạng thái server & DB' },
    { method: 'GET', path: '/api/orders', desc: 'Lấy danh sách đơn hàng (hỗ trợ ?status= và ?search=)' },
    { method: 'GET', path: '/api/orders/stats', desc: 'Thống kê đơn hàng theo trạng thái' },
    { method: 'POST', path: '/api/orders', desc: 'Tạo đơn hàng mới' },
    { method: 'PUT', path: '/api/orders/:id/status', desc: 'Cập nhật trạng thái đơn hàng' },
    { method: 'DELETE', path: '/api/orders/:id', desc: 'Xóa đơn hàng' }
  ];

  const layers = [
    { layer: 'L4 — Frontend', desc: 'React UI, console errors, network tab', color: 'blue' },
    { layer: 'L3 — Backend', desc: 'Express API, server logs, 4xx/5xx responses', color: 'purple' },
    { layer: 'L2 — Database', desc: 'SQLite file, query errors, connection', color: 'yellow' },
    { layer: 'L1 — Infrastructure', desc: 'Docker, port binding, ENV variables', color: 'red' }
  ];

  return (
    <div className="system-layout">
      {/* Health card */}
      <div className="card">
        <h3 className="card-title">API Health Check</h3>
        <div className="health-grid">
          <div className="health-item">
            <span className="health-label">Status</span>
            <span className={`health-value ${health?.ok ? 'text-green' : 'text-red'}`}>
              {health?.ok ? '✅ Running' : '❌ Offline'}
            </span>
          </div>
          <div className="health-item">
            <span className="health-label">Database</span>
            <span className="health-value">{health?.database || '—'}</span>
          </div>
          <div className="health-item">
            <span className="health-label">Endpoint</span>
            <code className="code-pill">GET /api/health</code>
          </div>
          <div className="health-item">
            <span className="health-label">Timestamp</span>
            <span className="health-value">{health?.timestamp ? formatDate(health.timestamp) : '—'}</span>
          </div>
        </div>
      </div>

      {/* API endpoints */}
      <div className="card">
        <h3 className="card-title">API Endpoints</h3>
        <div className="endpoint-list">
          {endpoints.map((ep, i) => (
            <div key={i} className="endpoint-item">
              <span className={`method-badge method-${ep.method.toLowerCase()}`}>{ep.method}</span>
              <code className="endpoint-path">{ep.path}</code>
              <span className="endpoint-desc">{ep.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Debug layers */}
      <div className="card">
        <h3 className="card-title">Debug Layer Thinking</h3>
        <div className="layer-list">
          {layers.map((l, i) => (
            <div key={i} className={`layer-item layer-${l.color}`}>
              <strong>{l.layer}</strong>
              <span>{l.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tech stack */}
      <div className="card">
        <h3 className="card-title">Tech Stack</h3>
        <div className="tech-grid">
          {[
            { label: 'Frontend', value: 'React 19 + Vite 6' },
            { label: 'Backend', value: 'Node.js + Express 4' },
            { label: 'Database', value: 'SQLite (better-sqlite3)' },
            { label: 'Container', value: 'Docker + Compose' },
            { label: 'CI/CD', value: 'GitHub Actions' },
            { label: 'Deploy', value: 'VPS / Render / Railway' }
          ].map((t, i) => (
            <div key={i} className="tech-item">
              <span className="tech-label">{t.label}</span>
              <span className="tech-value">{t.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
