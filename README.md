# shdr.ch

Personal website hosted on Dokku via GitLab CI/CD.

## Structure

```
shdrch/
├── index.php           # Main landing page (PHP)
├── Taskfile.yml        # Local dev task runner
├── .gitlab-ci.yml      # CI/CD pipeline
├── tofu/
│   └── main.tf         # Dokku app infrastructure
└── README.md
```

## Local Development

Run the dev server:

```bash
task dev
```

This starts a PHP server at http://localhost:8000 using Podman.

## Deployment

Deployment is fully automated via GitLab CI/CD on push to `main`:

1. **infra** stage: Runs `tofu apply` to ensure Dokku app exists
2. **deploy** stage: Pushes code to Dokku

### CI/CD Requirements

Set these GitLab CI/CD variables:

- `DOKKU_SSH_KEY` - SSH private key with access to Dokku server

### Manual Infrastructure Setup

If running OpenTofu locally:

```bash
cd tofu
# Create backend.conf from backend.conf.example for state config
tofu init -backend-config=backend.conf
tofu apply
```

## Accessing the Site

- **Internal**: https://shdrch.kk.home.shdr.ch
- **External**: https://shdr.ch

## Troubleshooting

### Check app status

```bash
ssh -p 2222 dokku@10.0.3.14 apps:list
ssh -p 2222 dokku@10.0.3.14 logs shdrch
```

### Rebuild app

```bash
ssh -p 2222 dokku@10.0.3.14 ps:rebuild shdrch
```
