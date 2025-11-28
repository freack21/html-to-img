# HTML-to-IMG API Documentation

API untuk menggenerate gambar dari HTML template. Semua endpoint support method `GET` dan `POST`.

**Base URL:** `http://localhost:3003`

---

## 📌 Common Parameters

Semua endpoint memiliki parameter umum berikut:

| Parameter  | Type    | Default | Description                                |
| ---------- | ------- | ------- | ------------------------------------------ |
| `type`     | string  | `png`   | Format output: `png`, `jpg`, `jpeg`, `svg` |
| `download` | boolean | `false` | Auto download file setelah generate        |

---

## 1. Quick Chat (`/qc`)

Generate gambar chat bubble sederhana.

**Endpoint:** `GET /qc` atau `POST /qc`

| Parameter   | Type         | Default                       | Description             |
| ----------- | ------------ | ----------------------------- | ----------------------- |
| `name`      | string       | `Your Name`                   | Nama pengirim           |
| `msg`       | string       | `Hello, this is a quick chat` | Isi pesan               |
| `img`       | string (URL) | -                             | Avatar URL              |
| `bgColor`   | string       | `white`                       | Warna background bubble |
| `textColor` | string       | `black`                       | Warna teks pesan        |

**Contoh:**

```
/qc?name=Fikri&msg=Halo%20dunia!&bgColor=%23f0f0f0
```

---

## 2. Meme Generator (`/meme`)

Generate meme dengan teks atas/bawah/tengah. Output 1:1 (500x500px).

**Endpoint:** `GET /meme` atau `POST /meme`

| Parameter     | Type         | Default | Description               |
| ------------- | ------------ | ------- | ------------------------- |
| `img`         | string (URL) | -       | URL gambar meme (wajib)   |
| `textTop`     | string       | `""`    | Teks di bagian atas       |
| `textBottom`  | string       | `""`    | Teks di bagian bawah      |
| `textCenter`  | string       | `""`    | Teks di tengah            |
| `textColor`   | string       | `white` | Warna teks                |
| `strokeColor` | string       | `black` | Warna outline/stroke teks |
| `fontSize`    | string       | `48`    | Ukuran font (dalam px)    |

**Contoh:**

```
/meme?img=https://i.imgflip.com/30b1gx.jpg&textTop=WHEN%20CODE%20WORKS&textBottom=FIRST%20TRY
```

---

## 3. Tweet Generator (`/tweet`)

Generate fake tweet/X post.

**Endpoint:** `GET /tweet` atau `POST /tweet`

| Parameter  | Type         | Default    | Description                               |
| ---------- | ------------ | ---------- | ----------------------------------------- |
| `username` | string       | `John Doe` | Nama display                              |
| `handle`   | string       | `johndoe`  | Username (@handle)                        |
| `avatar`   | string (URL) | -          | Avatar URL                                |
| `content`  | string       | -          | Isi tweet                                 |
| `likes`    | string       | `1.2K`     | Jumlah likes                              |
| `retweets` | string       | `234`      | Jumlah retweets                           |
| `replies`  | string       | `56`       | Jumlah replies                            |
| `views`    | string       | `12.5K`    | Jumlah views                              |
| `date`     | string       | -          | Tanggal posting                           |
| `verified` | string       | `true`     | Tampilkan badge verified (`true`/`false`) |
| `theme`    | string       | `dark`     | Theme: `dark` atau `light`                |

**Contoh:**

```
/tweet?username=Elon%20Musk&handle=elonmusk&content=Hello%20Twitter!&verified=true&theme=dark
```

---

## 4. Quote Generator (`/quote`)

Generate gambar quote inspiratif. Output 1:1 (500x500px).

**Endpoint:** `GET /quote` atau `POST /quote`

| Parameter   | Type         | Default    | Description                               |
| ----------- | ------------ | ---------- | ----------------------------------------- |
| `quote`     | string       | -          | Teks quote                                |
| `author`    | string       | -          | Nama author                               |
| `bgImage`   | string (URL) | `""`       | Background image (opsional)               |
| `bgColor`   | string       | `#667eea`  | Warna background (jika tidak ada bgImage) |
| `textColor` | string       | `white`    | Warna teks                                |
| `theme`     | string       | `gradient` | Theme: `gradient` atau `solid`            |

