import eventlet
eventlet.monkey_patch()

import os
import threading
import uuid
import re
import concurrent.futures
from flask import Flask, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import yt_dlp

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# Concurrency Control
MAX_CONCURRENT_DOWNLOADS = 5
download_semaphore = eventlet.Semaphore(MAX_CONCURRENT_DOWNLOADS)

DOWNLOAD_FOLDER = 'downloads'
if os.path.exists(DOWNLOAD_FOLDER):
    try:
        # Clear folder on startup
        for f in os.listdir(DOWNLOAD_FOLDER):
            os.path.join(DOWNLOAD_FOLDER, f)
            # os.remove(os.path.join(DOWNLOAD_FOLDER, f)) # Commented out for safety during dev, uncomment in prod
            # The user explicitly asked for this, so I should probably keep it enabled or ensure I don't delete useful things.
            # actually I will re-enable it as per user request in previous turn
            full_path = os.path.join(DOWNLOAD_FOLDER, f)
            if os.path.isfile(full_path):
                os.remove(full_path)
    except Exception as e:
        print(f"Error clearing cache: {e}")
else:
    os.makedirs(DOWNLOAD_FOLDER)

def sanitize_filename(filename):
    """Remove or replace characters that cause issues in URLs and filesystems"""
    # Remove emojis and other problematic unicode characters
    import re
    # Keep only ASCII alphanumeric, spaces, dots, hyphens, underscores
    sanitized = re.sub(r'[^\w\s\-\.]', '', filename, flags=re.ASCII)
    # Replace multiple spaces with single space
    sanitized = re.sub(r'\s+', ' ', sanitized)
    # Trim and limit length
    sanitized = sanitized.strip()[:200]
    return sanitized if sanitized else 'video'

def get_opts(task_id, format_id='best'):
    # If format_id is an integer (quality cap), convert to format string
    # If format_id is an integer (quality cap), convert to format string
    if isinstance(format_id, int):
        fmt = f"bestvideo[height<={format_id}]+bestaudio/best[height<={format_id}]"
        postprocessors = []
    elif format_id == 'audio':
        # Audio extraction configuration (Best Audio - usually WebM/Opus)
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
    }
    
    if format_id != 'audio':
        opts['merge_output_format'] = 'mp4'
    
    if postprocessors:
        opts['postprocessors'] = postprocessors
        
    return opts

def progress_hook(d, task_id):
    """
    Robust progress hook that safely emits socket events.
    """
    try:
        if d['status'] == 'downloading':
            # Safe extraction of percentage
            p_str = d.get('_percent_str', '0%')
            p_str = re.sub(r'\x1b\[[0-9;]*m', '', p_str).replace('%', '')
            try:
                progress = float(p_str)
            except ValueError:
                progress = 0

            # Safe extraction of speed and ETA
            speed = d.get('_speed_str', 'N/A')
            speed = re.sub(r'\x1b\[[0-9;]*m', '', speed) if speed else 'N/A'
            
            eta = d.get('_eta_str', 'N/A')
            eta = re.sub(r'\x1b\[[0-9;]*m', '', eta) if eta else 'N/A'
            
            filename = os.path.basename(d.get('filename', ''))
            
            # Try to get the real title
            title = d.get('info_dict', {}).get('title')
            
            socketio.emit('progress', {
                'taskId': task_id,
                'progress': progress,
                'speed': speed,
                'eta': eta,
                'status': 'downloading',
                'filename': filename,
                'title': title
            })
            # Yield to eventlet to ensure the emit goes out
            eventlet.sleep(0)

        elif d['status'] == 'finished':
            original_file = d.get('filename')
            if original_file and os.path.exists(original_file):
                # Sanitize the filename
                base_name = os.path.basename(original_file)
                name, ext = os.path.splitext(base_name)
                sanitized_name = sanitize_filename(name) + ext
                
                new_path = os.path.join(DOWNLOAD_FOLDER, sanitized_name)
                
                # Handle duplicate names
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
                        sanitized_name = base_name  # Fallback to original
                        new_path = original_file
                
                # Optimize video for better seeking
                final_path = optimize_video(new_path, task_id)
                final_filename = os.path.basename(final_path)
                
                # Emit with sanitized filename
                socketio.emit('progress', {
                    'taskId': task_id,
                    'progress': 100,
                    'status': 'finished',
                    'filename': final_filename,
                    'title': d.get('info_dict', {}).get('title')
                })
            else:
                # Fallback if file path not available
                socketio.emit('progress', {
                    'taskId': task_id,
                    'progress': 100,
                    'status': 'finished',
                    'filename': os.path.basename(d.get('filename', 'download.mp4'))
                })
    except Exception as e:
        print(f"Hook Error: {e}")

def optimize_video(file_path, task_id):
    """
    Manually optimize video with ffmpeg for better seeking performance.
    Uses faststart flag to move moov atom to beginning of file.
    """
    try:
        if not os.path.exists(file_path):
            print(f"File not found for optimization: {file_path}")
            return file_path
        
        # Create temp output path
        base, ext = os.path.splitext(file_path)
        temp_output = f"{base}_optimized{ext}"
        
        # Emit status update
        socketio.emit('progress', {
            'taskId': task_id,
            'status': 'optimizing',
            'progress': 100,
            'message': 'Optimizing for smooth playback...'
        })
        
        # Run ffmpeg to optimize
        import subprocess
        cmd = [
            'ffmpeg',
            '-i', file_path,
            '-c', 'copy',  # Copy streams without re-encoding
            '-movflags', '+faststart',  # Move metadata to start
            '-y',  # Overwrite output
            temp_output
        ]
        
        print(f"Optimizing: {os.path.basename(file_path)}")
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0 and os.path.exists(temp_output):
            # Replace original with optimized version
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
                os.rename(temp_output, file_path)
                print(f"Optimization complete: {os.path.basename(file_path)}")
                return file_path
            except Exception as rename_error:
                print(f"Optimization rename failed: {rename_error}")
                # If rename failed, check if we have the optimized file at least
                if os.path.exists(temp_output):
                    return temp_output
                return file_path
        else:
            print(f"FFmpeg error: {result.stderr}")
            # Clean up temp file if it exists
            if os.path.exists(temp_output):
                os.remove(temp_output)
            return file_path
            
    except Exception as e:
        print(f"Optimization error: {e}")
        return file_path

def progress_hook(d, task_id):
    """
    Robust progress hook that safely emits socket events.
    Checks for abort flag to stop download.
    """
    # Check for abortion
    if task_control.get(task_id, {}).get('abort'):
        raise Exception("Download Aborted by User")

    try:
        if d['status'] == 'downloading':
            # Safe extraction of percentage
            p_str = d.get('_percent_str', '0%')
            p_str = re.sub(r'\x1b\[[0-9;]*m', '', p_str).replace('%', '')
            try:
                progress = float(p_str)
            except ValueError:
                progress = 0

            # Safe extraction of speed and ETA
            speed = d.get('_speed_str', 'N/A')
            if speed:
                speed = re.sub(r'\x1b\[[0-9;]*m', '', speed)
            else:
                speed = 'N/A'
            
            eta = d.get('_eta_str', 'N/A')
            if eta:
                eta = re.sub(r'\x1b\[[0-9;]*m', '', eta)
            else:
                eta = 'N/A'
            
            filename = os.path.basename(d.get('filename', ''))
            
            # Try to get the real title
            title = d.get('info_dict', {}).get('title')
            
            # Get size info
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
            # Yield to eventlet to ensure the emit goes out
            eventlet.sleep(0)

        elif d['status'] == 'finished':
            original_file = d.get('filename')
            if original_file and os.path.exists(original_file):
                # Sanitize the filename
                base_name = os.path.basename(original_file)
                name, ext = os.path.splitext(base_name)
                sanitized_name = sanitize_filename(name) + ext
                
                new_path = os.path.join(DOWNLOAD_FOLDER, sanitized_name)
                
                # Handle duplicate names
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
                        sanitized_name = base_name  # Fallback to original
                        new_path = original_file
                
                # Optimize video for better seeking
                final_path = optimize_video(new_path, task_id)
                final_filename = os.path.basename(final_path)
                
                # Emit with sanitized filename
                socketio.emit('progress', {
                    'taskId': task_id,
                    'progress': 100,
                    'status': 'finished',
                    'filename': final_filename,
                    'title': d.get('info_dict', {}).get('title')
                })
            else:
                # Fallback if file path not available
                socketio.emit('progress', {
                    'taskId': task_id,
                    'progress': 100,
                    'status': 'finished',
                    'filename': os.path.basename(d.get('filename', 'download.mp4'))
                })
    except Exception as e:
        print(f"Hook Error: {e}")


