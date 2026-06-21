# Panduan Deploy ke VPS Ubuntu dengan Nginx & PM2

Panduan ini berisi langkah-langkah lengkap untuk melakukan deployment aplikasi **html-to-img** pada VPS Ubuntu Anda, menggunakan **Nginx** sebagai reverse proxy, **PM2** sebagai process manager, dan memasang **Chromium** beserta font untuk merender screenshot.

---

## 📋 Prasyarat
Pastikan Anda sudah memiliki akses SSH ke VPS Ubuntu Anda (disarankan Ubuntu 20.04 atau 22.04 LTS).

---

## 🛠️ Langkah 1: Update System & Install Node.js
Hubungkan ke VPS Anda dan perbarui repositori paket:
```bash
sudo apt update && sudo apt upgrade -y
```

Install Node.js (versi LTS direkomendasikan):
```bash
# Mengunduh setup script NodeSource untuk Node.js v20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js dan git
sudo apt install -y nodejs git
```
Verifikasi instalasi:
```bash
node -v
npm -v
```

---

## 🌐 Langkah 2: Install & Configure Nginx
Pasang Nginx untuk digunakan sebagai reverse proxy:
```bash
sudo apt install -y nginx
```
Pastikan firewall mengizinkan lalu lintas web HTTP/HTTPS:
```bash
sudo ufw allow 'Nginx Full'
```

---

## 📦 Langkah 3: Install Chromium & Font (Penting untuk Puppeteer)
Karena aplikasi ini menggunakan `puppeteer-core` di sisi server untuk mengambil screenshot, Anda wajib memasang **Chromium** (atau Google Chrome) serta **paket font** agar karakter unicode, bahasa asing, dan emoji dapat dirender secara sempurna (tidak kotak-kotak):

```bash
# Install Chromium Browser
sudo apt install -y chromium-browser

# Install dependensi font penting untuk rendering emoji dan teks multibahasa
sudo apt install -y \
  fonts-ipafont-gothic \
  fonts-wqy-zenhei \
  fonts-thai-tlwg \
  fonts-kacst \
  fonts-freefont-ttf \
  fonts-liberation \
  fonts-noto-color-emoji
```

---

## 📥 Langkah 4: Setup Aplikasi html-to-img
Klon repositori proyek Anda ke dalam VPS (misalnya di folder `/var/www/` atau home directory):
```bash
# Pindah ke directory tujuan
cd /var/www

# Clone project (ubah URL di bawah sesuai dengan repository Anda)
git clone https://github.com/username/html-to-img.git
cd html-to-img

# Install dependensi proyek
npm install --production
```

### Konfigurasi Environment (`.env`)
Salin contoh konfigurasi env dan sesuaikan port jika diperlukan:
```bash
cp .env.example .env
nano .env
```
Isi dari berkas `.env` (bisa dibiarkan port `3003` atau diubah sesuai keinginan):
```env
PORT=3003
```

---

## 🚀 Langkah 5: Jalankan Aplikasi menggunakan PM2
PM2 digunakan agar aplikasi Node.js tetap berjalan di latar belakang (*background*) secara permanen dan otomatis restart jika VPS dinyalakan ulang.

Install PM2 secara global:
```bash
sudo npm install -g pm2
```
Jalankan aplikasi dengan PM2:
```bash
pm2 start index.js --name "html-to-img"
```
Simpan daftar proses PM2 agar otomatis berjalan saat VPS reboot:
```bash
pm2 save
pm2 startup
```
*(Ikuti perintah output instruksi `sudo env PATH=...` yang diberikan oleh PM2 di layar setelah Anda menjalankan `pm2 startup`)*.

---

## ⚙️ Langkah 6: Konfigurasi Nginx Reverse Proxy
Sekarang kita akan membuat blok server Nginx agar request dari publik dialihkan ke aplikasi Node.js kita yang berjalan di port `3003`.

Buat berkas konfigurasi baru di Nginx:
```bash
sudo nano /etc/nginx/sites-available/html-to-img
```

Tempelkan konfigurasi berikut (ubah `domain_atau_ip_vps_anda` dengan IP publik VPS atau domain asli Anda):
```nginx
server {
    listen 80;
    server_name domain_atau_ip_vps_anda;

    # Batas maksimum ukuran unggahan body (penting untuk base64 gambar yang besar)
    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:3003; # Sesuaikan dengan PORT di .env Anda
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # Meneruskan info IP asli client
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Aktifkan konfigurasi situs tersebut dengan membuat tautan simbolik ke `sites-enabled`:
```bash
sudo ln -s /etc/nginx/sites-available/html-to-img /etc/nginx/sites-enabled/
```
Hapus konfigurasi default Nginx (jika tidak digunakan lagi):
```bash
sudo rm /etc/nginx/sites-enabled/default
```

Uji konfigurasi Nginx untuk memastikan tidak ada error sintaks:
```bash
sudo nginx -t
```
Restart layanan Nginx:
```bash
sudo systemctl restart nginx
```

Sekarang aplikasi Anda sudah bisa diakses publik menggunakan IP VPS atau domain Anda!

---

## 🔒 Langkah 7: Pasang SSL Gratis (Let's Encrypt / HTTPS) - Opsional
Gunakan Certbot untuk memasang sertifikat SSL gratis secara otomatis jika Anda menggunakan domain:

```bash
sudo apt install -y certbot python3-certbot-nginx
```
Jalankan Certbot untuk domain Anda:
```bash
sudo certbot --nginx -d domain_atau_ip_vps_anda
```
Ikuti instruksi di layar, dan Certbot akan otomatis mengonfigurasi pengalihan HTTP ke HTTPS di berkas konfigurasi Nginx Anda.
