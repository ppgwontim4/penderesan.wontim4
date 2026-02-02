const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const session = require('express-session');
const app = express();
const db = new sqlite3.Database('./penderesan.db');

app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'penderesan-rahasia-77',
    resave: false,
    saveUninitialized: true
}));

// CSS Template untuk Admin & Dashboard
const sharedStyle = `
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f0f2f5; margin: 0; }
        header { background: #008080; color: white; padding: 20px 20px; text-align: center; position: relative; }
        .nav { position: absolute; top: 15px; right: 20px; display: flex; gap: 10px; align-items: center; }
        .nav span { font-size: 14px; opacity: 0.9; }
        .nav a { color: white; text-decoration: none; background: rgba(0,0,0,0.2); padding: 6px 12px; border-radius: 5px; font-size: 12px; transition: 0.3s; }
        .nav a:hover { background: rgba(0,0,0,0.4); }
        
        .container { max-width: 1100px; margin: 40px auto 60px; display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 30px; padding: 0 20px; }
        
        .announcement-box { max-width: 1060px; margin: 20px auto -10px; padding: 20px; background: #fff3cd; border-left: 6px solid #ffc107; border-radius: 10px; color: #856404; font-size: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }

        .card { background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); transition: 0.3s; position: relative; }
        .card:hover { transform: translateY(-8px); box-shadow: 0 15px 35px rgba(0,0,0,0.1); }
        .card.locked { opacity: 0.7; filter: grayscale(0.8); }
        .card img { width: 100%; height: 200px; object-fit: cover; }
        .card-body { padding: 20px; }
        .card-body h3 { margin: 0 0 10px 0; font-size: 18px; color: #333; height: 50px; overflow: hidden; }
        
        .stats-label { font-size: 12px; color: #666; background: #f8f9fa; padding: 4px 8px; border-radius: 4px; display: inline-block; margin-bottom: 15px; }
        .badge { font-size: 11px; font-weight: bold; padding: 6px 12px; border-radius: 20px; text-transform: uppercase; display: inline-block; margin-bottom: 10px; }
        .badge-ready { background: #e7f9ee; color: #2ecc71; }
        .badge-locked { background: #fff5f5; color: #ff4757; }
        
        .btn-play { display: block; text-align: center; background: #008080; color: white; text-decoration: none; padding: 12px; border-radius: 10px; font-weight: bold; transition: 0.3s; }
        .btn-play:hover { background: #006666; }

        .admin-panel { background: white; max-width: 900px; margin: 40px auto; padding: 30px; border-radius: 15px; box-shadow: 0 5px 20px rgba(0,0,0,0.05); }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background: #008080; color: white; padding: 12px; text-align: left; }
        td { padding: 12px; border-bottom: 1px solid #eee; }
        .btn-action { padding: 6px 12px; border-radius: 5px; text-decoration: none; font-size: 12px; color: white; border: none; cursor: pointer; }
    </style>
`;

