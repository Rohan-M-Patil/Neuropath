# Fix: `TypeError: Client.__init__() got an unexpected keyword argument 'proxies'`

## Cause
`groq==0.11.0` internally calls `httpx.Client(..., proxies=...)`. The `proxies`
kwarg was **removed in httpx 0.28**. If your venv has `httpx>=0.28` installed,
every Groq API call (roadmap/quiz/feedback generation) will crash with this error.

## Fix — run these commands in your activated venv

```powershell
cd backend
venv\Scripts\activate

pip uninstall -y httpx
pip install "httpx==0.27.2"

pip show httpx
```

The last command should print `Version: 0.27.2`. If it shows something else,
something else is forcing an upgrade — run:

```powershell
pip install "httpx==0.27.2" --force-reinstall --no-deps
```

## Then restart the server

```powershell
uvicorn app.main:app --reload --port 8000
```

Try `/generate-roadmap` again — it should now reach Groq successfully.

## Why this happened
`requirements.txt` already pins `httpx==0.27.2`, but `pip install -r requirements.txt`
only enforces pins at install time. If you installed packages individually, ran
`pip install -U ...` at some point, or another dependency (e.g. a newer `groq`,
`fastapi`, or `langchain` patch) pulled in a newer `httpx` afterward, it can silently
override the pin. Re-running `pip install -r requirements.txt` again should also fix
it, but the explicit reinstall above is the most reliable.

## Permanent fix (recommended)
After fixing your current venv, freeze and verify:

```powershell
pip freeze | findstr /i "httpx groq"
```

You should see:
```
groq==0.11.0
httpx==0.27.2
```
