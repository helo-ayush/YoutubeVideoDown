import os
import threading
import uuid
import re
import concurrent.futures
import time
import requests
from flask import Flask, request, jsonify, send_from_directory, Response
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import yt_dlp

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
CORS(app)
# Use 'threading' async_mode for standard OS threads (avoids DNS patching issues)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# Concurrency Control
MAX_CONCURRENT_DOWNLOADS = 5
# Use native threading Semaphore
download_semaphore = threading.Semaphore(MAX_CONCURRENT_DOWNLOADS)

DOWNLOAD_FOLDER = 'downloads'
if os.path.exists(DOWNLOAD_FOLDER):
    try:
        # Clear folder on startup
        for f in os.listdir(DOWNLOAD_FOLDER):
            full_path = os.path.join(DOWNLOAD_FOLDER, f)
            if os.path.isfile(full_path):
                os.remove(full_path)
    except Exception as e:
        print(f"Error clearing cache: {e}")
else:
    os.makedirs(DOWNLOAD_FOLDER)

def sanitize_filename(filename):
    """Remove or replace characters that cause issues in URLs and filesystems"""
    # Keep only ASCII alphanumeric, spaces, dots, hyphens, underscores
    sanitized = re.sub(r'[^\w\s\-\.]', '', filename, flags=re.ASCII)
    sanitized = re.sub(r'\s+', ' ', sanitized)
    sanitized = sanitized.strip()[:200]
    return sanitized if sanitized else 'video'

def get_opts(task_id, format_id='best'):
    if isinstance(format_id, int):
        fmt = f"bestvideo[height<={format_id}]+bestaudio/best[height<={format_id}]"
        postprocessors = []
    elif format_id == 'audio':
        fmt = 'bestaudio/best'
        postprocessors = []
    else:
        fmt = format_id
        postprocessors = []

    opts = {
        'format': fmt,
        'outtmpl': os.path.join(DOWNLOAD_FOLDER, '%(title)s.%(ext)s'),
        'progress_hooks': [lambda d: progress_hook(d, task_id)],
        'quiet': True,
        'noplaylist': True,
        'nocolor': True,
        'force_ipv4': True,
        'extractor_args': {'youtube': {'player_client': ['android', 'web']}},  # Bypass bot detection
    }
    
    if format_id != 'audio':
        opts['merge_output_format'] = 'mp4'
    
    if postprocessors:
        opts['postprocessors'] = postprocessors
        
    return opts

def optimize_video(file_path, task_id):
    """
    Manually optimize video with ffmpeg for better seeking performance.
    """
    try:
        if not os.path.exists(file_path):
            print(f"File not found for optimization: {file_path}")
            return file_path
        
        base, ext = os.path.splitext(file_path)
        temp_output = f"{base}_optimized{ext}"
        
        socketio.emit('progress', {
            'taskId': task_id,
            'status': 'optimizing',
            'progress': 100,
            'message': 'Optimizing for smooth playback...'
        })
        
        cmd = [
            'ffmpeg',
            '-i', file_path,
            '-c', 'copy',
            '-movflags', '+faststart',
            '-y',
            temp_output
        ]
        
        print(f"Optimizing: {os.path.basename(file_path)}")
        import subprocess
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0 and os.path.exists(temp_output):
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
                os.rename(temp_output, file_path)
                print(f"Optimization complete: {os.path.basename(file_path)}")
                return file_path
            except Exception as rename_error:
                print(f"Optimization rename failed: {rename_error}")
                if os.path.exists(temp_output):
                    return temp_output
                return file_path
        else:
            print(f"FFmpeg error: {result.stderr}")
            if os.path.exists(temp_output):
                os.remove(temp_output)
            return file_path
            
    except Exception as e:
        print(f"Optimization error: {e}")
        return file_path

