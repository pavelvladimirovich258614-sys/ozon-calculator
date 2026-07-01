#!/usr/bin/env python3
"""Deploy Ozon Calculator to GitVerse (GigaCode). Run: python deploy_gitverse.py"""

import json
import urllib.request
import subprocess
import sys
import os

TOKEN       = "84cd2078d09a2ccf6a196ed5c1b38393b7f60e50"
GITVERSE    = "https://gitverse.ru/api/v1"
REPO_NAME   = "ozon-calculator"
LOCAL_PATH  = "ozon-calculator"

def api_call(url, method="GET", data=None):
    req = urllib.request.Request(url, method=method)
    req.add_header("Authorization", f"token {TOKEN}")
    if data:
        req.add_header("Content-Type", "application/json")
        req.data = json.dumps(data).encode("utf-8")
    try:
        resp = urllib.request.urlopen(req, timeout=15)
        return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read().decode())
            return {"error": body.get("message", str(e.code)), "status": e.code}
        except:
            return {"error": str(e.code), "status": e.code}
    except Exception as e:
        return {"error": str(e), "status": 0}

def main():
    print("=" * 50)
    print("  Deploy to GitVerse (GigaCode)")
    print("=" * 50)

    # 1. Verify token
    print("\n[1/4] Checking token...")
    user = api_call(f"{GITVERSE}/user")
    if "error" in user:
        print(f"      FAIL — {user['error']}")
        sys.exit(1)
    login = user.get("login")
    print(f"      OK — logged in as: {login}")

    # 2. Create repo
    print(f"\n[2/4] Creating public repo '{REPO_NAME}'...")
    repo = api_call(f"{GITVERSE}/user/repos", method="POST", data={
        "name": REPO_NAME,
        "private": False,
        "description": "Ozon Unit-Economics Calculator MVP",
        "auto_init": False
    })
    if "error" in repo:
        if repo.get("status") in (409, 422) or "already exists" in str(repo.get("error", "")).lower():
            print("      WARN — repo already exists, skipping creation")
        else:
            print(f"      FAIL — {repo['error']}")
            sys.exit(1)
    else:
        print(f"      OK — created")

    # 3. Push code
    print(f"\n[3/4] Pushing code...")
    if not os.path.isdir(LOCAL_PATH):
        print(f"      FAIL — folder '{LOCAL_PATH}' not found")
        sys.exit(1)

    os.chdir(LOCAL_PATH)

    # Remove old remote
    subprocess.run(["git", "remote", "remove", "gitverse"], capture_output=True)

    remote_url = f"https://oauth2:{TOKEN}@gitverse.ru/{login}/{REPO_NAME}.git"
    subprocess.run(["git", "remote", "add", "gitverse", remote_url], check=True)

    # Get current branch
    result = subprocess.run(["git", "branch", "--show-current"], capture_output=True, text=True)
    branch = result.stdout.strip() or "master"

    push = subprocess.run(["git", "push", "-u", "gitverse", branch], capture_output=True, text=True)
    if push.returncode != 0:
        print(f"      FAIL — {push.stderr}")
        sys.exit(1)
    print(f"      OK — pushed branch '{branch}'")

    # 4. Enable Pages
    print(f"\n[4/4] Enabling Pages...")
    pages = api_call(
        f"{GITVERSE}/repos/{login}/{REPO_NAME}/pages",
        method="POST",
        data={"source": "master", "builder": "gitea"}
    )
    if "error" in pages:
        print(f"      SKIP — {pages.get('error', 'unknown')}")
    else:
        print("      OK — Pages enabled")

    # Done
    print("\n" + "=" * 50)
    print("  DONE!")
    print(f"  Repo:  https://gitverse.ru/{login}/{REPO_NAME}")
    print(f"  Pages: https://{login}.gitverse.io/{REPO_NAME} (if enabled)")
    print("=" * 50)

if __name__ == "__main__":
    main()
