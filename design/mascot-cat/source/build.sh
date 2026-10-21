#!/bin/sh
# Joins the four source parts into final.html (run from this folder).
D="$(cd "$(dirname "$0")" && pwd)"
cat "$D/p1.html" "$D/p2.js" "$D/p3.js" "$D/p4.js" > "$D/../final.html"
node -e "const s=require('fs').readFileSync(process.argv[1],'utf8');const m=s.match(/<script>([\s\S]*)<\/script>/);try{new Function(m[1]);console.log('syntax ok',s.length)}catch(e){console.log('SYNTAX',e.message)}" "$D/../final.html"