def progress_hook(d, task_id):
    if task_control.get(task_id, {}).get('abort'):
        raise Exception("Download Aborted by User")

    try:
        if d['status'] == 'downloading':
            p_str = d.get('_percent_str', '0%')
            p_str = re.sub(r'\x1b\[[0-9;]*m', '', p_str).replace('%', '')
            try:
                progress = float(p_str)
            except ValueError:
                progress = 0

            speed = d.get('_speed_str', 'N/A')
            speed = re.sub(r'\x1b\[[0-9;]*m', '', speed) if speed else 'N/A'
            
            eta = d.get('_eta_str', 'N/A')
            eta = re.sub(r'\x1b\[[0-9;]*m', '', eta) if eta else 'N/A'
            
            filename = os.path.basename(d.get('filename', ''))
            title = d.get('info_dict', {}).get('title')
            
            downloaded = d.get('downloaded_bytes', 0)
            total = d.get('total_bytes') or d.get('total_bytes_estimate', 0)

            socketio.emit('progress', {
                'taskId': task_id,
                'progress': progress,
                'speed': speed,
                'eta': eta,
                'status': 'downloading',
                'filename': filename,
                'title': title,
                'downloaded_bytes': downloaded,
                'total_bytes': total
            })
            # time.sleep not needed here as hook is called synchronously by yt-dlp

        elif d['status'] == 'finished':
            original_file = d.get('filename')
            if original_file and os.path.exists(original_file):
                base_name = os.path.basename(original_file)
                name, ext = os.path.splitext(base_name)
                sanitized_name = sanitize_filename(name) + ext
                new_path = os.path.join(DOWNLOAD_FOLDER, sanitized_name)
                
                if original_file != new_path:
                    counter = 1
                    while os.path.exists(new_path):
                        sanitized_name = f"{sanitize_filename(name)}_{counter}{ext}"
                        new_path = os.path.join(DOWNLOAD_FOLDER, sanitized_name)
                        counter += 1
                    
                    try:
                        os.rename(original_file, new_path)
                        print(f"Renamed: {base_name} -> {sanitized_name}")
                    except Exception as rename_err:
                        print(f"Rename error: {rename_err}")
                        sanitized_name = base_name
                        new_path = original_file
                
                final_path = optimize_video(new_path, task_id)
                final_filename = os.path.basename(final_path)
                
                socketio.emit('progress', {
                    'taskId': task_id,
                    'progress': 100,
                    'status': 'finished',
                    'filename': final_filename,
                    'title': d.get('info_dict', {}).get('title')
                })
            else:
                socketio.emit('progress', {
                    'taskId': task_id,
                    'progress': 100,
                    'status': 'finished',
                    'filename': os.path.basename(d.get('filename', 'download.mp4'))
                })
    except Exception as e:
        print(f"Hook Error: {e}")