**Contoh:**

```
/quote?quote=Stay%20hungry%20stay%20foolish&author=Steve%20Jobs&bgColor=%23667eea
```

---

## 5. WhatsApp Chat (`/wa`)

Generate gambar chat WhatsApp.

**Endpoint:** `GET /wa` atau `POST /wa`

| Parameter       | Type         | Default | Description              |
| --------------- | ------------ | ------- | ------------------------ |
| `contactName`   | string       | `John`  | Nama kontak              |
| `contactAvatar` | string (URL) | -       | Avatar kontak            |
| `msg1`          | string       | -       | Pesan pertama (received) |
| `msg2`          | string       | -       | Pesan kedua (sent)       |
| `time1`         | string       | `10:30` | Waktu pesan pertama      |
| `time2`         | string       | `10:31` | Waktu pesan kedua        |

**Contoh:**

```
/wa?contactName=Bos&msg1=Kerja%20lembur%20ya&msg2=Siap%20bos!&time1=21:00&time2=21:01
```

---

## 6. Code Snippet (`/code`)

Generate screenshot kode seperti Carbon/Ray.so.

**Endpoint:** `GET /code` atau `POST /code`

| Parameter         | Type   | Default      | Description                                             |
| ----------------- | ------ | ------------ | ------------------------------------------------------- |
| `code`            | string | -            | Kode yang akan ditampilkan (gunakan `\n` untuk newline) |
| `language`        | string | `javascript` | Bahasa pemrograman                                      |
| `fileName`        | string | `index.js`   | Nama file                                               |
| `theme`           | string | `dracula`    | Theme (saat ini: dracula)                               |
| `showLineNumbers` | string | `true`       | Tampilkan nomor baris (`true`/`false`)                  |

**Contoh:**

```
/code?code=const%20x%20=%201;\nconsole.log(x);&fileName=app.js&showLineNumbers=true
```

---

## 7. YouTube Thumbnail (`/yt-thumb`)

Generate thumbnail YouTube. Output 640x360px (16:9).

**Endpoint:** `GET /yt-thumb` atau `POST /yt-thumb`

| Parameter     | Type         | Default         | Description        |
| ------------- | ------------ | --------------- | ------------------ |
| `text`        | string       | `AMAZING VIDEO` | Teks utama (besar) |
| `subtext`     | string       | -               | Teks sekunder      |
| `bgImage`     | string (URL) | -               | Background image   |
| `avatar`      | string (URL) | -               | Avatar channel     |
| `channelName` | string       | `My Channel`    | Nama channel       |
| `emoji`       | string       | `🔥`            | Emoji dekorasi     |

**Contoh:**

```
/yt-thumb?text=TUTORIAL%20CODING&subtext=Untuk%20pemula!&emoji=🚀&channelName=DevChannel
```

---

## 8. Certificate (`/certificate`)

Generate sertifikat formal. Output 700x500px.

**Endpoint:** `GET /certificate` atau `POST /certificate`

| Parameter       | Type   | Default        | Description             |
| --------------- | ------ | -------------- | ----------------------- |
| `recipientName` | string | `John Doe`     | Nama penerima           |
| `achievement`   | string | -              | Deskripsi pencapaian    |
| `date`          | string | -              | Tanggal sertifikat      |
| `issuer`        | string | `Tech Academy` | Nama penerbit/institusi |
| `issuerTitle`   | string | `Director`     | Jabatan penerbit        |

**Contoh:**

```
/certificate?recipientName=Fikri%20Rivandi&achievement=Best%20Developer%202024&issuer=Google&issuerTitle=CEO
```

---

## 9. Profile Card (`/profile`)

Generate kartu profil sosial media.

**Endpoint:** `GET /profile` atau `POST /profile`

