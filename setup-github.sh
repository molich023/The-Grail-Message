#!/bin/bash
# ─────────────────────────────────────────────────────────
# GRAIL MESSAGE WEBSITE — GitHub Setup Script
# Run this from inside the grailmessage/ folder on UserLand
# ─────────────────────────────────────────────────────────

echo "✦ Setting up The Grail Message website on GitHub..."

# Initialize git repo
git init
git add .
git commit -m "✦ Initial commit — In the Light of Truth website"

# Add your remote (replace with your actual repo URL)
git remote add origin https://github.com/molich023/grailmessage.git

# Push to GitHub
git branch -M main
git push -u origin main

echo ""
echo "✦ Done! Your site will be live at:"
echo "   https://molich023.github.io/grailmessage"
echo ""
echo "Next steps:"
echo "1. Go to github.com/molich023/grailmessage"
echo "2. Click Settings → Pages"
echo "3. Set source: Deploy from branch → main → /(root)"
echo "4. Click Save — site goes live in ~2 minutes!"