@app.route('/api/info', methods=['POST'])
def get_info():
    url = request.json.get('url')
    page = request.json.get('page', 1)
    filter_tab = request.json.get('tab', 'videos')
    PAGE_SIZE = 50
    
    if not url:
        return jsonify({'error': 'URL is required'}), 400

    base_url = url.split('/videos')[0].split('/shorts')[0].split('/streams')[0]
    final_url = base_url
    is_playlist = 'list=' in url or 'playlist' in url

    if not is_playlist:
        if filter_tab == 'videos':
            final_url = f"{base_url}/videos"
        elif filter_tab == 'shorts':
            final_url = f"{base_url}/shorts"
    
    try:
        start_index = (page - 1) * PAGE_SIZE + 1
        end_index = page * PAGE_SIZE
        
        ydl_opts = {
            'quiet': True,
            'extract_flat': 'in_playlist',
            'nocolor': True,
            'playliststart': start_index,
            'playlistend': end_index,
            'force_ipv4': True,
            'extractor_args': {'youtube': {'player_client': ['android', 'web']}},
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(final_url, download=False)
            
            if 'entries' in info:
                entries = [e for e in info['entries'] if e]
                if is_playlist:
                    filtered_entries = []
                    for e in entries:
                        v_url = e.get('url') or e.get('webpage_url') or f"https://www.youtube.com/watch?v={e.get('id')}"
                        is_short = '/shorts/' in (v_url or '')
                        
                        if filter_tab == 'shorts' and is_short:
                            filtered_entries.append(e)
                        elif filter_tab == 'videos' and not is_short:
                            filtered_entries.append(e)
                    entries = filtered_entries

                videos = []
                for e in entries:
                    v_id = e.get('id')
                    v_url = e.get('url') or e.get('webpage_url')
                    if not v_url and v_id:
                        v_url = f"https://www.youtube.com/watch?v={v_id}"
                    
                    thumbnail = None
                    thumbnails = e.get('thumbnails')
                    if thumbnails and len(thumbnails) > 0:
                        thumbnail = thumbnails[-1].get('url')
                    elif e.get('thumbnail'):
                        thumbnail = e.get('thumbnail')
                    elif v_id:
                        thumbnail = f"https://i.ytimg.com/vi/{v_id}/hqdefault.jpg"
                        
                    videos.append({
                        'id': v_id,
                        'title': e.get('title'),
                        'duration': e.get('duration'),
                        'thumbnail': thumbnail,
                        'url': v_url,
                        'is_short': '/shorts/' in (v_url or ''),
                        'max_height': 0
                    })
                
                stats = {'2160p': 0, '1440p': 0, '1080p': 0, '720p': 0, '480p': 0}

                return jsonify({
                    'type': 'playlist' if is_playlist else 'channel',
                    'title': info.get('title'),
                    'url': base_url,
                    'current_tab': filter_tab,
                    'videos': videos,
                    'stats': stats,
                    'page': page,
                    'has_more': len(entries) == PAGE_SIZE
                })
            else:
                with yt_dlp.YoutubeDL({
                    'quiet': True,
                    'nocolor': True,
                    'force_ipv4': True,
                    'extractor_args': {'youtube': {'player_client': ['android', 'web']}}
                }) as ydl_single:
                    info = ydl_single.extract_info(url, download=False)
                
                formats = []
                seen_res = set()
                for f in info.get('formats', []):
                     if f.get('ext') == 'mp4' and f.get('height'):
                        res = f"{f['height']}p"
                        if res not in seen_res:
                            formats.append({
                                'format_id': f['format_id'],
                                'resolution': res,
                                'ext': f['ext'],
                                'filesize_approx': f.get('filesize_approx'),
                            })
                            seen_res.add(res)
                
                formats.append({
                    'format_id': 'audio',
                    'resolution': 'Audio Only',
                    'ext': 'webm',
                    'filesize_approx': None, 
                })

                formats.sort(key=lambda x: int(x['resolution'][:-1]) if x['resolution'][0].isdigit() else -1, reverse=True)

                return jsonify({
                    'type': 'video',
                    'title': info.get('title'),
                    'thumbnail': info.get('thumbnail'),
                    'duration': info.get('duration'),
                    'formats': formats,
                    'original_url': url
                })

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/download', methods=['POST'])
def download():
    data = request.json
    url = data.get('url')
    format_id = data.get('format_id', 'best')
    
    task_id = str(uuid.uuid4())
    sid = data.get('sid')
    
    if sid and sid in client_tasks:
        client_tasks[sid].append(task_id)
    task_control[task_id] = {'abort': False}
    
    def download_task(tid, link, fmt):
        try:
            print(f"Starting download for {tid}")
            if task_control.get(tid, {}).get('abort'):
                return

            opts = get_opts(tid, fmt)
            with yt_dlp.YoutubeDL(opts) as ydl:
                ydl.download([link])
            socketio.emit('complete', {'taskId': tid})
            print(f"Completed download for {tid}")
        except Exception as e:
            if "Aborted" in str(e):
                print(f"Task {tid} aborted")
            else:
                print(f"Download Error: {e}")
                socketio.emit('error', {'taskId': tid, 'error': str(e)})
        finally:
             if tid in task_control:
                 del task_control[tid]

    # Use native threading instead of socketio.start_background_task for gunicorn compatibility
    thread = threading.Thread(target=download_task, args=(task_id, url, format_id), daemon=True)
    thread.start()
    return jsonify({'taskId': task_id, 'status': 'started'})

@app.route('/api/batch_formats', methods=['POST'])
def batch_formats():
    data = request.json
    urls = data.get('urls', [])
    
    if not urls:
        return jsonify({'error': 'No URLs provided'}), 400
    
    # Simple direct function
    def fetch_max_resolution(url):
        try:
            opts = {
                'quiet': True,
                'nocolor': True,
                'noplaylist': True,
                'extract_flat': False,
                'skip_download': True,
                'skip_download': True,
                'extractor_args': {'youtube': {'player_client': ['android']}},
                'force_ipv4': True,
            }
            # No tpool! Running in thread pool executor
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=False)
            
            max_height = 0
            for fmt in info.get('formats', []):
                if fmt.get('height') and fmt.get('vcodec') != 'none':
                    max_height = max(max_height, fmt['height'])
            
            resolution_label = 'Unknown'
            if max_height >= 2160: resolution_label = '4K'
            elif max_height >= 1440: resolution_label = '2K'
            elif max_height >= 1080: resolution_label = '1080p'
            elif max_height >= 720: resolution_label = '720p'
            elif max_height >= 480: resolution_label = '480p'
            elif max_height > 0: resolution_label = '360p'
            
            # Artificial delay to prove async works? No.
            return {
                'url': url,
                'maxHeight': max_height,
                'maxResolution': resolution_label
            }
        except Exception as e:
            print(f"Error fetching formats for {url}: {e}")
            return {
                'url': url,
                'maxHeight': 0,
                'maxResolution': 'Unknown',
                'error': str(e)
            }
    
    # Use standard ThreadPoolExecutor instead of Eventlet GreenPool
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        results = list(executor.map(fetch_max_resolution, urls))
    
    return jsonify({'formats': results})

