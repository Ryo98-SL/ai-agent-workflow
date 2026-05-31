#!/bin/bash

DIR="${1:-.}"

git ls-files "$DIR" | while read -r file; do
  echo "Removing from tracking: $file"
  git rm --cached "$file"
done

echo "Done. Add $DIR to .gitignore to prevent re-tracking."