// ==========================================
// 1. DATABASE SETUP
// ==========================================
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT, role TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS akses (user_id TEXT, video_id INTEGER, last_access DATETIME, PRIMARY KEY (user_id, video_id))`);
    db.run(`CREATE TABLE IF NOT EXISTS materi (id INTEGER PRIMARY KEY AUTOINCREMENT, judul TEXT, ytId TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS pengumuman (id INTEGER PRIMARY KEY, isi TEXT, tanggal DATETIME)`);
    
    db.run("INSERT OR IGNORE INTO users VALUES ('admin', 'admin123', 'ADMIN')");
});

// ==========================================
// 2. DASHBOARD & STATISTIK
// ==========================================
app.get('/', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const user = req.session.user;
    const sekarang = new Date();

    db.all("SELECT * FROM pengumuman WHERE id = 1", [], (err, info) => {
        db.all("SELECT * FROM materi", [], (err, daftarMateri) => {
            db.all("SELECT video_id, COUNT(*) as total FROM akses GROUP BY video_id", [], (err, stats) => {
                db.all("SELECT video_id, last_access FROM akses WHERE user_id = ?", [user.username], (err, userAkses) => {
                    
                    let pengumumanHtml = (info && info.length > 0) ? `<div class="announcement-box"><b>📢 INFO:</b> ${info[0].isi}</div>` : "";
                    
                    let listMateri = "";
                    daftarMateri.forEach(m => {
                        const logAkses = userAkses ? userAkses.find(r => r.video_id === m.id) : null;
                        const totalDeres = stats ? stats.find(s => s.video_id === m.id) : { total: 0 };
                        let statusBadge = `<span class="badge badge-ready">Siap Dideres</span>`;
                        let isLocked = false;

                        if (logAkses && user.role === 'MUBALIG') {
                            const selisihJam = (sekarang - new Date(logAkses.last_access)) / (1000 * 60 * 60);
                            if (selisihJam < 24) {
                                statusBadge = `<span class="badge badge-locked">🔒 Terkunci: ${(24 - selisihJam).toFixed(1)} Jam</span>`;
                                isLocked = true;
                            }
                        }

                        listMateri += `
                            <div class="card ${isLocked ? 'locked' : ''}">
                                <img src="https://img.youtube.com/vi/${m.ytId}/hqdefault.jpg">
                                <div class="card-body">
                                    ${statusBadge}
                                    <h3>${m.judul}</h3>
                                    <div class="stats-label">📊 Total Dideres: ${totalDeres ? totalDeres.total : 0} kali</div>
                                    <a href="${isLocked ? '#' : '/nonton/' + m.id}" class="btn-play" ${isLocked ? 'style="background:#ccc; pointer-events:none;"' : ''}>
                                        ${isLocked ? 'Masih Terkunci' : 'Buka Materi'}
                                    </a>
                                </div>
                            </div>`;
                    });

                    res.send(`<!DOCTYPE html><html><head>${sharedStyle}</head><body>
                        <header>
                            <div class="nav">
                                <span>👤 <b>${user.username}</b></span>
                                ${user.role === 'ADMIN' ? '<a href="/admin/materi">Materi</a><a href="/admin/pengumuman">Update Info</a><a href="/admin/laporan">Laporan</a><a href="/admin/tambah-mubalig">User</a>' : ''}
                                <a href="/logout" style="background:#ff4757;">Logout</a>
                            </div>
                            <h1>Portal Penderesan</h1>
                        </header>
                        ${pengumumanHtml}
                        <div class="container">${listMateri || '<p style="text-align:center; grid-column:1/-1; color:#999;">Belum ada materi yang tersedia.</p>'}</div>
                    </body></html>`);
                });
            });
        });
    });
});

// ==========================================
// 3. ADMIN: KELOLA PENGUMUMAN
// ==========================================
app.get('/admin/pengumuman', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'ADMIN') return res.redirect('/');
    res.send(`${sharedStyle} <div class="admin-panel">
        <h2>Update Pengumuman Dashboard</h2>
        <form action="/admin/pengumuman" method="POST">
            <textarea name="isi" style="width:100%; height:120px; padding:15px; border-radius:10px; border:1px solid #ddd;" placeholder="Tulis instruksi atau info untuk mubalig..."></textarea><br><br>
            <button type="submit" class="btn-play" style="width:100%; border:none; cursor:pointer;">Publish Pengumuman</button>
        </form>
        <br><a href="/" style="color:#008080;">⬅ Kembali</a>
    </div>`);
});

app.post('/admin/pengumuman', (req, res) => {
    db.run("INSERT OR REPLACE INTO pengumuman (id, isi, tanggal) VALUES (1, ?, ?)", [req.body.isi, new Date().toISOString()], () => res.redirect('/'));
});

// ==========================================
// 4. ADMIN: KELOLA MATERI
// ==========================================
app.get('/admin/materi', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'ADMIN') return res.redirect('/');
    db.all("SELECT * FROM materi", [], (err, rows) => {
        let materiRows = rows.map(m => `<tr><td>${m.judul}</td><td><code>${m.ytId}</code></td><td><a href="/admin/hapus-materi/${m.id}" style="color:red;" onclick="return confirm('Hapus?')">Hapus</a></td></tr>`).join('');
        res.send(`${sharedStyle} <div class="admin-panel">
            <h2>Kelola Materi Video</h2>
            <form action="/admin/tambah-materi" method="POST" style="background:#f9f9f9; padding:20px; border-radius:10px;">
                <input type="text" name="judul" placeholder="Judul Materi" required style="padding:10px; width:250px;">
                <input type="text" name="ytId" placeholder="ID YouTube (ex: SZ6DglYdo6w)" required style="padding:10px; width:200px;">
                <button type="submit" style="padding:10px 20px; background:#008080; color:white; border:none; border-radius:5px; cursor:pointer;">+ Tambah</button>
            </form>
            <table><thead><tr><th>Judul</th><th>YouTube ID</th><th>Aksi</th></tr></thead><tbody>${materiRows}</tbody></table>
            <br><a href="/" style="color:#008080;">⬅ Kembali</a>
        </div>`);
    });
});

app.post('/admin/tambah-materi', (req, res) => {
    db.run("INSERT INTO materi (judul, ytId) VALUES (?, ?)", [req.body.judul, req.body.ytId], () => res.redirect('/admin/materi'));
});

app.get('/admin/hapus-materi/:id', (req, res) => {
    db.run("DELETE FROM materi WHERE id = ?", [req.params.id], () => res.redirect('/admin/materi'));
});

// ==========================================
// 5. LOGIN & TOOLS LAINNYA
// ==========================================
app.get('/login', (req, res) => {
    res.send(`<body style="font-family:sans-serif; background:#f0f2f5; display:flex; justify-content:center; align-items:center; height:100vh; margin:0;">
        <div style="background:white; padding:40px; border-radius:20px; box-shadow:0 15px 35px rgba(0,0,0,0.1); width:320px; text-align:center;">
            <h2 style="color:#008080; margin-bottom:20px;">Portal Penderesan</h2>
            <form action="/login" method="POST">
                <input type="text" name="username" placeholder="Username" required style="width:100%; padding:12px; margin:10px 0; border:1px solid #ddd; border-radius:8px; box-sizing:border-box;">
                <input type="password" name="password" placeholder="Password" required style="width:100%; padding:12px; margin:10px 0; border:1px solid #ddd; border-radius:8px; box-sizing:border-box;">
                <button type="submit" style="width:100%; padding:12px; background:#008080; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">MASUK</button>
            </form>
        </div>
    </body>`);
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, user) => {
        if (user) { req.session.user = user; res.redirect('/'); }
        else { res.send("<script>alert('Akses Ditolak!'); window.location='/login';</script>"); }
    });
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });

// --- (Fungsi Nonton & Laporan Admin sama dengan versi sebelumnya) ---
app.get('/nonton/:id', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    db.get("SELECT * FROM materi WHERE id = ?", [req.params.id], (err, m) => {
        res.send(`<body style="background:#000; color:#fff; text-align:center; font-family:sans-serif; padding:20px;">
            <h2>${m.judul}</h2>
            <div style="max-width:900px; margin:20px auto; aspect-ratio:16/9; background:#222;"><div id="player" style="width:100%; height:100%;"></div></div>
            <p id="st">Status: Menunggu video diputar...</p>
            <a href="/" style="color:#008080; text-decoration:none; font-weight:bold;">⬅ Kembali ke Dashboard</a>
            <script src="https://www.youtube.com/iframe_api"></script>
            <script>
                var player;
                function onYouTubeIframeAPIReady() {
                    player = new YT.Player('player', { height: '100%', width: '100%', videoId: '${m.ytId}',
                        events: { 'onStateChange': function(e) {
                            if (e.data == YT.PlayerState.PLAYING) { 
                                fetch('/kunci/${m.id}', { method: 'POST' }); 
                                document.getElementById('st').innerHTML = "🔒 Terkunci Otomatis (24 Jam)";
                            }
                        }}
                    });
                }
            </script>
        </body>`);
    });
});

app.post('/kunci/:id', (req, res) => {
    if (req.session.user.role === 'MUBALIG') {
        db.run("INSERT OR REPLACE INTO akses VALUES (?, ?, ?)", [req.session.user.username, req.params.id, new Date().toISOString()]);
    }
    res.end();
});

app.get('/admin/laporan', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'ADMIN') return res.redirect('/');
    db.all("SELECT * FROM akses ORDER BY last_access DESC", [], (err, rows) => {
        let rHtml = rows.map(r => `<tr><td>${r.user_id}</td><td>Materi #${r.video_id}</td><td>${new Date(r.last_access).toLocaleString()}</td><td><form action="/admin/reset" method="POST"><input type="hidden" name="u" value="${r.user_id}"><input type="hidden" name="v" value="${r.video_id}"><button style="background:orange; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">Reset</button></form></td></tr>`).join('');
        res.send(`${sharedStyle} <div class="admin-panel"><h2>Laporan Penderesan</h2><table><thead><tr><th>User</th><th>Video</th><th>Waktu</th><th>Aksi</th></tr></thead><tbody>${rHtml}</tbody></table><br><a href="/" style="color:#008080;">⬅ Kembali</a></div>`);
    });
});

