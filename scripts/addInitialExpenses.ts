import 'dotenv/config';
import { addExpense, getPool } from '../src/database';

const expenses = [
  { amount: 20, category: 'Dripfeed' },      // Oldest
  { amount: 20, category: 'Dripfeed' },
  { amount: 40, category: 'Tiktok Ads' },
  { amount: 20, category: 'Dripfeed' },
  { amount: 20, category: 'Dripfeed' },
  { amount: 20, category: 'Dripfeed' },
  { amount: 20, category: 'Dripfeed' },
  { amount: 50, category: 'Dripfeed' },
  { amount: 50, category: 'Dripfeed' },
  { amount: 50, category: 'Dripfeed' },     // Newest
];

async function addInitialExpenses() {
  try {
    console.log('🔄 Adding initial expenses...');
    
    // Make sure database is initialized
    const pool = getPool();
    await pool.query('SELECT 1');
    console.log('✅ Database connected');

    // Add expenses with delays to ensure proper ordering (oldest to newest)
    for (let i = 0; i < expenses.length; i++) {
      const expense = expenses[i];
      
      // Add a small delay between expenses to ensure proper timestamp ordering
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const result = await addExpense({
        amount: expense.amount,
        category: expense.category,
        createdBy: 'System (Initial Import)',
      });
      
      console.log(`✅ Added: -$${expense.amount.toFixed(2)} ${expense.category} (ID: #${result.id})`);
    }

    console.log(`\n✅ Successfully added ${expenses.length} expenses!`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding expenses:', error);
    process.exit(1);
  }
}

addInitialExpenses();

