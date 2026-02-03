const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const bodyParser = require('body-parser');
const session = require('express-session');
const app = express();

// --- KONFIGURASI SUPABASE ---
const SUPABASE_URL = 'https://rksgcrpbxgsmpxmqrgpt.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrc2djcnBieGdzbXB4bXFyZ3B0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNjUyNjksImV4cCI6MjA4NTY0MTI2OX0.6BFglsyo0PzWvw47z4H2-A-WzMO_Z2JCKjkiXN0VzkQ';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'penderesan-rahasia-77',
    resave: false,
    saveUninitialized: true
}));

// Shared Style (Sama seperti sebelumnya)
const sharedStyle = `
    <style>
        body { font-family: 'Segoe UI', sans-serif; background: #f0f2f5; margin: 0; }
        header { background: #008080; color: white; padding: 60px 20px; text-align: center; position: relative; }
        .nav { position: absolute; top: 15px; right: 20px; display: flex; gap: 10px; }
        .nav a { color: white; text-decoration: none; background: rgba(0,0,0,0.2); padding: 6px 12px; border-radius: 5px; font-size: 12px; }
        .container { max-width: 1100px; margin: 40px auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 30px; padding: 0 20px; }
        .announcement-box { max-width: 1060px; margin: 20px auto; padding: 20px; background: #fff3cd; border-left: 6px solid #ffc107; border-radius: 10px; }
        .card { background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); transition: 0.3s; }
        .card img { width: 100%; height: 200px; object-fit: cover; }
        .card-body { padding: 20px; }
        .btn-play { display: block; text-align: center; background: #008080; color: white; text-decoration: none; padding: 12px; border-radius: 10px; font-weight: bold; }
        .badge { font-size: 11px; font-weight: bold; padding: 6px 12px; border-radius: 20px; text-transform: uppercase; margin-bottom:10px; display:inline-block; }
        .badge-ready { background: #e7f9ee; color: #2ecc71; }
        .badge-locked { background: #fff5f5; color: #ff4757; }
        .admin-panel { background: white; max-width: 800px; margin: 40px auto; padding: 30px; border-radius: 15px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background: #008080; color: white; padding: 12px; text-align: left; }
        td { padding: 12px; border-bottom: 1px solid #eee; }
    </style>
`;

// ==========================================
// 1. DASHBOARD
// ==========================================
app.get('/', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const user = req.session.user;

    const { data: info } = await supabase.from('pengumuman').select('*').eq('id', 1).single();
    const { data: daftarMateri } = await supabase.from('materi').select('*');
    const { data: stats } = await supabase.rpc('get_stats'); // Opsional: atau select count akses
    const { data: userAkses } = await supabase.from('akses').select('*').eq('user_id', user.username);

    let pengumumanHtml = info ? `<div class="announcement-box"><b>📢 INFO:</b> ${info.isi}</div>` : "";
    let listMateri = "";

    if (daftarMateri) {
        daftarMateri.forEach(m => {
            const logAkses = userAkses ? userAkses.find(r => r.video_id === m.id) : null;
            let isLocked = false;
            let statusBadge = `<span class="badge badge-ready">Siap Dideres</span>`;

            if (logAkses && user.role === 'MUBALIG') {
                const selisihJam = (new Date() - new Date(logAkses.last_access)) / (1000 * 60 * 60);
                if (selisihJam < 24) {
                    statusBadge = `<span class="badge badge-locked">🔒 Terkunci: ${(24 - selisihJam).toFixed(1)} Jam</span>`;
                    isLocked = true;
                }
            }

            listMateri += `
                <div class="card">
                    <img src="https://img.youtube.com/vi/${m.ytId}/hqdefault.jpg">
                    <div class="card-body">
                        ${statusBadge}
                        <h3>${m.judul}</h3>
                        <a href="${isLocked ? '#' : '/nonton/' + m.id}" class="btn-play" ${isLocked ? 'style="background:#ccc;"' : ''}>Buka Materi</a>
                    </div>
                </div>`;
        });
    }

    res.send(`<!DOCTYPE html><html><head>${sharedStyle}</head><body>
        <header>
            <div class="nav">
                <span>👤 ${user.username}</span>
                ${user.role === 'ADMIN' ? '<a href="/admin/materi">Materi</a><a href="/admin/pengumuman">Info</a><a href="/admin/laporan">Laporan</a><a href="/admin/tambah-mubalig">User</a>' : ''}
                <a href="/logout">Logout</a>
            </div>
            <h1>Portal Penderesan</h1>
        </header>
        ${pengumumanHtml}
        <div class="container">${listMateri}</div>
    </body></html>`);
});

