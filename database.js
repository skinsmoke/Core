import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

let dbPromise = null;

export const getDb = () => {
  if (!dbPromise) dbPromise = SQLite.openDatabaseAsync('core.db');
  return dbPromise;
};

const formatDate = (iso) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const hashPassword = (password, salt) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, salt + password);

// ---------- INICIALIZAÇÃO ----------
export async function initDatabase() {
  const db = await getDb();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      full_name TEXT NOT NULL,
      age INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS diary_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      mood TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      text TEXT NOT NULL,
      action TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS forum_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS forum_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER,
      user_name TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cycles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Posts de exemplo (só na primeira vez)
  const row = await db.getFirstAsync('SELECT COUNT(*) AS total FROM forum_posts');
  if (row.total === 0) {
    const now = new Date().toISOString();
    const p1 = await db.runAsync(
      'INSERT INTO forum_posts (user_name, content, created_at) VALUES (?, ?, ?)',
      ['Usuário A', 'Alguém mais sente ansiedade antes de dormir? É exaustivo...', now],
    );
    await db.runAsync(
      'INSERT INTO forum_comments (post_id, user_name, text, created_at) VALUES (?, ?, ?, ?)',
      [p1.lastInsertRowId, 'Usuário B', 'Eu sinto! Tente meditar, me ajuda bastante.', now],
    );
    await db.runAsync(
      'INSERT INTO forum_comments (post_id, user_name, text, created_at) VALUES (?, ?, ?, ?)',
      [p1.lastInsertRowId, 'Usuário C', 'Obrigado pela dica, vou tentar também!', now],
    );
    await db.runAsync(
      'INSERT INTO forum_posts (user_name, content, created_at) VALUES (?, ?, ?)',
      ['Usuário D', 'Dia de muita fadiga. O autocuidado é essencial.', now],
    );
  }
}

// ---------- AUTENTICAÇÃO ----------
export async function registerUser({ email, password, fullName, age }) {
  const db = await getDb();
  const normalized = email.trim().toLowerCase();

  const existing = await db.getFirstAsync('SELECT id FROM users WHERE email = ?', [normalized]);
  if (existing) return { success: false, message: 'Este E-mail já está cadastrado.' };

  const salt = Crypto.randomUUID();
  const hash = await hashPassword(password, salt);

  const result = await db.runAsync(
    'INSERT INTO users (email, password_hash, salt, full_name, age) VALUES (?, ?, ?, ?, ?)',
    [normalized, hash, salt, fullName.trim(), parseInt(age, 10) || null],
  );

  return {
    success: true,
    message: 'Usuário cadastrado com sucesso!',
    user: { id: result.lastInsertRowId, email: normalized, fullName: fullName.trim() },
  };
}

export async function loginUser({ email, password }) {
  const db = await getDb();
  const normalized = email.trim().toLowerCase();

  const u = await db.getFirstAsync('SELECT * FROM users WHERE email = ?', [normalized]);
  if (!u) return { success: false, message: 'E-mail ou Senha inválidos.' };

  const hash = await hashPassword(password, u.salt);
  if (hash !== u.password_hash) return { success: false, message: 'E-mail ou Senha inválidos.' };

  return {
    success: true,
    message: 'Login realizado com sucesso!',
    user: { id: u.id, email: u.email, fullName: u.full_name },
  };
}

// ---------- DIÁRIO ----------
const mapDiary = (r) => ({
  id: r.id,
  mood: r.mood,
  tags: JSON.parse(r.tags),
  text: r.text,
  action: r.action,
  date: formatDate(r.created_at),
});

export async function addDiaryEntry({ userId, mood, tags, text, action }) {
  const db = await getDb();
  const createdAt = new Date().toISOString();
  const result = await db.runAsync(
    'INSERT INTO diary_entries (user_id, mood, tags, text, action, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, mood, JSON.stringify(tags), text, action, createdAt],
  );
  return mapDiary({
    id: result.lastInsertRowId,
    mood,
    tags: JSON.stringify(tags),
    text,
    action,
    created_at: createdAt,
  });
}

