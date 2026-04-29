# =============================================================================
# shdrch — owns the entire k8s + RGW footprint via federated identity
# =============================================================================
# Resources:
#   * RGW Bucket + WebsiteConfig + BucketPolicy (native AWS provider)
#   * RGW IAM Roles + RolePolicies for cron + deploy (native AWS provider)
#   * K8s Namespace + ServiceAccount + Secret + CronJob
#
# Auth flow (no aether-root anywhere):
#   * `scripts/login.sh` mints a Keycloak ID token via device flow against
#     auth.shdr.ch (toolbox client) and caches it at
#     ~/.aether-toolbox/keycloak/id_token.
#   * The aws provider's assume_role_with_web_identity block reads that JWT
#     and exchanges it via RGW STS for temp creds scoped to the
#     `aether-admin` role under the aether RGW IAM account.
#   * SOPS still decrypts secrets.yaml via bao transit for the LiteLLM key.
#   * Local kubeconfig drives the kubernetes provider for the k8s side.
#
# Run with `task tofu:apply` (which invokes scripts/login.sh first).

terraform {
  required_version = ">= 1.6"
  required_providers {
    sops       = { source = "carlpett/sops",        version = "~> 1.1" }
    kubernetes = { source = "hashicorp/kubernetes", version = "~> 2.30" }
    aws        = { source = "hashicorp/aws",        version = "~> 5.60" }
  }
}

variable "rgw_account_id" {
  description = "RGW IAM account ID (aether)"
  type        = string
  default     = "RGW65051373228719292"
}

data "sops_file" "secrets" {
  source_file = "${path.module}/../secrets.yaml"
}

