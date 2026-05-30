#!/usr/bin/env bash
# Deploy OpenEyes health API to AWS Lambda (no Docker, no SST).
# Usage: ./scripts/deploy-api.sh [stage]
set -euo pipefail

REGION="${AWS_REGION:-us-west-1}"
STAGE="${1:-dev}"
FUNCTION_NAME="openeyes-api-${STAGE}"
ROLE_NAME="openeyes-api-lambda"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="${ROOT}/services/api/.lambda-build"
ZIP="${ROOT}/services/api/.lambda-package.zip"

echo "==> Building deployment package..."
rm -rf "$BUILD_DIR" "$ZIP"
mkdir -p "$BUILD_DIR"

python3 -m pip install -q --upgrade pip
python3 -m pip install -q -r "${ROOT}/services/api/requirements.txt" -t "$BUILD_DIR"
cp -r "${ROOT}/services/api/app" "$BUILD_DIR/app"

(cd "$BUILD_DIR" && zip -qr "$ZIP" .)

ROLE_ARN="$(aws iam get-role --role-name "$ROLE_NAME" --query Role.Arn --output text)"

echo "==> Deploying Lambda: $FUNCTION_NAME ($REGION)..."
if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" >/dev/null 2>&1; then
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file "fileb://${ZIP}" \
    --region "$REGION" >/dev/null
  aws lambda update-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --handler app.main.handler \
    --runtime python3.12 \
    --timeout 10 \
    --memory-size 256 \
    --environment "Variables={STAGE=${STAGE}}" \
    --region "$REGION" >/dev/null
else
  aws lambda create-function \
    --function-name "$FUNCTION_NAME" \
    --runtime python3.12 \
    --role "$ROLE_ARN" \
    --handler app.main.handler \
    --timeout 10 \
    --memory-size 256 \
    --zip-file "fileb://${ZIP}" \
    --environment "Variables={STAGE=${STAGE}}" \
    --region "$REGION" >/dev/null
fi

echo "==> Ensuring public Function URL..."
if aws lambda get-function-url-config --function-name "$FUNCTION_NAME" --region "$REGION" >/dev/null 2>&1; then
  :
else
  aws lambda create-function-url-config \
    --function-name "$FUNCTION_NAME" \
    --auth-type NONE \
    --cors '{"AllowOrigins":["*"],"AllowMethods":["*"],"AllowHeaders":["*"]}' \
    --region "$REGION" >/dev/null
  aws lambda add-permission \
    --function-name "$FUNCTION_NAME" \
    --statement-id FunctionURLAllowPublicAccess \
    --action lambda:InvokeFunctionUrl \
    --principal "*" \
    --function-url-auth-type NONE \
    --region "$REGION" >/dev/null 2>&1 || true
fi

# Wait for function to be active after code update
aws lambda wait function-active --function-name "$FUNCTION_NAME" --region "$REGION"

URL="$(aws lambda get-function-url-config --function-name "$FUNCTION_NAME" --region "$REGION" --query FunctionUrl --output text)"
HEALTH="${URL%/}/health"

echo ""
echo "Deployed."
echo "  Function: $FUNCTION_NAME"
echo "  URL:      $URL"
echo "  Health:   $HEALTH"
echo ""
echo "Smoke test:"
echo "  curl $HEALTH"
