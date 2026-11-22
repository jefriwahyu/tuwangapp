# Panduan Deploy Backend ke Vercel Functions

Panduan ini untuk backend Go/Gin `tuwangapp` di folder `backend`.
Frontend tetap memakai project Vercel yang sudah ada.

## Yang sudah disiapkan di repo

- `backend/vercel.json` — mengaktifkan Go Framework Preset, build dari `cmd/api`, dan region Singapore (`sin1`).
- `backend/cmd/api/main.go` — membaca `PORT` dan `CORS_ORIGINS`; `time/tzdata` disematkan agar `TZ=Asia/Jakarta` bekerja.
- `backend/.env.example` — contoh environment variables, termasuk `TZ` dan `GIN_MODE`.
- `frontend/.env.example` — contoh `VITE_API_URL` untuk Vercel.
- `render.yaml` — tetap ada sebagai alternatif; sudah ditambah `TZ`.

## Prasyarat

- Repo GitHub: `https://github.com/jefriwahyu/tuwangapp`
- Akun Vercel (Hobby, tanpa kartu)
- Project Supabase aktif
- API key Groq
- URL frontend production, misalnya `https://tuwangapp.vercel.app`

## 1. Push repo

Kalau perubahan belum di-push:

```powershell
cd G:\projek\tuwangapp
git add backend/vercel.json backend/cmd/api/main.go backend/.env.example frontend/.env.example frontend/src/api.js render.yaml "panduan deploy vercel.md"
git commit -m "chore(deploy): siapkan konfigurasi Vercel Functions"
git push origin main
```

## 2. Buat project backend di Vercel

1. Buka <https://vercel.com/new>.
2. Import repository `jefriwahyu/tuwangapp`.
3. Isi konfigurasi berikut:

   | Field | Nilai |
   |---|---|
   | **Project Name** | `tuwangapp-api` |
   | **Framework Preset** | `Go` |
   | **Root Directory** | `backend` |
   | **Build Command** | `go build -o server ./cmd/api` |
   | **Output Directory** | kosongkan |
   | **Install Command** | biarkan default |

   **Root Directory wajib `backend`.** Di situlah `go.mod` berada. Kalau root-nya salah, build akan gagal dengan error `go.mod file not found`.

4. Jangan klik **Deploy** dulu; isi environment variables di bagian bawah.

## 3. Environment variables

Tambahkan satu per satu di bagian **Environment Variables**:

| Key | Value | Catatan |
|---|---|---|
| `SUPABASE_URL` | `https://xxxx.supabase.co` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_KEY` | `service_role` key | Rahasia; jangan pernah dipakai di frontend |
| `GROQ_API_KEY` | `gsk_...` | Rahasia |
| `CORS_ORIGINS` | `https://tuwangapp.vercel.app` | Origin frontend persis, tanpa trailing slash |
| `GIN_MODE` | `release` | |
| `TZ` | `Asia/Jakarta` | Agar batas "hari ini"/"bulan ini" benar |

- **Jangan set `PORT`.** Vercel mengisinya otomatis.
- **Jangan set `SUPABASE_JWT_SECRET`.** Kode tidak memakainya.
- Kalau mau mencoba dari Preview Deployment, tambahkan environment variables yang sama untuk environment **Preview**. `CORS_ORIGINS` untuk preview harus berisi origin preview yang dipakai, atau tes hanya dari production.

## 4. Deploy dan tes health

1. Klik **Deploy**.
2. Tunggu build selesai; build Go biasanya 1–2 menit.
3. Catat domain production, misalnya `https://tuwangapp-api.vercel.app`.
4. Tes:

   ```powershell
   Invoke-RestMethod https://tuwangapp-api.vercel.app/api/v1/health
   ```

   Hasil yang diharapkan:

   ```json
   { "status": "ok" }
   ```

5. Kalau 404, cek **Root Directory** = `backend` dan lihat build logs.
6. Kalau 500, buka **Logs** dan cek environment variables.

## 5. Hubungkan frontend

1. Buka project frontend di Vercel → **Settings** → **Environment Variables**.
2. Tambahkan:

   - Key: `VITE_API_URL`
   - Value: `https://tuwangapp-api.vercel.app/api/v1`
   - Environment: **Production** (dan **Preview** kalau perlu)

3. **Redeploy frontend** lewat **Deployments** → menu `...` → **Redeploy**.
   Vite membaca environment variable saat build, jadi tanpa redeploy nilainya tidak berubah.
4. Buka frontend, login, lalu pastikan dashboard memuat summary, trend, dan transaksi terakhir.

## 6. CORS

`CORS_ORIGINS` harus sama persis dengan origin frontend:

- Benar: `https://tuwangapp.vercel.app`
- Salah: `https://tuwangapp.vercel.app/` (trailing slash)

Kalau frontend memakai custom domain, gunakan domain itu. Kalau muncul CORS error di browser, perbaiki `CORS_ORIGINS` lalu redeploy backend.

## 7. Tes end-to-end

- Buka frontend → login.
- Dashboard muncul (summary, trend, 3 transaksi terakhir).
- Chat: `kopi 15rb` → transaksi tersimpan.
- Chat: `rekap bulan ini` → kartu ringkasan muncul.
- Chat: `hapus kopi tadi` → tombol konfirmasi → hapus.
- Cek **Vercel → Logs** kalau ada error.

## Troubleshooting

| Gejala | Penyebab | Solusi |
|---|---|---|
| 404 `NOT_FOUND` | Root Directory bukan `backend` | Ubah root, redeploy |
| Build gagal `go.mod file not found` | Root Directory salah | Set `backend` |
| Build gagal karena versi Go | Versi di `go.mod` tidak didukung | Sesuaikan `go.mod` |
| 500 saat request pertama | Env kurang, Supabase pause, atau JWKS gagal | Cek logs dan env |
| CORS error | Origin tidak cocok | Perbaiki `CORS_ORIGINS`, redeploy |
| 401 | Token tidak ada/expired | Login ulang |
| Chat error | Groq key/limit | Cek dashboard Groq |
| Frontend memanggil `localhost` | `VITE_API_URL` belum di-set saat build | Set env, redeploy frontend |
| Jam transaksi bergeser | `TZ` belum di-set | Set `TZ=Asia/Jakarta`, redeploy |
| Request pertama lambat | Cold start | Normal, sekitar 1–2 detik |

## Catatan free tier

- Vercel Hobby gratis, tanpa kartu.
- Kuota Hobby per bulan: 1.000.000 function invocations, 4 CPU-jam, 360 GB-jam memory, 100 GB data transfer.
- Kalau kuota terlampaui, fitur dibatasi sampai 30 hari; tidak ada tagihan otomatis.
- Supabase free pause setelah ~7 hari aktivitas rendah. Restore dari dashboard; data aman sampai ~1 tahun.
- Runtime log Hobby hanya 1 jam.
- Go runtime masih Beta.
- Hobby untuk penggunaan non-komersial; penggunaan keluarga aman.

## Alternatif CLI

Kalau lebih suka CLI:

```powershell
npm i -g vercel
vercel login
cd G:\projek\tuwangapp\backend
vercel
vercel --prod
```

Menambah environment variables lewat CLI:

```powershell
vercel env add SUPABASE_URL production
vercel env add SUPABASE_SERVICE_KEY production
vercel env add GROQ_API_KEY production
vercel env add CORS_ORIGINS production
vercel env add GIN_MODE production
vercel env add TZ production
```

Jangan pernah commit `.env` atau menaruh `SUPABASE_SERVICE_KEY` di frontend.
