"""Warm AnySplat HTTP server — the live QR demo.

Loads AnySplat ONCE at boot, then each upload reconstructs in seconds.

    source .venv-anysplat/bin/activate
    uv pip install fastapi "uvicorn[standard]" python-multipart   # one-time
    uvicorn app:app --host 0.0.0.0 --port 8008

Expose port 8008 on RunPod (HTTP service) and point a QR code at the proxy URL:
    https://<POD_ID>-8008.proxy.runpod.net
The page is phone-friendly (camera capture + multi-select). Upload a few photos
of the scene → a fly-through video comes back.

Watch-folder `serve.py` is the simpler alternative; this adds the upload UI.
"""

from __future__ import annotations

import shutil
import threading
import time
import traceback
from pathlib import Path

from fastapi import FastAPI, File, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

import anysplat_recon as ar

HERE = Path(__file__).resolve().parent
OUT = HERE / "outputs"
OUT.mkdir(exist_ok=True)


def log(msg: str) -> None:
    print(f"[app {time.strftime('%H:%M:%S')}] {msg}", flush=True)


app = FastAPI(title="OpenEyes — live reconstruction")
app.mount("/outputs", StaticFiles(directory=str(OUT)), name="outputs")

_model = None
_load_lock = threading.Lock()     # guards one-time model load
_infer_lock = threading.Lock()    # serializes GPU inference (one job at a time)


def get_model():
    """Load AnySplat once. Safe to call from many threads; loads under _load_lock."""
    global _model
    if _model is None:
        with _load_lock:
            if _model is None:        # double-checked: only the first caller loads
                log("loading AnySplat model (first time, ~1-2 min)...")
                t = time.time()
                _model = ar.load_model()
                log(f"model ready in {time.time() - t:.0f}s — server is warm")
    return _model


# warm the model in the background at boot so the first upload isn't slow
log("server starting — warming model in the background")
threading.Thread(target=get_model, daemon=True).start()


PAGE = """<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>OpenEyes — see the scene in 3D</title>
<style>
 :root{color-scheme:dark}
 body{margin:0;background:#0a0c10;color:#e6e9ef;font:16px/1.5 system-ui,sans-serif;
   display:flex;flex-direction:column;align-items:center;padding:24px;gap:16px}
 h1{font-size:20px;margin:.2em 0}p{color:#8b94a7;margin:.2em 0;text-align:center}
 label{background:#1d2533;border:1px solid #2c3548;border-radius:12px;padding:18px 22px;
   font-weight:600;cursor:pointer}input[type=file]{display:none}
 button{background:#3b6fed;color:#fff;border:0;border-radius:12px;padding:14px 22px;
   font-size:16px;font-weight:600;cursor:pointer}button:disabled{opacity:.5}
 #status{color:#8b94a7;min-height:1.4em}video{width:100%;max-width:520px;border-radius:12px;background:#000}
 .wrap{width:100%;max-width:520px;display:flex;flex-direction:column;gap:12px;align-items:center}
</style></head><body>
<h1>OpenEyes — reconstruct the scene</h1>
<p>Take or pick a few photos of the scene from different spots. We rebuild it in 3D — live.</p>
<div class="wrap">
  <label>📷 Choose / take photos<input id="f" type="file" accept="image/*" multiple capture="environment"></label>
  <button id="go" disabled>Reconstruct</button>
  <div id="status"></div>
  <video id="vid" controls autoplay loop muted playsinline style="display:none"></video>
</div>
<script>
 const f=document.getElementById('f'),go=document.getElementById('go'),
       st=document.getElementById('status'),vid=document.getElementById('vid');
 f.onchange=()=>{go.disabled=!f.files.length; st.textContent=f.files.length+' photo(s) selected';};
 go.onclick=async()=>{
   go.disabled=true; st.textContent='Uploading + reconstructing… (a few seconds)';
   const fd=new FormData(); for(const file of f.files) fd.append('images',file);
   try{
     const r=await fetch('/reconstruct',{method:'POST',body:fd});
     const j=await r.json();
     if(j.video){ vid.src=j.video+'?t='+Date.now(); vid.style.display='block';
       st.textContent='Done in '+j.seconds+'s — your scene in 3D.'; }
     else st.textContent='Failed: '+(j.error||'no video produced');
   }catch(e){ st.textContent='Error: '+e; }
   go.disabled=false;
 };
</script></body></html>"""


@app.get("/", response_class=HTMLResponse)
def index() -> str:
    return PAGE


@app.get("/healthz")
def healthz():
    return {"model_loaded": _model is not None}


@app.post("/reconstruct")
async def reconstruct(images: list[UploadFile] = File(...)):
    stamp = time.strftime("%Y%m%d_%H%M%S")
    batch_dir = OUT / stamp / "inputs"
    batch_dir.mkdir(parents=True, exist_ok=True)

    names = []
    for up in images:
        name = Path(up.filename or "img.jpg").name
        (batch_dir / name).write_bytes(await up.read())
        names.append(name)
    log(f"/reconstruct: received {len(names)} images {names} -> {stamp}")

    if _model is None:
        log("model still warming — this request will wait for it to finish loading")

    t = time.time()
    try:
        model = get_model()                 # returns cached model (loads if first call)
        with _infer_lock:                   # one GPU job at a time
            log(f"reconstructing {stamp} ...")
            ar.reconstruct(model, batch_dir, OUT / stamp)
    except Exception as e:
        log(f"✗ reconstruction failed: {e}\n{traceback.format_exc()}")
        return JSONResponse({"error": str(e)}, status_code=500)

    mp4s = sorted((OUT / stamp).glob("*.mp4"))
    if not mp4s:
        log(f"✗ no .mp4 produced in {OUT / stamp} — check anysplat_recon vs demo_gradio.py")
        return JSONResponse({"error": "no video produced"}, status_code=500)

    shutil.copy(mp4s[0], OUT / "latest.mp4")
    secs = round(time.time() - t, 1)
    url = f"/outputs/{stamp}/{mp4s[0].name}"
    log(f"✅ done {stamp} in {secs}s -> {url}")
    return JSONResponse({"video": url, "seconds": secs})