@app.route('/api/batch_download', methods=['POST'])
def batch_download():
    data = request.json
    urls = data.get('urls', [])
    quality_cap = data.get('quality_cap', None)
    
    task_ids = []
    sid = data.get('sid')
    
    for url in urls:
        task_id = str(uuid.uuid4())
        task_ids.append(task_id)
        
        if sid and sid in client_tasks:
            client_tasks[sid].append(task_id)
        task_control[task_id] = {'abort': False}
        
        def download_task(tid, link, q_cap):
            socketio.emit('progress', {'taskId': tid, 'status': 'queued', 'progress': 0})
            
            with download_semaphore:
                if task_control.get(tid, {}).get('abort'):
                    print(f"Task {tid} aborted before start")
                    return

                try:
                    fmt = q_cap if q_cap else 'best'
                    opts = get_opts(tid, fmt)
                    
                    with yt_dlp.YoutubeDL(opts) as ydl:
                        ydl.download([link])
                    socketio.emit('complete', {'taskId': tid})
                except Exception as e:
                    if "Aborted" in str(e):
                        print(f"Task {tid} aborted properly")
                    else:
                        socketio.emit('error', {'taskId': tid, 'error': str(e)})
                finally:
                    if tid in task_control:
                        del task_control[tid]

        # Use native threading for gunicorn compatibility
        thread = threading.Thread(target=download_task, args=(task_id, url, quality_cap), daemon=True)
        thread.start()

    return jsonify({'taskIds': task_ids, 'status': 'batch_started'})

# Track active tasks per socket to cancel them on disconnect
client_tasks = {} # sid -> [task_ids]
task_control = {} # task_id -> {'abort': False}

@socketio.on('connect')
def handle_connect():
    client_tasks[request.sid] = []

@socketio.on('disconnect')
def handle_disconnect():
    sid = request.sid
    print(f"Client disconnected: {sid}")
    if sid in client_tasks:
        for tid in client_tasks[sid]:
             if tid in task_control:
                 task_control[tid]['abort'] = True
                 print(f"Marked task {tid} for abortion")
        del client_tasks[sid]

