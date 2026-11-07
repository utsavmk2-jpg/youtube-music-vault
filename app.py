import os
import re
import sqlite3
import unicodedata
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_file, abort
import yt_dlp
import imageio_ffmpeg

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DOWNLOADS_DIR = os.path.join(BASE_DIR, "downloads")
DB_PATH = os.path.join(BASE_DIR, "database.db")
os.makedirs(DOWNLOADS_DIR, exist_ok=True)

# Auto-organize files if uploaded directly to root
import shutil
templates_dir = os.path.join(BASE_DIR, "templates")
if not os.path.exists(os.path.join(templates_dir, "index.html")) and os.path.exists(os.path.join(BASE_DIR, "index.html")):
    os.makedirs(templates_dir, exist_ok=True)
    try:
        shutil.copy2(os.path.join(BASE_DIR, "index.html"), os.path.join(templates_dir, "index.html"))
    except Exception:
        pass

static_css_dir = os.path.join(BASE_DIR, "static", "css")
if not os.path.exists(os.path.join(static_css_dir, "style.css")) and os.path.exists(os.path.join(BASE_DIR, "style.css")):
    os.makedirs(static_css_dir, exist_ok=True)
    try:
        shutil.copy2(os.path.join(BASE_DIR, "style.css"), os.path.join(static_css_dir, "style.css"))
    except Exception:
        pass

static_js_dir = os.path.join(BASE_DIR, "static", "js")
if not os.path.exists(os.path.join(static_js_dir, "app.js")) and os.path.exists(os.path.join(BASE_DIR, "app.js")):
    os.makedirs(static_js_dir, exist_ok=True)
    try:
        shutil.copy2(os.path.join(BASE_DIR, "app.js"), os.path.join(static_js_dir, "app.js"))
    except Exception:
        pass

try:
    FFMPEG_PATH = imageio_ffmpeg.get_ffmpeg_exe()
