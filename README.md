# shdr.ch

Personal [website](https://shdr.ch) with AI-generated backgrounds. Deployed to Dokku via GitLab CI/CD.

## Infrastructure

Hosted on aether. Infrastructure managed with OpenTofu (`tofu/main.tf`).

Depends on aether services:

- **Dokku** — PaaS
- **GitLab** — CI/CD, OpenTofu state backend
- **Infisical** — Secrets management
- **LiteLLM** — LLM gateway for prompt generation
- **ComfyUI** — Image generation

## Development

```bash
task dev                  # Start dev server at http://localhost:8000
task dev:generate-images  # Generate new background images for dev server
```

Requires Taskfile, Podman and [Infisical CLI](https://infisical.com/docs/cli/overview) to develop locally.

## Deployment

Automatic on push to `main`. Requires `DOKKU_SSH_KEY` set in CI/CD variables.

## URLs

- https://shdr.ch
- https://shdrch.kk.home.shdr.ch (internal)

## Image Generation

Background images are AI-generated historical photographs. A cron job regenerates all 20 images weekly (Sundays 4am):

1. Pick a random region/era combination
2. LLM generates a descriptive prompt
3. ComfyUI renders the image

On each page load, one of the 20 images is randomly selected as the background.

Run `task dev:generate-images` locally.
