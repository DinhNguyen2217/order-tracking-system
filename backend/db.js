import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

sqlite3.verbose();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DB_PATH env: supports absolute path (Docker volume) or relative path (local dev)
const dbPath = process.env.DB_PATH
  ? path.isAbsolute(process.env.DB_PATH)
    ? process.env.DB_PATH
    : path.resolve(__dirname, process.env.DB_PATH)
  : path.join(__dirname, 'database.sqlite');

export const db = new sqlite3.Database(dbPath);

export function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) return reject(error);
      resolve({
        lastID: this.lastID,
        changes: this.changes
      });
    });
  });
}

export function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) return reject(error);
      resolve(row);
    });
  });
}

export function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) return reject(error);
      resolve(rows);
    });
  });
}

function makeHistory(status, at) {
  return JSON.stringify([
    {
      status,
      changed_at: at
    }
  ]);
}

export async function initializeDatabase() {
  await run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      price REAL NOT NULL CHECK(price >= 0),
      shipping_address TEXT NOT NULL,
      note TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      status_history TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  const row = await get(`SELECT COUNT(*) AS count FROM orders`);
  if (row.count > 0) return;

  const now = new Date().toISOString();

  const sampleOrders = [
    {
      customer_name: 'Nguyễn Văn An',
      product_name: 'Giày thể thao nam',
      quantity: 1,
      price: 950000,
      shipping_address: '12 Lê Lợi, Quận 1, TP.HCM',
      note: 'Gọi trước khi giao',
      status: 'pending'
    },
    {
      customer_name: 'Trần Thị Bình',
      product_name: 'Dép sandal nữ',
      quantity: 2,
      price: 420000,
      shipping_address: '45 Nguyễn Huệ, Quận 1, TP.HCM',
      note: '',
      status: 'shipping'
    },
    {
      customer_name: 'Lê Minh Cường',
      product_name: 'Giày chạy bộ',
      quantity: 1,
      price: 1250000,
      shipping_address: '88 Cách Mạng Tháng 8, Quận 3, TP.HCM',
      note: 'Thanh toán khi nhận hàng',
      status: 'delivered'
    }
  ];

  for (const order of sampleOrders) {
    let history = [{ status: 'pending', changed_at: now }];

    if (order.status === 'shipping') {
      history = [
        { status: 'pending', changed_at: now },
        { status: 'confirmed', changed_at: now },
        { status: 'shipping', changed_at: now }
      ];
    }

    if (order.status === 'delivered') {
      history = [
        { status: 'pending', changed_at: now },
        { status: 'confirmed', changed_at: now },
        { status: 'shipping', changed_at: now },
        { status: 'delivered', changed_at: now }
      ];
    }

    await run(
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
        order.customer_name,
        order.product_name,
        order.quantity,
        order.price,
        order.shipping_address,
        order.note,
        order.status,
        JSON.stringify(history),
        now,
        now
      ]
    );
  }
}

export function parseOrder(order) {
  return {
    ...order,
    quantity: Number(order.quantity),
    price: Number(order.price),
    total_amount: Number(order.quantity) * Number(order.price),
    status_history: JSON.parse(order.status_history || '[]')
  };
}
