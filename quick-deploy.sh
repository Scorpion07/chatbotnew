#!/bin/bash
# Quick deploy command
# Usage: ./quick-deploy.sh

echo "⚡ Quick Deploy ChatVerse AI"
echo "=========================="

# Pull and update
git pull origin main && bash update.sh