locals {
  ns                       = "shdrch"
  bucket                   = "shdrch"
  rgw_endpoint             = "https://s3.home.shdr.ch"
  k8s_oidc_issuer          = "oidc.k8s.home.shdr.ch"
  gitlab_oidc_issuer       = "gitlab.home.shdr.ch"
  k8s_oidc_provider_arn    = "arn:aws:iam::${var.rgw_account_id}:oidc-provider/${local.k8s_oidc_issuer}"
  gitlab_oidc_provider_arn = "arn:aws:iam::${var.rgw_account_id}:oidc-provider/${local.gitlab_oidc_issuer}"
  cron_role_arn            = "arn:aws:iam::${var.rgw_account_id}:role/shdrch-cron"
  image                    = "registry.gitlab.home.shdr.ch/so/shdrch:latest"

  s3_rw_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:AbortMultipartUpload"], Resource = "arn:aws:s3:::${local.bucket}/*" },
      { Effect = "Allow", Action = ["s3:ListBucket"], Resource = "arn:aws:s3:::${local.bucket}" },
    ]
  })
}

provider "kubernetes" {
  config_path = "~/.kube/config"
}

# Reads short-lived RGW STS creds from AWS_* env vars (set by `task login`,
# which exchanges a Keycloak JWT for `aether-admin` STS creds via RGW STS).
# Tofu's provider can't do the STS exchange itself because the AWS SDK
# regex rejects RGW-format account IDs in role ARNs.
provider "aws" {
  alias                       = "rgw"
  region                      = "us-east-1"
  skip_credentials_validation = true
  skip_region_validation      = true
  skip_requesting_account_id  = true
  s3_use_path_style           = true

  endpoints {
    s3  = local.rgw_endpoint
    iam = local.rgw_endpoint
    sts = local.rgw_endpoint
  }
}

# ─── RGW: Bucket + Website + Public-Read Policy ──────────────────────────────

resource "aws_s3_bucket" "shdrch" {
  provider = aws.rgw
  bucket   = local.bucket
}

resource "aws_s3_bucket_website_configuration" "shdrch" {
  provider = aws.rgw
  bucket   = aws_s3_bucket.shdrch.id
  index_document {
    suffix = "index.html"
  }
}

resource "aws_s3_bucket_policy" "shdrch_public_read" {
  provider = aws.rgw
  bucket   = aws_s3_bucket.shdrch.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "PublicRead"
      Effect    = "Allow"
      Principal = "*"
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.shdrch.arn}/*"
    }]
  })
}

# ─── RGW: IAM Roles + Policies (cron + deploy) ───────────────────────────────

resource "aws_iam_role" "shdrch_cron" {
  provider = aws.rgw
  name     = "shdrch-cron"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = local.k8s_oidc_provider_arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "${local.k8s_oidc_issuer}:sub" = "system:serviceaccount:${local.ns}:shdrch-image-generator"
        }
        "ForAnyValue:StringEquals" = {
          "${local.k8s_oidc_issuer}:aud" = "sts.amazonaws.com"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "shdrch_cron_rw" {
  provider = aws.rgw
  name     = "shdrch-cron-rw"
  role     = aws_iam_role.shdrch_cron.name
  policy   = local.s3_rw_policy
}

resource "aws_iam_role" "shdrch_deploy" {
  provider = aws.rgw
  name     = "shdrch-deploy"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = local.gitlab_oidc_provider_arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "${local.gitlab_oidc_issuer}:aud" = "https://${local.gitlab_oidc_issuer}"
          "${local.gitlab_oidc_issuer}:sub" = "project_path:so/shdrch:ref_type:branch:ref:main"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "shdrch_deploy_rw" {
  provider = aws.rgw
  name     = "shdrch-deploy-rw"
  role     = aws_iam_role.shdrch_deploy.name
  policy   = local.s3_rw_policy
}

# ─── K8s: Namespace + ServiceAccount + Secret + CronJob ──────────────────────

resource "kubernetes_namespace_v1" "shdrch" {
  metadata {
    name   = local.ns
    labels = { "app.kubernetes.io/name" = "shdrch" }
  }
}

resource "kubernetes_service_account_v1" "image_generator" {
  metadata {
    name      = "shdrch-image-generator"
    namespace = kubernetes_namespace_v1.shdrch.metadata[0].name
  }
}

resource "kubernetes_secret_v1" "env" {
  metadata {
    name      = "shdrch-image-generator-env"
    namespace = kubernetes_namespace_v1.shdrch.metadata[0].name
  }
  data = {
    LITELLM_API_KEY             = data.sops_file.secrets.data["LITELLM_API_KEY"]
    LITELLM_HOST                = "https://litellm.home.shdr.ch"
    COMFYUI_HOST                = "https://comfyui.home.shdr.ch"
    S3_ENDPOINT                 = local.rgw_endpoint
    S3_BUCKET                   = local.bucket
    AWS_ROLE_ARN                = aws_iam_role.shdrch_cron.arn
    AWS_WEB_IDENTITY_TOKEN_FILE = "/var/run/secrets/sts/token"
    AWS_REGION                  = "us-east-1"
  }
}

resource "kubernetes_cron_job_v1" "image_generator" {
  metadata {
    name      = "shdrch-image-generator"
    namespace = kubernetes_namespace_v1.shdrch.metadata[0].name
  }

  spec {
    schedule                      = "0 4 * * 0"
    concurrency_policy            = "Forbid"
    successful_jobs_history_limit = 1
    failed_jobs_history_limit     = 3

    job_template {
      metadata {}
      spec {
        active_deadline_seconds = 1800
        backoff_limit           = 0

        template {
          metadata {
            labels = {
              "app.kubernetes.io/name" = "shdrch-image-generator"
              # No aether.sh/arm-ok label: image is amd64-only (Bun + buildah
              # cross-arch limitation). Kyverno gate steers the pod to amd64
              # workers, which is correct.
            }
          }
          spec {
            service_account_name            = kubernetes_service_account_v1.image_generator.metadata[0].name
            automount_service_account_token = false
            restart_policy                  = "OnFailure"

            security_context {
              run_as_non_root = true
              run_as_user     = 1000
              run_as_group    = 1000
              seccomp_profile { type = "RuntimeDefault" }
            }

            container {
              name              = "generator"
              image             = local.image
              image_pull_policy = "Always"

              env_from {
                secret_ref { name = kubernetes_secret_v1.env.metadata[0].name }
              }

              resources {
                requests = { cpu = "100m", memory = "128Mi" }
                limits   = { cpu = "500m", memory = "512Mi" }
              }

              security_context {
                allow_privilege_escalation = false
                read_only_root_filesystem  = true
                capabilities { drop = ["ALL"] }
              }

              volume_mount {
                name       = "tmp"
                mount_path = "/tmp"
              }
              volume_mount {
                name       = "sts-token"
                mount_path = "/var/run/secrets/sts"
                read_only  = true
              }
            }

            volume {
              name = "tmp"
              empty_dir {}
            }
            volume {
              name = "sts-token"
              projected {
                sources {
                  service_account_token {
                    path               = "token"
                    audience           = "sts.amazonaws.com"
                    expiration_seconds = 3600
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

output "shdrch_cron_role_arn" {
  value = aws_iam_role.shdrch_cron.arn
}

output "shdrch_deploy_role_arn" {
  value = aws_iam_role.shdrch_deploy.arn
}
