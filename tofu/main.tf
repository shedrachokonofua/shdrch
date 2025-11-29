terraform {
  # GitLab-managed state - automatically configured in CI via env vars:
  # TF_HTTP_ADDRESS, TF_HTTP_LOCK_ADDRESS, TF_HTTP_UNLOCK_ADDRESS
  # TF_HTTP_USERNAME, TF_HTTP_PASSWORD
  #
  # For local dev, create backend.conf from backend.conf.example
  # and run: tofu init -backend-config=backend.conf
  backend "http" {}

  required_providers {
    dokku = {
      source  = "aliksend/dokku"
      version = "~> 1.0"
    }
    infisical = {
      source  = "Infisical/infisical"
      version = "~> 0.12"
    }
  }
}

variable "dokku_ssh_host" {
  type        = string
  description = "Dokku SSH host"
  default     = "10.0.3.14"
}

variable "dokku_ssh_port" {
  type        = number
  description = "Dokku SSH port"
  default     = 2222
}

variable "dokku_ssh_cert" {
  type        = string
  description = "Path to SSH private key (must be RSA format, not ED25519)"
  default     = "~/.ssh/id_rsa"
}

provider "dokku" {
  ssh_host = var.dokku_ssh_host
  ssh_port = var.dokku_ssh_port
  ssh_user = "dokku"
  ssh_cert = file(pathexpand(var.dokku_ssh_cert))
}

provider "infisical" {
  host = "https://infisical.home.shdr.ch"
  auth = {
    oidc = {}
  }
}

resource "infisical_project" "shdrch" {
  name = "shdrch"
  slug = "shdrch"
  type = "secret-manager"
}

resource "infisical_secret" "litellm_api_key" {
  name         = "LITELLM_API_KEY"
  value        = "" # Set this value in the Infisical console
  env_slug     = "prod"
  folder_path  = "/"
  workspace_id = infisical_project.shdrch.id
}

# Create the Dokku app
resource "dokku_app" "shdrch" {
  app_name = "shdrch"

  domains = [
    "shdrch.kk.home.shdr.ch"
  ]

    ports = {
    80 = {
      scheme = "http"
      container_port = 5000
    }
  }
}

# Output the app name for reference
output "app_name" {
  value = dokku_app.shdrch.app_name
}

output "git_remote" {
  value       = "dokku@${var.dokku_ssh_host}:${dokku_app.shdrch.app_name}"
  description = "Git remote URL for deploying to Dokku"
}

