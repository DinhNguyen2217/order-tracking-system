import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { all, get, initializeDatabase, parseOrder, run } from './db.js';

const app = express();
const PORT = process.env.PORT || 5000;
const VALID_STATUSES = ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDist = path.resolve(__dirname, '../frontend/dist');

app.use(cors());
app.use(express.json());

function validateOrderInput(body) {
  const errors = [];

  if (!body.customer_name || !String(body.customer_name).trim()) {
    errors.push('customer_name is required');
  }

  if (!body.product_name || !String(body.product_name).trim()) {
    errors.push('product_name is required');
  }

  if (!body.shipping_address || !String(body.shipping_address).trim()) {
    errors.push('shipping_address is required');
  }

  if (body.quantity === undefined || Number(body.quantity) <= 0) {
    errors.push('quantity must be greater than 0');
  }

  if (body.price === undefined || Number(body.price) < 0) {
    errors.push('price must be greater than or equal to 0');
  }

  return errors;
}

app.get('/api/health', async (req, res) => {
  const dbCheck = await get('SELECT 1 AS ok');
  res.json({
    ok: true,
    message: 'Order Tracking API is running',
    database: dbCheck?.ok === 1 ? 'connected' : 'unknown',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/orders', async (req, res) => {
  try {
    const { status = '', search = '' } = req.query;

    const conditions = [];
    const params = [];

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (search) {
      conditions.push(`
        (
          customer_name LIKE ?
          OR product_name LIKE ?
          OR shipping_address LIKE ?
          OR note LIKE ?
        )
      `);
      const keyword = `%${search}%`;
      params.push(keyword, keyword, keyword, keyword);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await all(
      `
      SELECT *
      FROM orders
      ${whereClause}
      ORDER BY id DESC
      `,
      params
    );

    res.json(rows.map(parseOrder));
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch orders', error: error.message });
  }
});

app.get('/api/orders/stats', async (req, res) => {
  try {
    const rows = await all(`
      SELECT status, COUNT(*) AS count
      FROM orders
      GROUP BY status
    `);

    const totalRow = await get(`SELECT COUNT(*) AS total_orders FROM orders`);
    const revenueRow = await get(`
      SELECT COALESCE(SUM(quantity * price), 0) AS total_revenue
      FROM orders
      WHERE status = 'delivered'
    `);

    const stats = {
      total_orders: totalRow.total_orders,
      total_revenue: Number(revenueRow.total_revenue || 0),
      by_status: {
        pending: 0,
        confirmed: 0,
        shipping: 0,
        delivered: 0,
        cancelled: 0
      }
    };

    for (const row of rows) {
      stats.by_status[row.status] = Number(row.count);
    }

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch stats', error: error.message });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const errors = validateOrderInput(req.body);
    if (errors.length) {
      return res.status(400).json({ message: 'Validation failed', errors });
    }

    const now = new Date().toISOString();
    const status = 'pending';
    const statusHistory = JSON.stringify([
      {
        status,
        changed_at: now
      }
    ]);

    const result = await run(
      `
      INSERT INTO orders (
        customer_name,
        product_name,
        quantity,
        price,
        shipping_address,
        note,
        status,
        status_history,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        String(req.body.customer_name).trim(),
        String(req.body.product_name).trim(),
        Number(req.body.quantity),
        Number(req.body.price),
        String(req.body.shipping_address).trim(),
        String(req.body.note || '').trim(),
        status,
        statusHistory,
        now,
        now
      ]
    );

    const createdOrder = await get(`SELECT * FROM orders WHERE id = ?`, [result.lastID]);
    res.status(201).json(parseOrder(createdOrder));
  } catch (error) {
    res.status(500).json({ message: 'Failed to create order', error: error.message });
  }
});

app.put('/api/orders/:id/status', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        message: 'Invalid status',
        valid_statuses: VALID_STATUSES
      });
    }

    const existingOrder = await get(`SELECT * FROM orders WHERE id = ?`, [id]);
    if (!existingOrder) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const now = new Date().toISOString();
    const history = JSON.parse(existingOrder.status_history || '[]');

    history.push({
      status,
      changed_at: now
    });

    await run(
      `
      UPDATE orders
      SET status = ?, status_history = ?, updated_at = ?
      WHERE id = ?
      `,
      [status, JSON.stringify(history), now, id]
    );

    const updatedOrder = await get(`SELECT * FROM orders WHERE id = ?`, [id]);
    res.json(parseOrder(updatedOrder));
  } catch (error) {
    res.status(500).json({ message: 'Failed to update status', error: error.message });
  }
});

app.delete('/api/orders/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existingOrder = await get(`SELECT * FROM orders WHERE id = ?`, [id]);

    if (!existingOrder) {
      return res.status(404).json({ message: 'Order not found' });
    }

    await run(`DELETE FROM orders WHERE id = ?`, [id]);
    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete order', error: error.message });
  }
});

app.use(express.static(frontendDist));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(frontendDist, 'index.html'), (error) => {
    if (error) {
      res.status(404).json({
        message: 'Frontend build not found. Run "npm run build" first for production mode.'
      });
    }
  });
});

initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });
