terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }

  # Optional: Configure backend for state management
  # backend "s3" {
  #   bucket = "divemap-terraform-state"
  #   key    = "notification-system/terraform.tfstate"
  #   region = "eu-central-1"
  # }
}