def postprocess_hook(d, task_id):
    """Rename downloaded file to sanitized version"""
    try:
        if d['status'] == 'finished':
            original_file = d.get('filepath') or d.get('filename')
            if original_file and os.path.exists(original_file):
                # Get sanitized filename
                base_name = os.path.basename(original_file)
                name, ext = os.path.splitext(base_name)
                sanitized_name = sanitize_filename(name) + ext
                
                new_path = os.path.join(DOWNLOAD_FOLDER, sanitized_name)
                
                # Rename if different
                if original_file != new_path:
                    # Handle duplicate names
                    counter = 1
                    while os.path.exists(new_path):
                        sanitized_name = f"{sanitize_filename(name)}_{counter}{ext}"
                        new_path = os.path.join(DOWNLOAD_FOLDER, sanitized_name)
                        counter += 1
                    
                    os.rename(original_file, new_path)
                    print(f"Renamed: {base_name} -> {sanitized_name}")
                    
                    # Update the socket event with sanitized filename
                    socketio.emit('progress', {
                        'taskId': task_id,
                        'filename': sanitized_name,
                        'status': 'finished',
                        'progress': 100
                    })
    except Exception as e:
        print(f"Postprocess Error: {e}")

def log_debug(msg):
    try:
        with open('debug.txt', 'a', encoding='utf-8') as f:
            f.write(f"{msg}\n")
    except:
        pass

def fetch_video_metadata(url):
    try:
        # log_debug(f"Fetching metadata for: {url}")
        with yt_dlp.YoutubeDL({'quiet': True, 'nocolor': True}) as ydl:
            return ydl.extract_info(url, download=False)
    except Exception as e:
        log_debug(f"Error fetching metadata for {url}: {e}")
        return None

