param(
  [string]$EnvPath = "C:\\Users\\Sahith\\OneDrive\\Desktop\\yokaihunt\\backend\\.env"
)

# Reads secrets from process env and writes a .env without echoing their values
# Required: CREATOR_MNEMONIC, PINATA_JWT
# Optional: MONGO_USER, MONGO_PASS, MONGO_HOST (e.g., cluster0.mongodb.net)

$lines = @()

# Algorand
$ALGOD_URL = $env:ALGOD_URL
if ([string]::IsNullOrWhiteSpace($ALGOD_URL)) { $ALGOD_URL = 'https://testnet-api.algonode.cloud' }
$ALGOD_INDEXER_URL = $env:ALGOD_INDEXER_URL
if ([string]::IsNullOrWhiteSpace($ALGOD_INDEXER_URL)) { $ALGOD_INDEXER_URL = 'https://testnet-idx.algonode.cloud' }
$ALGOD_TOKEN = $env:ALGOD_TOKEN
$lines += "ALGOD_URL=$ALGOD_URL"
$lines += "ALGOD_INDEXER_URL=$ALGOD_INDEXER_URL"
$lines += "ALGOD_TOKEN=$ALGOD_TOKEN"

# Secrets (not echoed)
$CREATOR_MNEMONIC = $env:CREATOR_MNEMONIC
$PINATA_JWT = $env:PINATA_JWT
if ([string]::IsNullOrWhiteSpace($CREATOR_MNEMONIC)) { Write-Error 'CREATOR_MNEMONIC is required in environment'; exit 1 }
if ([string]::IsNullOrWhiteSpace($PINATA_JWT)) { Write-Error 'PINATA_JWT is required in environment'; exit 1 }
$lines += "CREATOR_MNEMONIC=$CREATOR_MNEMONIC"
$lines += "PINATA_JWT=$PINATA_JWT"

# Pinata gateway (optional)
$PINATA_GATEWAY = $env:PINATA_GATEWAY
if ([string]::IsNullOrWhiteSpace($PINATA_GATEWAY)) { $PINATA_GATEWAY = 'gateway.pinata.cloud' }
$lines += "PINATA_GATEWAY=$PINATA_GATEWAY"

# Optional service config
if ($env:BACKEND_HOT_ADDRESS) { $lines += "BACKEND_HOT_ADDRESS=$($env:BACKEND_HOT_ADDRESS)" }
if ($env:SERVICE_FEE_ALGO) { $lines += "SERVICE_FEE_ALGO=$($env:SERVICE_FEE_ALGO)" } else { $lines += "SERVICE_FEE_ALGO=0.3" }

# MongoDB URI (if provided via env)
if ($env:MONGO_URI) {
  $lines += "MONGO_URI=$($env:MONGO_URI)"
} else {
  # Build from user/pass/host if present
  $MONGO_USER = $env:MONGO_USER
  $MONGO_PASS = $env:MONGO_PASS
  $MONGO_HOST = $env:MONGO_HOST
  if ($MONGO_USER -and $MONGO_PASS -and $MONGO_HOST) {
    $uri = "mongodb+srv://$MONGO_USER:$MONGO_PASS@$MONGO_HOST/yokaihunt?retryWrites=true&w=majority&appName=yokaihunt"
    $lines += "MONGO_URI=$uri"
  }
}

# Write file
$dir = Split-Path -Parent $EnvPath
if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
$lines -join "`n" | Set-Content -LiteralPath $EnvPath -Encoding UTF8
Write-Output ("Wrote .env to {0}" -f $EnvPath)
