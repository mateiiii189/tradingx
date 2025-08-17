const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const db = new sqlite3.Database('./data.db');

// create users table if it doesn't exist
db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT
)`);

app.use(express.json());

const SECRET = 'change_me';

app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
  bcrypt.hash(password, 10, (err, hash) => {
    if (err) return res.status(500).json({ error: 'Hashing failed' });
    db.run('INSERT INTO users (username, password) VALUES (?,?)', [username, hash], function(err) {
      if (err) return res.status(400).json({ error: 'User exists' });
      const token = jwt.sign({ id: this.lastID, username }, SECRET);
      res.json({ token });
    });
  });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
    if (err || !row) return res.status(400).json({ error: 'Invalid credentials' });
    bcrypt.compare(password, row.password, (err, ok) => {
      if (!ok) return res.status(400).json({ error: 'Invalid credentials' });
      const token = jwt.sign({ id: row.id, username }, SECRET);
      res.json({ token });
    });
  });
});

app.listen(3001, () => console.log('API server running on 3001'));