// ==========================================
// 2. LOGIN
// ==========================================
app.get('/login', (req, res) => {
    res.send(`
        <body style="font-family:sans-serif; background:#f0f2f5; display:flex; justify-content:center; align-items:center; height:100vh;">
            <div style="background:white; padding:40px; border-radius:20px; box-shadow:0 10px 25px rgba(0,0,0,0.1); text-align:center; width:300px;">
                <h2 style="color:#008080;">Login Penderesan</h2>
                <form action="/login" method="POST">
                    <input type="text" name="u" placeholder="Username" required style="width:100%; padding:10px; margin:10px 0; border:1px solid #ddd; border-radius:5px;">
                    <input type="password" name="p" placeholder="Password" required style="width:100%; padding:10px; margin:10px 0; border:1px solid #ddd; border-radius:5px;">
                    <button type="submit" style="width:100%; padding:10px; background:#008080; color:white; border:none; border-radius:5px; cursor:pointer;">MASUK</button>
                </form>
            </div>
        </body>
    `);
});

app.post('/login', async (req, res) => {
    const { u, p } = req.body;
    const { data: user } = await supabase.from('users').select('*').eq('username', u).eq('password', p).single();
    if (user) { req.session.user = user; res.redirect('/'); }
    else { res.send("<script>alert('Gagal!'); window.location='/login';</script>"); }
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });

// ==========================================
// 3. ADMIN: KELOLA MUBALIG
// ==========================================
app.get('/admin/tambah-mubalig', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'ADMIN') return res.redirect('/');
    const { data: users } = await supabase.from('users').select('*').eq('role', 'MUBALIG');
    
    let rows = users ? users.map(u => `<tr><td>${u.username}</td><td>${u.password}</td><td><a href="/admin/hapus-mubalig/${u.username}" style="color:red;">Hapus</a></td></tr>`).join('') : "";
    
    res.send(`${sharedStyle} <div class="admin-panel">
        <h2>Tambah Mubalig Baru</h2>
        <form action="/admin/tambah-mubalig" method="POST" style="display:flex; flex-direction:column; gap:10px;">
            <input type="text" name="u" placeholder="Username" required style="padding:10px;">
            <input type="password" name="p" placeholder="Password" required style="padding:10px;">
            <button type="submit" class="btn-play" style="border:none; cursor:pointer;">Daftarkan</button>
        </form>
        <table><thead><tr><th>User</th><th>Pass</th><th>Aksi</th></tr></thead><tbody>${rows}</tbody></table>
        <br><a href="/">⬅ Kembali</a>
    </div>`);
});

app.post('/admin/tambah-mubalig', async (req, res) => {
    await supabase.from('users').insert([{ username: req.body.u, password: req.body.p, role: 'MUBALIG' }]);
    res.redirect('/admin/tambah-mubalig');
});

app.get('/admin/hapus-mubalig/:u', async (req, res) => {
    await supabase.from('users').delete().eq('username', req.params.u);
    res.redirect('/admin/tambah-mubalig');
});

// ==========================================
// 4. NONTON & KUNCI
// ==========================================
app.get('/nonton/:id', async (req, res) => {
    const { data: m } = await supabase.from('materi').select('*').eq('id', req.params.id).single();
    res.send(`<body style="background:#000; color:#fff; text-align:center; padding:20px; font-family:sans-serif;">
        <h2>${m.judul}</h2>
        <div id="player" style="max-width:800px; margin:auto; aspect-ratio:16/9;"></div>
        <br><a href="/" style="color:teal;">⬅ Kembali</a>
        <script src="https://www.youtube.com/iframe_api"></script>
        <script>
            var player;
            function onYouTubeIframeAPIReady() {
                player = new YT.Player('player', { videoId: '${m.ytId}', events: {
                    'onStateChange': function(e) { if(e.data == 1) fetch('/kunci/${m.id}', {method:'POST'}); }
                }});
            }
        </script>
    </body>`);
});

app.post('/kunci/:id', async (req, res) => {
    if (req.session.user && req.session.user.role === 'MUBALIG') {
        await supabase.from('akses').upsert({ 
            user_id: req.session.user.username, 
            video_id: req.params.id, 
            last_access: new Date().toISOString() 
        });
    }
    res.end();
});

// Jalankan Server (Gunakan PORT dari Render)
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Online di port ${PORT}`));
