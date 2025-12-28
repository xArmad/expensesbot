import { Pool } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    let connectionString = process.env.DATABASE_URL || '';
    
    if (!connectionString) {
      throw new Error('DATABASE_URL is not defined');
    }

    const sslConfig = { rejectUnauthorized: false };
    
    try {
      if (connectionString.includes('://')) {
        const url = new URL(connectionString);
        if (url.searchParams.has('sslmode') || url.searchParams.has('ssl')) {
          console.warn('Removing SSL parameters from connection string');
          url.searchParams.delete('sslmode');
          url.searchParams.delete('ssl');
          connectionString = url.toString();
        }
      }
    } catch (e) {
      // Ignore URL parsing errors
    }
    
    pool = new Pool({
      connectionString: connectionString,
      ssl: sslConfig,
      max: 5,
      idleTimeoutMillis: 30000,
    });
    
    pool.on('error', (err) => {
      console.error('Unexpected database pool error:', err);
    });
  }
  return pool;
}

export async function initializeDatabase(): Promise<void> {
  const db = getPool();
  
  try {
    // Create expenses table
    await db.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        amount DECIMAL(10, 2) NOT NULL,
        category VARCHAR(100),
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Remove description column if it exists (migration)
    try {
      await db.query(`
        ALTER TABLE expenses 
        DROP COLUMN IF EXISTS description;
      `);
      console.log('✅ Migration: description column removed/verified');
    } catch (error) {
      console.error('Error removing description column:', error);
    }

    // Create index for faster lookups
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_expenses_created_at 
      ON expenses(created_at DESC);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_expenses_category 
      ON expenses(category);
    `);

    console.log('✅ Expenses database tables created/verified');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  }
}

export interface Expense {
  id: number;
  amount: number;
  category: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export async function addExpense(data: {
  amount: number;
  category?: string;
  createdBy?: string;
}): Promise<Expense> {
  const db = getPool();
  const result = await db.query(
    `INSERT INTO expenses (amount, category, created_by)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [data.amount, data.category || null, data.createdBy || null]
  );
  const row = result.rows[0];
  return {
    ...row,
    amount: parseFloat(row.amount) || 0,
  };
}

export async function getExpenses(limit?: number): Promise<Expense[]> {
  const db = getPool();
  const query = limit
    ? 'SELECT * FROM expenses ORDER BY created_at DESC LIMIT $1'
    : 'SELECT * FROM expenses ORDER BY created_at DESC';
  const result = limit
    ? await db.query(query, [limit])
    : await db.query(query);
  return result.rows.map(row => ({
    ...row,
    amount: parseFloat(row.amount) || 0,
  }));
}

export async function getExpenseById(id: number): Promise<Expense | null> {
  const db = getPool();
  const result = await db.query('SELECT * FROM expenses WHERE id = $1', [id]);
  if (!result.rows[0]) return null;
  const row = result.rows[0];
  return {
    ...row,
    amount: parseFloat(row.amount) || 0,
  };
}

export async function deleteExpense(id: number): Promise<boolean> {
  const db = getPool();
  const result = await db.query('DELETE FROM expenses WHERE id = $1 RETURNING id', [id]);
  return result.rows.length > 0;
}

export async function getTotalExpenses(): Promise<number> {
  const db = getPool();
  const result = await db.query('SELECT COALESCE(SUM(amount), 0) as total FROM expenses');
  return parseFloat(result.rows[0].total) || 0;
}

export async function getExpensesByCategory(): Promise<{ category: string | null; total: number }[]> {
  const db = getPool();
  const result = await db.query(
    `SELECT category, COALESCE(SUM(amount), 0) as total 
     FROM expenses 
     GROUP BY category 
     ORDER BY total DESC`
  );
  return result.rows.map(row => ({
    category: row.category,
    total: parseFloat(row.total) || 0,
  }));
}

export async function getAllCategories(): Promise<string[]> {
  const db = getPool();
  const result = await db.query(
    `SELECT DISTINCT category 
     FROM expenses 
     WHERE category IS NOT NULL 
     ORDER BY category`
  );
  return result.rows.map(row => row.category).filter(Boolean);
}

export async function getTodayExpenses(): Promise<number> {
  const db = getPool();
  const result = await db.query(
    `SELECT COALESCE(SUM(amount), 0) as total 
     FROM expenses 
     WHERE DATE(created_at) = CURRENT_DATE`
  );
  return parseFloat(result.rows[0].total) || 0;
}

