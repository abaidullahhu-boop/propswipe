# Property-Swipe

## Video uploads

Video processing uses **FFmpeg**. If you see `spawn ffmpeg ENOENT`:

- Install FFmpeg (e.g. `winget install -e --id Gyan.FFmpeg`) and add it to your system PATH, **or**
- Set the path to the executables in `.env`:
  - `FFMPEG_PATH=C:\path\to\ffmpeg.exe`
  - `FFPROBE_PATH=C:\path\to\ffprobe.exe`
- Restart the server after installing or changing `.env`.
