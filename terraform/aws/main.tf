provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "Divemap"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}
