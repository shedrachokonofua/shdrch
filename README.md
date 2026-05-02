# shdr.ch

Personal [website](https://shdr.ch) with AI-generated backgrounds. Built as a static site served from Ceph RGW, with a weekly Kubernetes CronJob that regenerates images via LiteLLM + ComfyUI.

## Architecture

- **Static site** — `public/index.html` + `public/assets/` synced to S3 bucket `shdrch` by GitLab CI.
- **Image generation** — Bun/TypeScript CronJob (`cron/generate-images.ts`) running in Kubernetes. Generates 20 historical-photograph prompts, renders them via ComfyUI, uploads to RGW, writes `manifest.json`, and purges Cloudflare cache.
- **Infrastructure** — OpenTofu in [`tofu/`](tofu/main.tf) manages the RGW bucket, website config, IAM roles (GitLab + Kubernetes OIDC / web identity), namespace, secrets, and CronJob. Homelab context and related tooling may live in [aether](https://github.com/shedrachokonofua/aether).

## Required services

- **Ceph RGW** (`s3.home.shdr.ch`) — S3-compatible object store for static site + images
- **GitLab** — CI/CD, container registry
- **LiteLLM** — LLM gateway for prompt generation
- **ComfyUI** — Image generation
- **Cloudflare** — DNS + CDN + optional cache purge (via CI variables)

## Development

```bash
task dev         # Serve static site locally (default serve port, often 3000)
task cron:run    # Generate images locally (writes to public/images, no S3 upload)
```

Requires [Bun](https://bun.sh), [Task](https://taskfile.dev), and [SOPS](https://github.com/getsops/sops) so `secrets.yaml` can be decrypted for `task cron:run`.

### Infra (OpenTofu)

With Keycloak / Vault access configured for your environment (see `task login` and comments in [`tofu/main.tf`](tofu/main.tf)):

```bash
task tofu:plan   # OpenTofu plan
task tofu:apply  # OpenTofu apply
```

## Deployment

On push to `main`, GitLab CI runs secret detection, then:

1. **build:image** — `linux/amd64` OCI image built with Buildah (amd64 only in CI; Bun cross-arch is not used on runners), pushed to the GitLab registry as `:latest` and the commit SHA tag.
2. **deploy-site** — Static assets uploaded with `aws s3 cp` to `s3://shdrch`, `index.html` gets `__ASSET_VERSION__` substituted, optional Cloudflare purge when `CF_ZONE_ID` and `CF_API_TOKEN` are set.

There is **no** separate CI job for Kubernetes. The CronJob definition and pull credentials are managed by OpenTofu; the job uses image `registry.gitlab.home.shdr.ch/so/shdrch:latest` with `imagePullPolicy: Always`, so new images are picked up on the next scheduled run after CI pushes.

## URLs

- https://shdr.ch

## Image Generation

Background images are AI-generated historical photographs. A cron job regenerates all 20 images weekly (Sundays 4:00 UTC, `0 4 * * 0`):

1. Pick a random region/era combination
2. LLM generates a descriptive museum-style prompt
3. ComfyUI renders the image

On each page load, JS fetches `manifest.json` and picks one image at random as the background, along with credits showing the prompt model, image model, and prompt text.