| Parameter   | Type         | Default    | Description                |
| ----------- | ------------ | ---------- | -------------------------- |
| `name`      | string       | `John Doe` | Nama lengkap               |
| `bio`       | string       | -          | Bio/deskripsi singkat      |
| `avatar`    | string (URL) | -          | Avatar URL                 |
| `followers` | string       | `1.2K`     | Jumlah followers           |
| `following` | string       | `350`      | Jumlah following           |
| `posts`     | string       | `42`       | Jumlah posts               |
| `theme`     | string       | `dark`     | Theme: `dark` atau `light` |

**Contoh:**

```
/profile?name=Fikri%20Rivandi&bio=Full-stack%20Developer&followers=10K&theme=dark
```

---

## 10. Banner/Announcement (`/banner`)

Generate banner event atau pengumuman. Output 600x300px.

**Endpoint:** `GET /banner` atau `POST /banner`

| Parameter     | Type   | Default           | Description      |
| ------------- | ------ | ----------------- | ---------------- |
| `headline`    | string | `MEGA EVENT 2024` | Judul utama      |
| `subheadline` | string | -                 | Subjudul         |
| `date`        | string | -                 | Tanggal event    |
| `location`    | string | -                 | Lokasi event     |
| `bgColor`     | string | `#ff6b6b`         | Warna background |
| `textColor`   | string | `white`           | Warna teks       |

**Contoh:**

```
/banner?headline=TECH%20CONFERENCE&subheadline=Join%20us!&date=Dec%2025&location=Jakarta&bgColor=%234f46e5
```

---

## 11. Spotify Now Playing (`/spotify`)

Generate kartu "Now Playing" ala Spotify.

**Endpoint:** `GET /spotify` atau `POST /spotify`

| Parameter   | Type         | Default           | Description          |
| ----------- | ------------ | ----------------- | -------------------- |
| `songTitle` | string       | `Blinding Lights` | Judul lagu           |
| `artist`    | string       | `The Weeknd`      | Nama artis           |
| `album`     | string       | `After Hours`     | Nama album           |
| `albumArt`  | string (URL) | -                 | Cover album URL      |
| `progress`  | string       | `65`              | Progress bar (0-100) |
| `duration`  | string       | `3:20`            | Durasi total         |
| `current`   | string       | `2:10`            | Waktu saat ini       |

**Contoh:**

```
/spotify?songTitle=Shape%20of%20You&artist=Ed%20Sheeran&album=Divide&progress=45&current=1:30&duration=3:53
```

---

## 12. Polaroid (`/polaroid`)

Generate foto dengan frame polaroid klasik.

**Endpoint:** `GET /polaroid` atau `POST /polaroid`

| Parameter  | Type         | Default              | Description                                      |
| ---------- | ------------ | -------------------- | ------------------------------------------------ |
| `img`      | string (URL) | -                    | URL gambar (wajib)                               |
| `caption`  | string       | `Good vibes only ✨` | Caption/teks                                     |
| `date`     | string       | `Nov 2024`           | Tanggal                                          |
| `rotation` | string       | `-3`                 | Rotasi dalam derajat (-15 sampai 15 recommended) |

**Contoh:**

```
/polaroid?img=https://picsum.photos/400/400&caption=Weekend%20vibes!&date=Nov%202024&rotation=5
```

---

## 📤 Upload API

Setelah generate image, sistem akan auto-upload ke server.

**Endpoint:** `POST /api/upload`

**Request Body:**

```json
{
  "dataUrl": "data:image/png;base64,...",
  "name": "filename",
  "type": "png"
}
```

**Response:**

```json
{
  "success": true,
  "message": "File uploaded successfully",
  "url": "/filename.png"
}
```

> ⚠️ File akan otomatis dihapus setelah 60 menit.

---

## 💡 Tips Penggunaan

1. **URL Encoding**: Gunakan `%20` untuk spasi, atau encode URL dengan `encodeURIComponent()`
2. **Gambar External**: Pastikan gambar dari URL external mendukung CORS
3. **Avatar Generator**: Gunakan `https://api.dicebear.com/7.x/avataaars/svg?seed=NAMA` untuk generate avatar random
4. **Random Image**: Gunakan `https://picsum.photos/WIDTH/HEIGHT` untuk gambar random