app.post('/admin/reset', (req, res) => {
    db.run("DELETE FROM akses WHERE user_id = ? AND video_id = ?", [req.body.u, req.body.v], () => res.redirect('/admin/laporan'));
});

// ==========================================
// 6. KELOLA MUBALIG (USER MANAGEMENT)
// ==========================================
app.get('/admin/tambah-mubalig', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'ADMIN') return res.redirect('/');
    
    // Ambil semua user dengan role MUBALIG
    db.all("SELECT username, password FROM users WHERE role = 'MUBALIG'", [], (err, rows) => {
        let userRows = "";
        rows.forEach(user => {
            userRows += `
                <tr>
                    <td><b>${user.username}</b></td>
                    <td><code>${user.password}</code></td>
                    <td>
                        <button onclick="editPass('${user.username}')" class="btn-action" style="background:#ffa502;">Edit Pass</button>
                        <a href="/admin/hapus-mubalig/${user.username}" class="btn-action" style="background:#ff4757; text-decoration:none;" onclick="return confirm('Hapus user ini?')">Hapus</a>
                    </td>
                </tr>`;
        });

        res.send(`
            ${sharedStyle}
            <div class="admin-panel" style="max-width:600px;">
                <h2>Kelola Mubalig Baru</h2>
                
                <form action="/admin/tambah-mubalig" method="POST" style="display:flex; flex-direction:column; gap:15px; background:#f9f9f9; padding:20px; border-radius:10px;">
                    <div>
                        <label style="display:block; margin-bottom:5px; font-weight:bold;">Username:</label>
                        <input type="text" name="u" placeholder="Masukkan Nama/ID" required style="width:100%; padding:10px; border:1px solid #ddd; border-radius:5px; box-sizing:border-box;">
                    </div>
                    <div>
                        <label style="display:block; margin-bottom:5px; font-weight:bold;">Password:</label>
                        <input type="text" name="p" placeholder="Masukkan Password" required style="width:100%; padding:10px; border:1px solid #ddd; border-radius:5px; box-sizing:border-box;">
                    </div>
                    <button type="submit" class="btn-play" style="width:100%; border:none; cursor:pointer;">Daftarkan Mubalig</button>
                </form>

                <hr style="margin:30px 0; border:0; border-top:1px solid #eee;">

                <h3>Daftar Mubalig Terdaftar</h3>
                <table style="font-size:14px;">
                    <thead>
                        <tr>
                            <th>Username</th>
                            <th>Password</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${userRows || '<tr><td colspan="3" style="text-align:center;">Belum ada mubalig.</td></tr>'}
                    </tbody>
                </table>
                <br>
                <a href="/" style="color:#008080; font-weight:bold; text-decoration:none;">⬅ Kembali ke Dashboard</a>
            </div>

            <script>
                function editPass(user) {
                    const newPass = prompt("Masukkan password baru untuk " + user + ":");
                    if (newPass) {
                        window.location.href = "/admin/edit-mubalig/" + user + "/" + newPass;
                    }
                }
            </script>
        `);
    });
});

// Logic untuk Edit Password
app.get('/admin/edit-mubalig/:u/:p', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'ADMIN') return res.end();
    db.run("UPDATE users SET password = ? WHERE username = ?", [req.params.p, req.params.u], () => {
        res.send("<script>alert('Password berhasil diubah!'); window.location='/admin/tambah-mubalig';</script>");
    });
});

// Logic untuk Hapus User
app.get('/admin/hapus-mubalig/:u', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'ADMIN') return res.end();
    db.run("DELETE FROM users WHERE username = ?", [req.params.u], () => {
        res.redirect('/admin/tambah-mubalig');
    });
});

app.post('/admin/tambah-mubalig', (req, res) => {
    db.run("INSERT INTO users VALUES (?, ?, 'MUBALIG')", [req.body.u, req.body.p], () => res.redirect('/'));
});

app.listen(3000, () => console.log("Web Penderesan Aktif: http://localhost:3000"));