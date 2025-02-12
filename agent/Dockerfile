FROM node:23.3.0-slim AS builder

# Install pnpm and essential build tools
RUN npm install -g pnpm@9.15.4 && \
    apt-get update && \
    apt-get install -y \
    python3 \
    git \
    build-essential

WORKDIR /app

# Copy only necessary files for building agent
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages/ ./packages/
COPY agent/ ./agent/

# Install dependencies and build
RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter "@elizaos/agent" build

# Runtime image
FROM node:23.3.0-slim

RUN npm install -g pnpm@9.15.4 && \
    apt-get update && \
    apt-get install -y \
    python3 \
    ffmpeg && \
    apt-get clean

WORKDIR /app

# Copy only the built agent and its dependencies
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/agent ./agent
COPY --from=builder /app/packages ./packages

EXPOSE 3000

CMD ["pnpm", "--filter", "@elizaos/agent", "start"] 


# "tgWebAppPlatform=tdesktop&tgWebAppThemeParams=%7B%22accent_text_color%22%3A%22%236ab2f2%22%2C%22bg_color%22%3A%22%2317212b%22%2C%22button_color%22%3A%22%235288c1%22%2C%22button_text_color%22%3A%22%23ffffff%22%2C%22destructive_text_color%22%3A%22%23ec3942%22%2C%22header_bg_color%22%3A%22%2317212b%22%2C%22hint_color%22%3A%22%23708499%22%2C%22link_color%22%3A%22%236ab3f3%22%2C%22secondary_bg_color%22%3A%22%23232e3c%22%2C%22section_bg_color%22%3A%22%2317212b%22%2C%22section_header_text_color%22%3A%22%236ab3f3%22%2C%22subtitle_text_color%22%3A%22%23708499%22%2C%22text_color%22%3A%22%23f5f5f5%22%7D&tgWebAppVersion=8&tgWebAppData=user%3D%257B%2522id%2522%253A99281932%252C%2522first_name%2522%253A%2522Andrew%2522%252C%2522last_name%2522%253A%2522Rogue%2522%252C%2522username%2522%253A%2522rogue%2522%252C%2522language_code%2522%253A%2522en%2522%252C%2522is_premium%2522%253Atrue%252C%2522allows_write_to_pm%2522%253Atrue%257D%26hash%3D89d6079ad6762351f38c6dbbc41bb53048019256a9443988af7a48bcad16ba31%26auth_date%3D1716922846%26start_param%3Ddebug%26chat_type%3Dsender%26chat_instance%3D8428209589180549439%26signature%3D6fbdaab833d39f54518bd5c3eb3f511d035e68cb"