# Panduan Publikasi dan Deployment Evocodex

Dokumen ini berisi 2 bagian: Panduan untuk **Developer** (untuk mem-build dan publish image) dan panduan untuk **End-User** (cara termudah menjalankan aplikasi tanpa source code).

---

## 👨‍💻 Bagian 1: Untuk Developer (Cara Publish ke Docker Hub)

Sebagai developer/pemilik aplikasi, Anda perlu mem-build source code Anda ke dalam image dan mengunggahnya ke Docker Hub.

1. **Login ke Docker Hub**
   Buka terminal dan jalankan:
   ```bash
   docker login
   ```
   Masukkan Username dan Password Docker Hub Anda.

2. **Build Image**
   Ganti `yourusername` dengan username Docker Hub Anda yang asli:
   ```bash
   docker build -t yourusername/evocodex:latest .
   ```
   *(Proses ini akan mengunduh dependencies Node.js dan Python, dan menggabungkannya ke dalam satu image)*

3. **Push Image ke Docker Hub**
   ```bash
   docker push yourusername/evocodex:latest
   ```

Setelah sukses, image `evocodex:latest` sudah berada di internet dan siap dipakai siapa saja. Jangan lupa untuk mengganti tulisan `yourusername/evocodex:latest` di dalam file `docker-compose.yml` sebelum membagikannya ke User!

---

## 🚀 Bagian 2: Untuk End-User (Cara Deploy)

Bagi pengguna yang ingin menjalankan aplikasi Evocodex di server mereka, mereka **tidak perlu mendownload source code**. Mereka hanya butuh 1 file konfigurasi!

### 1. Siapkan File Konfigurasi
Cukup buat sebuah file bernama `docker-compose.yml` di komputer/server Anda dengan isi file yang sama seperti `docker-compose.yml` dari repository ini. 

### 2. Atur Environment / Konfigurasi
Semua pengaturan dapat dilakukan langsung dengan membuat file `.env` di direktori yang sama dengan `docker-compose.yml`. Contoh isi file `.env`:

```ini
# Database
DB_USER=evocodex_admin
DB_PASSWORD=password_super_kuat
DB_NAME=evocodex_db

# Kunci Keamanan (Ubah ini!)
JWT_SECRET_KEY=kunci_rahasia_saya_12345

# Konfigurasi AI & GitLab
HF_TOKEN=hf_token_anda_disini
GITLAB_PAT=gitlab_pat_anda
```
*(Catatan: Anda juga bisa menuliskan environment langsung di dalam file `docker-compose.yml` di blok `environment:` jika tidak ingin menggunakan `.env`)*

### 3. Jalankan Aplikasi
Di dalam folder yang berisi `docker-compose.yml` dan `.env`, buka terminal dan jalankan:

```bash
docker-compose up -d
```

**Selesai!** 
- Docker otomatis men-download image dari internet.
- Database otomatis siap.
- Aplikasi sudah bisa diakses di `http://localhost:8000` (atau IP server).
