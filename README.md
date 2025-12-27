# Expenses Bot

A Discord bot for tracking Stripe revenue and expenses. This bot displays your Stripe balance data, allows you to dynamically add expenses, and provides a comprehensive financial summary.

## Features

- **Balance Command** (`/balance`): View your Stripe balance including available funds, pending payouts, and recent payout history
- **Expense Management** (`/expense`): 
  - Add expenses with amount, description, and optional category
  - List all expenses
  - Remove expenses by ID
  - View total expenses and breakdown by category
- **Summary Command** (`/summary`): Complete financial overview showing payouts, expenses, revenue, and current balance

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   
   The `.env` file should contain:
   - `DISCORD_BOT_TOKEN`: Your Discord bot token
   - `DISCORD_CLIENT_ID`: Your Discord application client ID
   - `DISCORD_GUILD_ID`: Your Discord server ID (optional, for faster command registration)
   - `STRIPE_SECRET_KEY`: Your Stripe secret key
   - `DATABASE_URL`: PostgreSQL connection string

3. **Build the Project**
   ```bash
   npm run build
   ```

4. **Run the Bot**
   ```bash
   # Development mode (with auto-reload)
   npm run dev

   # Production mode
   npm start
   ```

## Commands

### `/balance`
Displays your current Stripe balance including:
- Available to pay out
- In transit payouts
- Available soon (estimated)
- Recent payout history

### `/expense add <amount> <description> [category]`
Adds a new expense to the database.
- `amount`: The expense amount (number)
- `description`: Description of the expense
- `category`: Optional category for the expense

### `/expense list [limit]`
Lists all expenses (default: 10 most recent).

### `/expense remove <id>`
Removes an expense by its ID.

### `/expense total`
Shows total expenses and breakdown by category.

### `/summary`
Provides a complete financial summary including:
- All payouts (paid and pending)
- All expenses
- Calculated revenue (payouts - expenses)
- Current available and pending balances

## Database Schema

The bot creates an `expenses` table with the following structure:
- `id`: Primary key
- `amount`: Expense amount (decimal)
- `description`: Expense description
- `category`: Optional category
- `created_by`: Discord user who created the expense
- `created_at`: Timestamp
- `updated_at`: Timestamp

## Notes

- Stripe amounts are automatically converted from cents to dollars for display
- All expenses are stored in the database and persist across bot restarts
- The bot uses the same database as your other Famestar services

