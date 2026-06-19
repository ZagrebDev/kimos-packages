import os
import json
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

# Input and output paths
INPUT_FILE = '/home/jose/.gemini/antigravity/brain/671ba82b-162d-40f5-a727-0b2ff360aa58/.system_generated/steps/48/output.txt'
OUTPUT_DIR = '/home/jose/proyectos/triatlon'
JSON_OUTPUT_PATH = os.path.join(OUTPUT_DIR, 'participantes.json')
FOTOS_DIR = os.path.join(OUTPUT_DIR, 'fotos')
BANDERAS_DIR = os.path.join(OUTPUT_DIR, 'banderas')

# Create output directories
os.makedirs(FOTOS_DIR, exist_ok=True)
os.makedirs(BANDERAS_DIR, exist_ok=True)

# Helper to determine file extension
def get_extension(content_type, data=None):
    if content_type:
        content_type = content_type.lower()
        if 'svg' in content_type:
            return 'svg'
        if 'png' in content_type:
            return 'png'
        if 'jpeg' in content_type or 'jpg' in content_type:
            return 'jpg'
        if 'gif' in content_type:
            return 'gif'
        if 'webp' in content_type:
            return 'webp'
            
    if data and len(data) > 4:
        if data.startswith(b'GIF89a') or data.startswith(b'GIF87a'):
            return 'gif'
        if data.startswith(b'\x89PNG\r\n\x1a\n'):
            return 'png'
        if data.startswith(b'\xff\xd8\xff'):
            return 'jpg'
        if data.startswith(b'RIFF') and data[8:12] == b'WEBP':
            return 'webp'
        # Check if it looks like SVG XML
        try:
            snippet = data[:200].decode('utf-8', errors='ignore').lower()
            if '<svg' in snippet:
                return 'svg'
        except Exception:
            pass
            
    return 'png'

# Read the raw output
print("Reading raw input file...")
with open(INPUT_FILE, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Line 3 is the JSON string (index 2)
json_str = lines[2].strip()
data = json.loads(json_str)

# We will collect unique profile image downloads and unique flag downloads
# Format: url -> (local_dir, base_filename, default_ext)
downloads = {}

# Map to store the final relative path for each URL after download
url_to_relative_path = {}

# Keep track of NOC flags to download
noc_flags = {} # noc -> url

print("Analyzing participants and flags...")
for program in data.get("start_lists", []):
    start_list = program.get("start_list", {}).get("entries", [])
    wait_list = program.get("wait_list", {}).get("entries", [])
    
    for entry in start_list + wait_list:
        noc = entry.get("athlete_noc")
        flag_url = entry.get("athlete_flag_circle")
        profile_url = entry.get("athlete_profile_image")
        slug = entry.get("athlete_slug")
        athlete_id = entry.get("athlete_id")
        
        # Collect flag info
        if noc and flag_url:
            noc_flags[noc] = flag_url
            
        # Collect profile image info
        if profile_url:
            # unique key: profile_url
            filename_base = f"{slug}_{athlete_id}" if slug else f"athlete_{athlete_id}"
            downloads[profile_url] = {
                'dir': FOTOS_DIR,
                'rel_dir': 'fotos',
                'base': filename_base,
                'type': 'photo'
            }

# Add flag downloads to the queue
for noc, url in noc_flags.items():
    downloads[url] = {
        'dir': BANDERAS_DIR,
        'rel_dir': 'banderas',
        'base': noc.upper(),
        'type': 'flag'
    }

print(f"Total downloads planned: {len(downloads)} ({len(noc_flags)} flags, {len(downloads) - len(noc_flags)} photos)")

# Download function
def download_file(url, info):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            content_type = response.headers.get('Content-Type')
            file_data = response.read()
            
            ext = get_extension(content_type, file_data)
            filename = f"{info['base']}.{ext}"
            filepath = os.path.join(info['dir'], filename)
            
            with open(filepath, 'wb') as out_f:
                out_f.write(file_data)
                
            relative_path = f"{info['rel_dir']}/{filename}"
            return url, relative_path, None
    except Exception as e:
        return url, None, str(e)

# Execute downloads in parallel
print("Starting downloads...")
completed = 0
failed_urls = {}

with ThreadPoolExecutor(max_workers=10) as executor:
    futures = {executor.submit(download_file, url, info): url for url, info in downloads.items()}
    
    for future in as_completed(futures):
        url = futures[future]
        try:
            url, rel_path, err = future.result()
            if err:
                failed_urls[url] = err
                print(f"[-] Failed to download {url}: {err}")
            else:
                url_to_relative_path[url] = rel_path
                completed += 1
                if completed % 10 == 0 or completed == len(downloads):
                    print(f"[+] Downloaded {completed}/{len(downloads)} assets")
        except Exception as e:
            failed_urls[url] = str(e)
            print(f"[-] Exception downloading {url}: {e}")

print(f"Downloads completed: {completed}. Failed: {len(failed_urls)}.")

# Update the JSON document with relative paths
print("Updating JSON structure...")
for program in data.get("start_lists", []):
    start_list = program.get("start_list", {}).get("entries", [])
    wait_list = program.get("wait_list", {}).get("entries", [])
    
    for entry in start_list + wait_list:
        # Update profile image path
        profile_url = entry.get("athlete_profile_image")
        if profile_url:
            entry["athlete_profile_image_original"] = profile_url
            entry["athlete_profile_image"] = url_to_relative_path.get(profile_url)
        else:
            entry["athlete_profile_image_original"] = None
            entry["athlete_profile_image"] = None

        # Update flag path
        flag_url = entry.get("athlete_flag_circle")
        if flag_url:
            entry["athlete_flag_circle_original"] = flag_url
            entry["athlete_flag_circle"] = url_to_relative_path.get(flag_url)
        else:
            entry["athlete_flag_circle_original"] = None
            entry["athlete_flag_circle"] = None

# Save the updated JSON
print(f"Saving final JSON to {JSON_OUTPUT_PATH}...")
with open(JSON_OUTPUT_PATH, 'w', encoding='utf-8') as out_json:
    json.dump(data, out_json, indent=2, ensure_ascii=False)

print("Done! Everything processed successfully.")
