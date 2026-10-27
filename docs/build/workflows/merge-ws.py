"""3-way merge of a workspace copy into the main tree.
usage: python merge-ws.py <workspace dir> <base dir> [--dry-run]
For every file that differs between workspace and base (excluding node_modules, .next, .data, graphify-out):
  main == base  -> take the workspace file
  ws gone       -> delete in main if main == base, else report
  otherwise     -> git merge-file (main, base, ws); conflicts are written with markers and listed.
"""
import filecmp, os, shutil, subprocess, sys

MAIN = r"C:\Users\Safar\Desktop\Cyclowareness- Vol2"
SKIP = {"node_modules", ".next", ".data", "graphify-out", ".git"}
ws, base = sys.argv[1], sys.argv[2]
dry = "--dry-run" in sys.argv

def files(root):
    out = set()
    for d, dirs, fs in os.walk(root):
        dirs[:] = [x for x in dirs if x not in SKIP]
        for f in fs:
            out.add(os.path.relpath(os.path.join(d, f), root))
    return out

wsf, basef = files(ws), files(base)
# Files the main repo ignores (build output, local env, caches) are never merged.
cand = sorted(wsf | basef)
NL = chr(10)
ign = subprocess.run(["git", "-C", MAIN, "check-ignore", "--stdin"], input=NL.join(x.replace(os.sep, "/") for x in cand).encode(), capture_output=True).stdout.decode().split(NL)
ignored = {x.strip().replace("/", os.sep) for x in ign if x.strip()}
wsf -= ignored; basef -= ignored
taken, merged, conflicts, deleted, odd = [], [], [], [], []
for rel in sorted(wsf | basef):
    w, b, m = (os.path.join(r, rel) for r in (ws, base, MAIN))
    if rel in wsf and rel in basef and filecmp.cmp(w, b, shallow=False):
        continue
    if rel not in wsf:  # deleted in workspace
        if os.path.exists(m) and filecmp.cmp(m, b, shallow=False):
            deleted.append(rel)
            if not dry: os.remove(m)
        else:
            odd.append(f"deleted in workspace but changed in main: {rel}")
        continue
    if rel not in basef or not os.path.exists(m):  # new in workspace
        if os.path.exists(m) and not filecmp.cmp(m, w, shallow=False):
            odd.append(f"added in both, different: {rel}")
            continue
        taken.append(rel)
        if not dry:
            os.makedirs(os.path.dirname(m), exist_ok=True); shutil.copyfile(w, m)
        continue
    if filecmp.cmp(m, b, shallow=False):
        taken.append(rel)
        if not dry: shutil.copyfile(w, m)
        continue
    if filecmp.cmp(m, w, shallow=False):
        continue
    r = subprocess.run(["git", "merge-file", "-p", m, b, w], capture_output=True)
    if r.returncode < 0 or r.returncode > 127:
        odd.append(f"merge error {rel}: {r.stderr.decode(errors='replace')}")
        continue
    (conflicts if r.returncode > 0 else merged).append(rel)
    if not dry:
        with open(m, "wb") as fh: fh.write(r.stdout)

print(f"taken {len(taken)}, merged {len(merged)}, conflicts {len(conflicts)}, deleted {len(deleted)}, odd {len(odd)}")
for name, lst in (("TAKEN", taken), ("MERGED", merged), ("CONFLICT", conflicts), ("DELETED", deleted), ("ODD", odd)):
    for x in lst: print(f"{name} {x}")