export async function getDiaryEntries(userId) {
  const db = await getDb();
  const rows = await db.getAllAsync(
    'SELECT * FROM diary_entries WHERE user_id = ? ORDER BY created_at DESC',
    [userId],
  );
  return rows.map(mapDiary);
}

// ---------- FÓRUM ----------
export async function getPosts() {
  const db = await getDb();
  const posts = await db.getAllAsync('SELECT * FROM forum_posts ORDER BY created_at DESC');
  const comments = await db.getAllAsync('SELECT * FROM forum_comments ORDER BY created_at ASC');

  return posts.map((p) => ({
    id: String(p.id),
    userId: p.user_id,
    user: p.user_name,
    content: p.content,
    timestamp: formatDate(p.created_at),
    comments: comments
      .filter((c) => c.post_id === p.id)
      .map((c) => ({ id: String(c.id), userId: c.user_id, user: c.user_name, text: c.text })),
  }));
}

export async function addPost({ userId, userName, content }) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO forum_posts (user_id, user_name, content, created_at) VALUES (?, ?, ?, ?)',
    [userId, userName, content.trim(), new Date().toISOString()],
  );
}

export async function addComment({ postId, userId, userName, text }) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO forum_comments (post_id, user_id, user_name, text, created_at) VALUES (?, ?, ?, ?, ?)',
    [Number(postId), userId, userName, text.trim(), new Date().toISOString()],
  );
}

// ---------- CALENDÁRIO ----------
export async function addCycle({ userId, start, end }) {
  const db = await getDb();
  const result = await db.runAsync(
    'INSERT INTO cycles (user_id, start_date, end_date) VALUES (?, ?, ?)',
    [userId, start, end],
  );
  return { id: result.lastInsertRowId, start, end };
}

export async function getCycles(userId) {
  const db = await getDb();
  const rows = await db.getAllAsync(
    'SELECT * FROM cycles WHERE user_id = ? ORDER BY start_date DESC, id DESC',
    [userId],
  );
  return rows.map((r) => ({ id: r.id, start: r.start_date, end: r.end_date }));
}

// ---------- SESSÃO ----------
export async function getUserById(id) {
  const db = await getDb();
  const u = await db.getFirstAsync('SELECT * FROM users WHERE id = ?', [id]);
  if (!u) return null;
  return { id: u.id, email: u.email, fullName: u.full_name };
}

// ---------- APAGAR / EDITAR ----------
export async function updateDiaryEntry({ id, userId, mood, tags, text }) {
  const db = await getDb();
  await db.runAsync(
    'UPDATE diary_entries SET mood = ?, tags = ?, text = ? WHERE id = ? AND user_id = ?',
    [mood, JSON.stringify(tags), text, id, userId],
  );
  const row = await db.getFirstAsync(
    'SELECT * FROM diary_entries WHERE id = ? AND user_id = ?',
    [id, userId],
  );
  return mapDiary(row);
}

export async function deleteDiaryEntry({ id, userId }) {
  const db = await getDb();
  await db.runAsync('DELETE FROM diary_entries WHERE id = ? AND user_id = ?', [id, userId]);
}

export async function deleteCycle({ id, userId }) {
  const db = await getDb();
  await db.runAsync('DELETE FROM cycles WHERE id = ? AND user_id = ?', [id, userId]);
}

export async function deletePost({ id, userId }) {
  const db = await getDb();
  // os comentários do post são apagados junto (ON DELETE CASCADE)
  await db.runAsync('DELETE FROM forum_posts WHERE id = ? AND user_id = ?', [Number(id), userId]);
}

export async function deleteComment({ id, userId }) {
  const db = await getDb();
  await db.runAsync('DELETE FROM forum_comments WHERE id = ? AND user_id = ?', [Number(id), userId]);
}