@app.route('/api/stream', methods=['GET'])
def stream_video():
    url = request.args.get('url')
    format_id = request.args.get('format_id', 'best')
    task_id = request.args.get('taskId', str(uuid.uuid4()))
    sid = request.args.get('sid')
    
    if not url:
        return jsonify({'error': 'URL is required'}), 400

    try:
        # High-Speed Proxy Strategy (Thread Compatible)
        with yt_dlp.YoutubeDL({
            'quiet': True,
            'format': format_id,
            'force_ipv4': True,
            'extractor_args': {'youtube': {'player_client': ['android', 'web']}}
        }) as ydl:
            info = ydl.extract_info(url, download=False)
            playback_url = info.get('url')
            title = sanitize_filename(info.get('title', 'video'))
            ext = info.get('ext', 'mp4')
            filename = f"{title}.{ext}"

        if not playback_url:
             raise Exception("No direct playback URL found")

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Referer': 'https://www.youtube.com/',
        }
        
        req = requests.get(playback_url, stream=True, headers=headers)
        total_size = int(req.headers.get('Content-Length', 0))
        
        if sid and sid in client_tasks:
            client_tasks[sid].append(task_id)
        task_control[task_id] = {'abort': False}

        last_emit_time = 0

        def generate_proxy():
            nonlocal last_emit_time
            downloaded = 0
            try:
                socketio.emit('progress', {
                    'taskId': task_id,
                    'status': 'downloading',
                    'progress': 0,
                    'title': title,
                    'filename': filename,
                    'total_bytes': total_size
                })
                
                chunk_size = 4 * 1024 * 1024 
                
                for chunk in req.iter_content(chunk_size=chunk_size):
                    if task_control.get(task_id, {}).get('abort'):
                        break
                        
                    if chunk:
                        downloaded += len(chunk)
                        yield chunk
                        
                        current_time = time.time()
                        if current_time - last_emit_time > 0.5:
                            if total_size > 0:
                                percent = (downloaded / total_size) * 100
                                socketio.emit('progress', {
                                    'taskId': task_id,
                                    'progress': percent,
                                    'status': 'downloading',
                                    'downloaded_bytes': downloaded,
                                    'total_bytes': total_size,
                                    'title': title
                                })
                                last_emit_time = current_time
                            # time.sleep not needed, blocking IO is fine in generator thread
            finally:
                req.close()
                socketio.emit('progress', {'taskId': task_id, 'progress': 100, 'status': 'finished'})

        return Response(generate_proxy(), headers={
            'Content-Disposition': f'attachment; filename="{filename}"',
            'Content-Type': req.headers.get('Content-Type', 'application/octet-stream'),
            'Content-Length': total_size
        })

    except Exception as e:
        print(f"Proxy Error: {e}")
        return jsonify({'error': f"Streaming failed: {str(e)}"}), 500

@app.route('/api/file/<path:filename>')
def serve_file(filename):
    try:
        from urllib.parse import unquote
        decoded_filename = unquote(filename)
        file_path = os.path.join(DOWNLOAD_FOLDER, decoded_filename)
        
        if not os.path.exists(file_path):
            return jsonify({'error': f'File not found: {decoded_filename}'}), 404
        
        def generate():
            with open(file_path, 'rb') as f:
                while True:
                    chunk = f.read(4096 * 64)
                    if not chunk: break
                    yield chunk
            try:
                os.remove(file_path)
            except: pass

        return Response(generate(), headers={
            'Content-Disposition': f'attachment; filename="{decoded_filename}"',
            'Content-Type': 'application/octet-stream'
        })

    except Exception as e:
        print(f"File serve error: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    def cleanup_loop():
        while True:
            time.sleep(300)
            try:
                now = time.time()
                for f in os.listdir(DOWNLOAD_FOLDER):
                    fp = os.path.join(DOWNLOAD_FOLDER, f)
                    if os.path.isfile(fp):
                        if now - os.path.getmtime(fp) > 3600:
                            os.remove(fp)
            except: pass
    
    # Use native threading for cleanup
    threading.Thread(target=cleanup_loop, daemon=True).start()
    socketio.run(app, debug=True, port=5000)
