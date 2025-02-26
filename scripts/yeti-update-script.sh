#!/bin/bash

# Navigate to the project directory
cd /home/alanwu4321/eliza

# Pull latest changes
git pull

# Delete existing PM2 process
pm2 delete eliza-yeti 2>/dev/null || true

# Start PM2 with environment variables
pm2 start pnpm --name "eliza-yeti" \
    --cwd "/home/alanwu4321/eliza" \
    --env production \
    --time \
    --output "/home/alanwu4321/eliza/logs/out.log" \
    --error "/home/alanwu4321/eliza/logs/error.log" \
    --restart-delay=3000 \
    --max-restarts=10 \
    --exp-backoff-restart-delay=100 \
    -- start --character="/home/alanwu4321/eliza/characters/yeti/yeti.character.json"

# Ensure process is running
sleep 2
pm2 list
pm2 save
