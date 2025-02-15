#!/bin/bash
set -e

# Helper function for pausing
pause() {
    printf "%s" "$*"
    stty -icanon
    dd count=1 bs=1 >/dev/null 2>&1
    stty icanon
}

# Create .local directory if it doesn't exist
if [ ! -d ~/.local/share ]; then
    mkdir -p ~/.local/share
fi

# Update package lists
echo "🔄 Updating package lists..."
sudo apt-get update
sudo apt-get upgrade -y

# Install essential build tools
echo "🛠️ Installing build essentials..."
sudo apt-get install -y build-essential curl wget git

# Setup GitHub SSH
echo "🔑 Setting up GitHub SSH..."
if [ ! -f ~/.ssh/id_ed25519 ]; then
    ssh-keygen -t ed25519 -C "$(whoami)@$(hostname)" -f ~/.ssh/id_ed25519 -N ""
fi

# Start ssh-agent and add key
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519

# Display public key for GitHub setup
echo "⚠️ Add this public key to your GitHub account (https://github.com/settings/keys):"
cat ~/.ssh/id_ed25519.pub
pause "Press any key after adding the key to GitHub..."

# Configure git
echo "⚙️ Configuring git..."
printf "Enter your GitHub email: "
read github_email
printf "Enter your GitHub username: "
read github_username
git config --global user.email "$github_email"
git config --global user.name "$github_username"

# Clone repository
echo "📥 Cloning your repository..."
printf "Enter your repository URL (default: git@github.com:Advent-AI/eliza.git): "
read repo_url
repo_url=${repo_url:-"git@github.com:Advent-AI/eliza.git"}
git clone "$repo_url"

# Install pnpm
echo "📦 Installing pnpm..."
curl -fsSL https://get.pnpm.io/install.sh | sh -

# Add pnpm to PATH
export PNPM_HOME="$HOME/.local/share/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac


# Install Node.js 23 using nvm
echo "📦 Installing nvm and Node.js..."
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Load nvm without restarting the shell
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Install and use Node.js 23
nvm install 23
nvm use 23
nvm alias default 23


# Setup project
echo "🛠️ Setting up project..."
cd eliza
echo "📦 Installing dependencies..."
pnpm install --no-frozen-lockfile

echo "🔨 Building local libraries..."
pnpm build

echo "🔧 Setting up environment variables..."
cp .env.example .env

# Install and setup PM2
echo "📦 Installing PM2..."
npm install -g pm2

# Setup PM2 startup script
echo "🚀 Setting up PM2 startup..."
pm2 startup systemd
sudo env PATH=$PATH:/usr/local/bin `pm2 startup systemd -u root --hp /root | tail -n1`

# Start application with PM2
echo "🎯 Starting application with PM2..."
# Ensure we're in the right directory
cd /home/alanwu4321/eliza

# Create logs directory
mkdir -p logs

# Load and export environment variables
echo "📝 Loading environment variables..."

# Clear existing env vars (except critical ones)
for var in $(env | grep -v "^HOME=\|^USER=\|^SHELL=\|^PATH=\|^PWD=\|^TERM=\|^SHLVL=" | cut -d= -f1); do
    unset $var
done

# Start PM2 with environment variables
pm2 delete eliza-yeti 2>/dev/null || true
pm2 start pnpm --name "eliza-yeti" \
    --cwd "/home/alanwu4321/eliza" \
    --env production \
    --time \
    --output "/home/alanwu4321/eliza/logs/out.log" \
    --error "/home/alanwu4321/eliza/logs/error.log" \
    --restart-delay=3000 \
    --max-restarts=10 \
    --exp-backoff-restart-delay=100 \
    -- start --character="characters/yeti.character.json"

# Ensure process is running
sleep 2
pm2 list
pm2 save

# Reload shell environment
. ~/.bashrc

# Verify installations
echo "✅ Verifying installations..."
echo "Git version: $(git --version)"
echo "Node version: $(node --version)"
echo "pnpm version: $(pnpm --version)"

echo "🎉 Setup complete! Please restart your shell or run:"
echo ". ~/.bashrc"