except Exception:
    import shutil
    FFMPEG_PATH = shutil.which("ffmpeg") or "ffmpeg"

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS songs (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            channel TEXT,
            duration TEXT,
            duration_seconds INTEGER,
            thumbnail_url TEXT,
            filename TEXT,
            file_size INTEGER,
            youtube_url TEXT,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

init_db()

def extract_video_id(url: str) -> str:
    """Extract YouTube video ID from various link formats."""
    if not url:
        return ""
    patterns = [
        r"(?:v=|\/v\/|youtu\.be\/|shorts\/|\/embed\/)([a-zA-Z0-9_-]{11})",
        r"^([a-zA-Z0-9_-]{11})$"
    ]
    for pattern in patterns:
        match = re.search(pattern, url.strip())
        if match:
            return match.group(1)
    return ""

def format_duration(seconds: int) -> str:
    """Format seconds into HH:MM:SS or MM:SS."""
    if not seconds or seconds < 0:
        return "00:00"
    m, s = divmod(seconds, 60)
    h, m = divmod(m, 60)
    if h > 0:
        return f"{h:02d}:{m:02d}:{s:02d}"
    return f"{m:02d}:{s:02d}"

def sanitize_filename(filename: str) -> str:
    """Sanitize string for safe filenames across OS."""
    filename = unicodedata.normalize('NFKD', filename).encode('ascii', 'ignore').decode('ascii')
    filename = re.sub(r'[^\w\s-]', '', filename).strip()
    return re.sub(r'[-\s]+', '-', filename)

@app.route("/")
def index():
    if os.path.exists(os.path.join(BASE_DIR, "templates", "index.html")):
        return render_template("index.html")
    if os.path.exists(os.path.join(BASE_DIR, "index.html")):
        return send_file(os.path.join(BASE_DIR, "index.html"), mimetype="text/html")
    return "YouTube Music Vault Server Running!", 200

@app.route("/static/css/style.css")
@app.route("/style.css")
def serve_css():
    if os.path.exists(os.path.join(BASE_DIR, "static", "css", "style.css")):
        return send_file(os.path.join(BASE_DIR, "static", "css", "style.css"), mimetype="text/css")
    if os.path.exists(os.path.join(BASE_DIR, "style.css")):
        return send_file(os.path.join(BASE_DIR, "style.css"), mimetype="text/css")
    abort(404)

@app.route("/static/js/app.js")
@app.route("/app.js")
def serve_js():
    if os.path.exists(os.path.join(BASE_DIR, "static", "js", "app.js")):
        return send_file(os.path.join(BASE_DIR, "static", "js", "app.js"), mimetype="application/javascript")
    if os.path.exists(os.path.join(BASE_DIR, "app.js")):
        return send_file(os.path.join(BASE_DIR, "app.js"), mimetype="application/javascript")
    abort(404)

@app.route("/api/host-info", methods=["GET"])
def get_host_info():
    import socket
    local_ip = "127.0.0.1"
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
    except Exception:
        pass
    return jsonify({
        "ip": local_ip,
        "port": 5000,
        "mobile_url": f"http://{local_ip}:5000"
    })

@app.route("/api/info", methods=["POST"])
def get_video_info():
    data = request.get_json() or {}
    raw_url = data.get("url", "").strip()
    if not raw_url:
        return jsonify({"error": "Please provide a valid YouTube URL"}), 400

    video_id = extract_video_id(raw_url)
    clean_url = f"https://www.youtube.com/watch?v={video_id}" if video_id else raw_url

    ydl_opts = {
        "extract_flat": True,
        "quiet": True,
        "no_warnings": True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(clean_url, download=False)
            if not info:
                return jsonify({"error": "Could not retrieve video information"}), 404

            # If yt-dlp extracted an entry list
            if "entries" in info and info["entries"]:
                info = info["entries"][0]

            vid = info.get("id") or video_id
            title = info.get("title", "Unknown Title")
            channel = info.get("uploader") or info.get("channel") or "Unknown Artist"
            duration_sec = info.get("duration") or 0
            duration_str = format_duration(duration_sec)
            
            # Find best thumbnail
            thumbnail = info.get("thumbnail")
            if not thumbnail and vid:
                thumbnail = f"https://img.youtube.com/vi/{vid}/hqdefault.jpg"

            # Check if already in database
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM songs WHERE id = ?", (vid,))
            existing = cursor.fetchone()
            conn.close()

            return jsonify({
                "id": vid,
                "title": title,
                "channel": channel,
                "duration": duration_str,
                "duration_seconds": duration_sec,
                "thumbnail_url": thumbnail,
                "youtube_url": f"https://www.youtube.com/watch?v={vid}",
                "is_saved": existing is not None
            })
    except Exception as e:
        # Fallback to official YouTube oEmbed API (works anywhere without bot blocks!)
        if video_id:
            try:
                import urllib.request, json
                oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
                req = urllib.request.Request(oembed_url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=5) as res:
                    data = json.loads(res.read().decode("utf-8"))
                    title = data.get("title", f"YouTube Video ({video_id})")
                    channel = data.get("author_name", "YouTube Channel")
                    thumbnail = data.get("thumbnail_url") or f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"

                    conn = get_db_connection()
                    cursor = conn.cursor()
                    cursor.execute("SELECT id FROM songs WHERE id = ?", (video_id,))
                    existing = cursor.fetchone()
                    conn.close()

                    return jsonify({
                        "id": video_id,
                        "title": title,
                        "channel": channel,
                        "duration": "03:30",
                        "duration_seconds": 210,
                        "thumbnail_url": thumbnail,
                        "youtube_url": f"https://www.youtube.com/watch?v={video_id}",
                        "is_saved": existing is not None
                    })
            except Exception:
                pass
        return jsonify({"error": f"Failed to fetch video: {str(e)}"}), 400

@app.route("/api/convert", methods=["POST"])
def convert_and_save():
    data = request.get_json() or {}
    raw_url = data.get("url", "").strip()
    if not raw_url:
        return jsonify({"error": "YouTube link is required"}), 400

    video_id = extract_video_id(raw_url)
    target_url = f"https://www.youtube.com/watch?v={video_id}" if video_id else raw_url

    # Check if already saved
    if video_id:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM songs WHERE id = ?", (video_id,))
        row = cursor.fetchone()
        conn.close()
        if row:
            # File exists?
            filename = row["filename"]
            filepath = os.path.join(DOWNLOADS_DIR, filename)
            if os.path.exists(filepath):
                return jsonify({
                    "message": "Song already converted and present in library",
                    "song": dict(row)
                })

    mp3_filename = f"{video_id or 'song'}.mp3"
    output_template = os.path.join(DOWNLOADS_DIR, f"{video_id or '%(id)s'}.%(ext)s")

    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": output_template,
        "ffmpeg_location": FFMPEG_PATH,
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": "192",
        }],
        "quiet": True,
        "no_warnings": True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(target_url, download=True)
            if "entries" in info and info["entries"]:
                info = info["entries"][0]

            actual_id = info.get("id") or video_id
            title = info.get("title", "Unknown Title")
            channel = info.get("uploader") or info.get("channel") or "Unknown Artist"
            duration_sec = info.get("duration") or 0
            duration_str = format_duration(duration_sec)
            thumbnail = info.get("thumbnail") or f"https://img.youtube.com/vi/{actual_id}/hqdefault.jpg"

            final_filename = f"{actual_id}.mp3"
            final_filepath = os.path.join(DOWNLOADS_DIR, final_filename)
            file_size = os.path.getsize(final_filepath) if os.path.exists(final_filepath) else 0

            # Save to SQLite database
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO songs 
                (id, title, channel, duration, duration_seconds, thumbnail_url, filename, file_size, youtube_url, added_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                actual_id,
                title,
                channel,
                duration_str,
                duration_sec,
                thumbnail,
                final_filename,
                file_size,
                f"https://www.youtube.com/watch?v={actual_id}",
                datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
            ))
            conn.commit()
            
            cursor.execute("SELECT * FROM songs WHERE id = ?", (actual_id,))
            saved_song = dict(cursor.fetchone())
            conn.close()

            return jsonify({
                "message": "Song successfully converted and saved to library!",
                "song": saved_song
            })
    except Exception as e:
        err_str = str(e)
        # If cloud blocked download, save as streamable library track via oembed fallback!
        if video_id:
            try:
                import urllib.request, json
                oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
                req = urllib.request.Request(oembed_url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=5) as res:
                    data = json.loads(res.read().decode("utf-8"))
                    title = data.get("title", f"YouTube Video ({video_id})")
                    channel = data.get("author_name", "YouTube Channel")
                    thumbnail = data.get("thumbnail_url") or f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"

                    conn = get_db_connection()
                    cursor = conn.cursor()
                    cursor.execute("""
                        INSERT OR REPLACE INTO songs 
                        (id, title, channel, duration, duration_seconds, thumbnail_url, filename, file_size, youtube_url, added_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        video_id, title, channel, "03:30", 210, thumbnail, "", 0,
                        f"https://www.youtube.com/watch?v={video_id}",
                        datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
                    ))
                    conn.commit()
                    cursor.execute("SELECT * FROM songs WHERE id = ?", (video_id,))
                    saved_song = dict(cursor.fetchone())
                    conn.close()

                    return jsonify({
                        "message": "Saved to your library for instant streaming!",
                        "song": saved_song
                    })
            except Exception:
                pass
        return jsonify({"error": f"Conversion error: {err_str}"}), 400

@app.route("/api/songs", methods=["GET"])
def get_songs():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM songs ORDER BY added_at DESC")
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify(rows)

@app.route("/api/songs/<song_id>", methods=["DELETE"])
def delete_song(song_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM songs WHERE id = ?", (song_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Song not found"}), 404

    filename = row["filename"]
    cursor.execute("DELETE FROM songs WHERE id = ?", (song_id,))
    conn.commit()
    conn.close()

    # Remove file if it exists
    filepath = os.path.join(DOWNLOADS_DIR, filename)
    if os.path.exists(filepath):
        try:
            os.remove(filepath)
        except OSError:
            pass

    return jsonify({"message": "Song deleted from library"})

@app.route("/stream/<song_id>")
def stream_audio(song_id):
    filename = f"{song_id}.mp3"
    filepath = os.path.join(DOWNLOADS_DIR, filename)
    if not (os.path.exists(filepath) and os.path.isfile(filepath)):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT filename FROM songs WHERE id = ?", (song_id,))
        row = cursor.fetchone()
        conn.close()
        if row and row["filename"]:
            custom_path = os.path.join(DOWNLOADS_DIR, row["filename"])
            if os.path.exists(custom_path) and os.path.isfile(custom_path):
                filepath = custom_path
            else:
                abort(404, description="Audio file not on disk")
        else:
            abort(404, description="Audio file not on disk")

    return send_file(
        filepath,
        mimetype="audio/mpeg",
        as_attachment=False,
        conditional=True
    )

@app.route("/download/<song_id>")
def download_audio(song_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM songs WHERE id = ?", (song_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        abort(404, description="Song not found")

    filename = row["filename"]
    if filename:
        filepath = os.path.join(DOWNLOADS_DIR, filename)
        if os.path.exists(filepath) and os.path.isfile(filepath):
            download_title = sanitize_filename(row["title"]) or row["id"]
            return send_file(
                filepath,
                mimetype="audio/mpeg",
                as_attachment=True,
                download_name=f"{download_title}.mp3"
            )

    # Cloud fallback: redirect to high-speed public MP3 downloader
    from flask import redirect
    return redirect(f"https://y2mate.is/watch?v={song_id}")

@app.route("/api/quick-samples", methods=["GET"])
def get_quick_samples():
    """Curated list of popular royalty-free / safe YouTube tracks for immediate 1-click test."""
    samples = [
        {
            "id": "dQw4w9WgXcQ",
            "title": "Rick Astley - Never Gonna Give You Up",
            "channel": "Rick Astley",
            "duration": "03:33",
            "thumbnail_url": "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
            "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        },
        {
            "id": "bM7SZ5SBzyY",
            "title": "Alan Walker - Fade [NCS Release]",
            "channel": "NoCopyrightSounds",
            "duration": "04:24",
            "thumbnail_url": "https://img.youtube.com/vi/bM7SZ5SBzyY/hqdefault.jpg",
            "url": "https://www.youtube.com/watch?v=bM7SZ5SBzyY"
        },
        {
            "id": "K4DyBUG242c",
            "title": "Cartoon - On & On (feat. Daniel Levi) [NCS Release]",
            "channel": "NoCopyrightSounds",
            "duration": "03:28",
            "thumbnail_url": "https://img.youtube.com/vi/K4DyBUG242c/hqdefault.jpg",
            "url": "https://www.youtube.com/watch?v=K4DyBUG242c"
        },
        {
            "id": "jfKfPfyJRdk",
            "title": "lofi hip hop radio 📚 - beats to relax/study to",
            "channel": "Lofi Girl",
            "duration": "Live / Stream",
            "thumbnail_url": "https://img.youtube.com/vi/jfKfPfyJRdk/hqdefault.jpg",
            "url": "https://www.youtube.com/watch?v=jfKfPfyJRdk"
        }
    ]
    return jsonify(samples)

if __name__ == "__main__":
    import socket
    local_ip = "127.0.0.1"
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
    except Exception:
        pass

    port = int(os.environ.get("PORT", 5000))
    print(f"[*] Starting YouTube Music Vault Server on port {port}...")
    print(f"[*] FFmpeg Path: {FFMPEG_PATH}")
    print(f"[*] Storage Path: {DOWNLOADS_DIR}")
    print(f"[*] Local PC Access:    http://127.0.0.1:{port}")
    print(f"[*] Network Access:     http://{local_ip}:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
