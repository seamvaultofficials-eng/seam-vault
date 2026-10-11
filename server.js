const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const MASTER_ADMIN_EMAIL = 'Seamvaultofficials@gmail.com';

async function checkMasterAdmin(client, email) {
  if (email.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase()) {
    await client.query('UPDATE users SET is_admin = TRUE WHERE email = $1', [email]);
  }
}

app.post('/api/signup', async (req, res) => {
  const { email, password, referral_code_used } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

  try {
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);
    const referral_code = 'SEAM-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const is_admin = email.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, referral_code, referred_by, is_admin) 
       VALUES ($1, $2, $3, $4, $5) RETURNING email, referral_code, savings_balance, shares_balance, is_admin`,
      [email, password_hash, referral_code, referral_code_used || null, is_admin]
    );

    res.json({ message: 'Account created successfully', user: result.rows[0] });
  } catch (err) {
    res.status(400).json({ error: 'Email already registered or invalid input.' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) return res.status(400).json({ error: 'User not found.' });

    const user = userResult.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) return res.status(400).json({ error: 'Invalid password.' });

    await checkMasterAdmin(pool, email);

    res.json({
      message: 'Login successful',
      user: {
        email: user.email,
        savings_balance: user.savings_balance,
        shares_balance: user.shares_balance,
        referral_code: user.referral_code,
        is_admin: user.email.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase()
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/update-password', async (req, res) => {
  const { email, current_password, new_password } = req.body;
  try {
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) return res.status(400).json({ error: 'User not found.' });

    const user = userResult.rows[0];
    const validPassword = await bcrypt.compare(current_password, user.password_hash);
    if (!validPassword) return res.status(400).json({ error: 'Current password is incorrect.' });

    const salt = await bcrypt.genSalt(10);
    const new_hash = await bcrypt.hash(new_password, salt);

    await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [new_hash, email]);
    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/deposit', async (req, res) => {
  const { email, gateway, amount, sender_account, account_title, transaction_id } = req.body;
  try {
    const pendingCheck = await pool.query(
      "SELECT * FROM transactions WHERE user_email = $1 AND type = 'deposit' AND status = 'Pending'",
      [email]
    );
    if (pendingCheck.rows.length > 0) {
      return res.status(400).json({ error: 'You already have a pending deposit request.' });
    }

    await pool.query(
      `INSERT INTO transactions (user_email, type, gateway, amount, sender_account, account_title, transaction_id, status)
       VALUES ($1, 'deposit', $2, $3, $4, $5, $6, 'Pending')`,
      [email, gateway, amount, sender_account, account_title, transaction_id]
    );

    res.json({ message: 'Deposit request submitted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/transaction', async (req, res) => {
  const { transaction_id, status } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const txResult = await client.query('SELECT * FROM transactions WHERE id = $1', [transaction_id]);
    if (txResult.rows.length === 0) throw new Error('Transaction not found.');
    const tx = txResult.rows[0];

    if (tx.status !== 'Pending') throw new Error('Transaction is already processed.');

    if (status === 'Approved') {
      if (tx.type === 'deposit') {
        await client.query('UPDATE users SET savings_balance = savings_balance + $1, has_deposited = TRUE WHERE email = $2', [tx.amount, tx.user_email]);
        
        await client.query(
          'INSERT INTO notifications (user_email, title, message) VALUES ($1, $2, $3)',
          [tx.user_email, 'Deposit Approved', `Your deposit of PKR ${tx.amount} via ${tx.gateway} has been approved and credited.`]
        );

        const userRes = await client.query('SELECT referred_by FROM users WHERE email = $1', [tx.user_email]);
        const referrerCode = userRes.rows[0]?.referred_by;
        if (referrerCode) {
          const refUserRes = await client.query('SELECT email FROM users WHERE referral_code = $1', [referrerCode]);
          const referrerEmail = refUserRes.rows[0]?.email;
          if (referrerEmail) {
            const bonusSetting = await client.query("SELECT value FROM platform_settings WHERE key = 'referral_bonus'");
            const bonusAmount = parseFloat(bonusSetting.rows[0]?.value || 300);
            
            await client.query('UPDATE users SET savings_balance = savings_balance + $1 WHERE email = $2', [bonusAmount, referrerEmail]);
            await client.query(
              'INSERT INTO notifications (user_email, title, message) VALUES ($1, $2, $3)',
              [referrerEmail, 'Referral Bonus Credited', `You earned PKR ${bonusAmount} from a referral deposit.`]
            );
          }
        }
      } else if (tx.type === 'withdrawal') {
        await client.query('UPDATE users SET savings_balance = savings_balance - $1 WHERE email = $2', [tx.amount, tx.user_email]);
        await client.query(
          'INSERT INTO notifications (user_email, title, message) VALUES ($1, $2, $3)',
          [tx.user_email, 'Withdrawal Approved', `Your withdrawal of PKR ${tx.amount} has been processed.`]
        );
      }
    } else {
      await client.query(
        'INSERT INTO notifications (user_email, title, message) VALUES ($1, $2, $3)',
        [tx.user_email, 'Request Rejected', `Your ${tx.type} request of PKR ${tx.amount} was rejected.`]
      );
    }

    await client.query('UPDATE transactions SET status = $1 WHERE id = $2', [status, transaction_id]);
    await client.query('COMMIT');
    res.json({ message: `Transaction ${status.toLowerCase()} successfully.` });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.get('/api/notifications/:email', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM notifications WHERE user_email = $1 ORDER BY created_at DESC LIMIT 20', [req.params.email]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Seam Vault backend running on port ${PORT}`);
});
