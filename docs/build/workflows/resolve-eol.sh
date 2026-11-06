#!/bin/bash
# usage: resolve-eol.sh <branch> <file>...  — 3-way merge with CR stripped, CRLF restored when HEAD used it
B=$1; shift
M=$(git merge-base HEAD "$B")
T=$(mktemp -d)
for F in "$@"; do
  git show "$M:$F" | tr -d '\r' > "$T/base"
  git show "$B:$F" | tr -d '\r' > "$T/theirs"
  git show "HEAD:$F" | tr -d '\r' > "$T/ours"
  crlf=$(git show "HEAD:$F" | head -c 4000 | grep -c $'\r')
  git merge-file -p -L HEAD -L base -L "$B" "$T/ours" "$T/base" "$T/theirs" > "$T/merged"; rc=$?
  if [ "$crlf" -gt 0 ]; then sed -i 's/$/\r/' "$T/merged"; fi
  cp "$T/merged" "$F"
  echo "$F: conflicts=$rc crlf=$crlf"
done
rm -rf "$T"