@app.route('/api/info', methods=['POST'])
def get_info():
    url = request.json.get('url')
    # Pagination params
    page = request.json.get('page', 1)
    filter_tab = request.json.get('tab', 'videos') # videos or shorts (removed 'all')
    PAGE_SIZE = 50
    
    if not url:
        return jsonify({'error': 'URL is required'}), 400

    # Logic to handle tabs
    # First, strip any existing sub-path if we are switching tabs
    base_url = url.split('/videos')[0].split('/shorts')[0].split('/streams')[0]
    
    final_url = base_url
    is_playlist = 'list=' in url or 'playlist' in url

    if not is_playlist:
        # Only append /videos or /shorts for CHANNELS, not playlists
        if filter_tab == 'videos':
            final_url = f"{base_url}/videos"
        elif filter_tab == 'shorts':
            final_url = f"{base_url}/shorts"
    # For playlists, we use the URL as-is and filter entries later if needed
    
    try:
        # Calculate playlist range
        start_index = (page - 1) * PAGE_SIZE + 1
        end_index = page * PAGE_SIZE
        
        ydl_opts = {
            'quiet': True,
            'extract_flat': 'in_playlist', # Critical for speed
            'nocolor': True,
            'playliststart': start_index,
            'playlistend': end_index,
        }
        
        # log_debug(f"Fetching: {final_url} (Range: {start_index}-{end_index})")
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(final_url, download=False)
            
            if 'entries' in info:
                # Channel/Playlist
                entries = [e for e in info['entries'] if e]
                
                videos = []
                if is_playlist:
                    # Filter playlist entries based on tab
                    # Note: Pagination is based on raw playlist index, but we filter display items here.
                    # This means some pages might look empty if they only contain the other type.
                    # A better approach would be to fetch more and filter until we fill a page, but that's complex.
                    filtered_entries = []
                    for e in entries:
                        v_url = e.get('url') or e.get('webpage_url') or f"https://www.youtube.com/watch?v={e.get('id')}"
                        is_short = '/shorts/' in (v_url or '')
                        
                        if filter_tab == 'shorts' and is_short:
                            filtered_entries.append(e)
                        elif filter_tab == 'videos' and not is_short:
                            filtered_entries.append(e)
                    entries = filtered_entries
                else:
                    # For channels, the URL filtering already handled it, but let's be safe
                    pass

                videos = []
                for e in entries:
                    # Basic info available in flat extract
                    v_id = e.get('id')
                    v_url = e.get('url') or e.get('webpage_url')
                    if not v_url and v_id:
                        v_url = f"https://www.youtube.com/watch?v={v_id}"
                    
                    # Better thumbnail extraction
                    thumbnail = None
                    thumbnails = e.get('thumbnails')
                    if thumbnails and len(thumbnails) > 0:
                        # Try to get the highest quality thumbnail
                        thumbnail = thumbnails[-1].get('url')
                    elif e.get('thumbnail'):
                        # Fallback to direct thumbnail field
                        thumbnail = e.get('thumbnail')
                    elif v_id:
                        # Last resort: construct YouTube thumbnail URL
                        thumbnail = f"https://i.ytimg.com/vi/{v_id}/hqdefault.jpg"
                        
                    videos.append({
                        'id': v_id,
                        'title': e.get('title'),
                        'duration': e.get('duration'),
                        'thumbnail': thumbnail,
                        'url': v_url,
                        'is_short': '/shorts/' in (v_url or ''),
                        'max_height': 0 # Placeholder, we don't know yet
                    })
                
                # We return an empty stats object because fetching it is too slow
                stats = {'2160p': 0, '1440p': 0, '1080p': 0, '720p': 0, '480p': 0}

                return jsonify({
                    'type': 'playlist' if is_playlist else 'channel',
                    'title': info.get('title'),
                    'url': base_url,  # Return the CLEAN base URL so frontend can pivot tabs easily
                    'current_tab': filter_tab,
                    'videos': videos,
                    'stats': stats,
                    'page': page,
                    'has_more': len(entries) == PAGE_SIZE
                })
            else:
                # Single Video (Full Extract needed to get formats)
                # For single video, we MUST do full extract to show options
                # Re-run with full extract options
                with yt_dlp.YoutubeDL({'quiet': True, 'nocolor': True}) as ydl_single:
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
                
                
                # Add Audio Only option
                formats.append({
                    'format_id': 'audio',
                    'resolution': 'Audio Only',
                    'ext': 'webm', # Default is usually webm/opus
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
@app.route('/api/download', methods=['POST'])
def download():
    data = request.json
    url = data.get('url')
    format_id = data.get('format_id', 'best')
    
    task_id = str(uuid.uuid4())
    sid = data.get('sid') # Get socket ID from request body
    
    # Register task
    if sid and sid in client_tasks:
        client_tasks[sid].append(task_id)
    task_control[task_id] = {'abort': False}
    
    def download_task(tid, link, fmt):
        try:
            print(f"Starting download for {tid}")
            # Check abortion
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

    socketio.start_background_task(target=download_task, tid=task_id, link=url, fmt=format_id)
    
    return jsonify({'taskId': task_id, 'status': 'started'})

@app.route('/api/batch_formats', methods=['POST'])
def batch_formats():
    """Fetch max available resolution for multiple videos"""
    data = request.json
    urls = data.get('urls', [])
    
    if not urls:
        return jsonify({'error': 'No URLs provided'}), 400
    
    # Create a simplified function for tpool execution to avoid pickling issues
    def run_extraction(url_to_fetch, options):
        with yt_dlp.YoutubeDL(options) as ydl:
            return ydl.extract_info(url_to_fetch, download=False)

    def fetch_max_resolution(url):
        """Fetch max resolution for a single video"""
        try:
            opts = {
                'quiet': True,
                'nocolor': True,
                'noplaylist': True,
                'extract_flat': False,
                'skip_download': True,
                # Android client is fast and reliable
                'extractor_args': {'youtube': {'player_client': ['android']}},
            }
            
            # Use eventlet.tpool.execute to run the blocking yt-dlp call in a REAL thread
            # This prevents GreenThread blocking and allows true parallelism
            info = eventlet.tpool.execute(run_extraction, url, opts)
            
            # Find max height
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
    
    # Use GreenPool with tpool-wrapped functions
    # 20 concurrent checks is safe now because they are offloaded to real threads
    pool = eventlet.GreenPool(size=20)
    results = list(pool.imap(fetch_max_resolution, urls))
    
    return jsonify({'formats': results})

@app.route('/api/batch_download', methods=['POST'])
def batch_download():
    data = request.json
    urls = data.get('urls', [])
    quality_cap = data.get('quality_cap', None) # Integer (e.g., 1080) or None for best
    
    task_ids = []
    sid = data.get('sid') # Get socket ID from request body
    
    for url in urls:
        task_id = str(uuid.uuid4())
        task_ids.append(task_id)
        
        # Register task for this client
        if sid and sid in client_tasks:
            client_tasks[sid].append(task_id)
        task_control[task_id] = {'abort': False}
        
        def download_task(tid, link, q_cap):
            socketio.emit('progress', {'taskId': tid, 'status': 'queued', 'progress': 0})
            
            with download_semaphore:
                # Check abortion before starting
                if task_control.get(tid, {}).get('abort'):
                    print(f"Task {tid} aborted before start")
                    return

                try:
                    # Pass the quality_cap (int) or 'best' to get_opts
                    # get_opts will handle the string conversion
                    fmt = q_cap if q_cap else 'best'
                    
                    opts = get_opts(tid, fmt)
                    # Inject abort check into progress hook via closure isn't easy with get_opts separate.
                    # Instead, we rely on progress_hook checking task_control global.
                    
                    with yt_dlp.YoutubeDL(opts) as ydl:
                        ydl.download([link])
                    socketio.emit('complete', {'taskId': tid})
                except Exception as e:
                    if "Aborted" in str(e):
                        print(f"Task {tid} aborted properly")
                    else:
                        socketio.emit('error', {'taskId': tid, 'error': str(e)})
                finally:
                    # Cleanup tracking
                    if tid in task_control:
                        del task_control[tid]

        socketio.start_background_task(target=download_task, tid=task_id, link=url, q_cap=quality_cap)

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

@app.route('/api/file/<path:filename>')
def serve_file(filename):
    try:
        # URL decode the filename
        from urllib.parse import unquote
        decoded_filename = unquote(filename)
        
        # Check if file exists
        file_path = os.path.join(DOWNLOAD_FOLDER, decoded_filename)
        if not os.path.exists(file_path):
            return jsonify({'error': f'File not found: {decoded_filename}'}), 404
        
        # Generator to stream file and delete afterwards
        def generate():
            with open(file_path, 'rb') as f:
                while True:
                    chunk = f.read(4096 * 64) # 256KB chunks
                    if not chunk:
                        break
                    yield chunk
            
            # Delete file after streaming is complete
            try:
                os.remove(file_path)
                print(f"Cleaned up file: {decoded_filename}")
            except Exception as e:
                print(f"Error cleaning up file {decoded_filename}: {e}")

        from flask import Response
        # Use simple streaming response (Note: this might break range seeking for video players, 
        # but for 'save as' downloads it's fine and ensures deletion)
        return Response(generate(), headers={
            'Content-Disposition': f'attachment; filename="{decoded_filename}"',
            'Content-Type': 'application/octet-stream'
        })

    except Exception as e:
        print(f"File serve error: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Add simple background cleanup for old files (failsafe)
    def cleanup_loop():
        import time
        while True:
            eventlet.sleep(300) # Every 5 mins
            try:
                now = time.time()
                for f in os.listdir(DOWNLOAD_FOLDER):
                    fp = os.path.join(DOWNLOAD_FOLDER, f)
                    if os.path.isfile(fp):
                        # Delete files older than 1 hour
                        if now - os.path.getmtime(fp) > 3600:
                            os.remove(fp)
                            print(f"Cleanup loop removed: {f}")
            except Exception as e:
                print(f"Cleanup loop error: {e}")
    
    eventlet.spawn(cleanup_loop)
    
    # Listen on all interfaces
    socketio.run(app, debug=True, port=5000)
