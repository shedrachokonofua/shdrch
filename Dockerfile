FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY . .
ENV IMAGE_OUTPUT_DIR=/tmp
ENV UPLOAD=true
USER 1000:1000
CMD ["bun", "run", "cron/generate-images.ts"]
