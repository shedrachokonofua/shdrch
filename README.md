# shdr.ch

Personal [website](https://shdr.ch) with AI-generated backgrounds. Built as a static site served from Ceph RGW, with a weekly Kubernetes CronJob that regenerates images via LiteLLM + ComfyUI.

## Architecture

- **Static site** — `public/index.html` + `public/assets/` synced to S3 bucket `shdrch` by GitLab CI.
- **Image generation** — Bun/TypeScript CronJob (`cron/generate-images.ts`) running in Kubernetes cluster. Generates 20 historical-photograph prompts, renders them via ComfyUI, uploads to S3, writes `manifest.json`, and purges Cloudflare cache.
- **Infrastructure** — Provisioned in [aether](https://github.com/shedrachokonofua/aether): Crossplane-managed S3 bucket, IAM roles with OIDC/web-identity, Caddy reverse proxy at the gateway.

## Required services

- **Ceph RGW** (`s3.home.shdr.ch`) — S3-compatible object store for static site + images
- **GitLab** — CI/CD, container registry
- **Infisical** — Secrets management
- **LiteLLM** — LLM gateway for prompt generation
- **ComfyUI** — Image generation
- **Cloudflare** — DNS + CDN + cache purge

## Development


```bash
task dev         # Serve static site locally at http://localhost:3000
task cron:run    # Generate images locally (writes to public/images)
```

Requires [Bun](https://bun.sh), Task and [Infisical CLI](https://infisical.com/docs/cli/overview).

## Deployment

Automatic on push to `main`:

1. **build:image** — Multi-arch OCI image built with Buildah, pushed to GitLab registry.
2. **deploy-site** — Static assets synced to RGW via `s5cmd`; Cloudflare cache purged.
3. **deploy-cluster** — K8s CronJob manifest applied; generator image tag bumped.

## URLs

- https://shdr.ch

## Image Generation

Background images are AI-generated historical photographs. A cron job regenerates all 20 images weekly (Sundays 4am UTC):

1. Pick a random region/era combination
2. LLM generates a descriptive museum-style prompt
3. ComfyUI renders the image

On each page load, JS fetches `manifest.json` and picks one image at random as the background, along with credits showing the prompt model, image model, and prompt text.
