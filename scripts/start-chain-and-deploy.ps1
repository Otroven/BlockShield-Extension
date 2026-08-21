param(
  [string]$RpcUrl = "http://127.0.0.1:8545",
  [string]$PrivateKey = "",
  [string]$ContractDir = "contract/original-content"
)

$ErrorActionPreference = "Stop"

if ($RpcUrl -eq "http://127.0.0.1:8545" -and $env:RPC_URL) {
  $RpcUrl = $env:RPC_URL
}

function Test-PortOpen {
  param(
    [string]$Host,
    [int]$Port
  )

  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $async = $client.BeginConnect($Host, $Port, $null, $null)
    $wait = $async.AsyncWaitHandle.WaitOne(500)
    if (-not $wait) {
      $client.Close()
      return $false
    }
    $client.EndConnect($async)
    $client.Close()
    return $true
  } catch {
    return $false
  }
}

function Wait-ForPort {
  param(
    [string]$Host,
    [int]$Port,
    [int]$TimeoutSeconds = 20
  )

  $start = Get-Date
  while ((Get-Date) - $start -lt (New-TimeSpan -Seconds $TimeoutSeconds)) {
    if (Test-PortOpen -Host $Host -Port $Port) {
      return $true
    }
    Start-Sleep -Milliseconds 500
  }
  return $false
}

if ([string]::IsNullOrWhiteSpace($PrivateKey)) {
  if ($env:ANVIL_PRIVATE_KEY) {
    $PrivateKey = $env:ANVIL_PRIVATE_KEY
  } else {
    $PrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  }
}

$rpcUri = [System.Uri]$RpcUrl
$host = $rpcUri.Host
$port = $rpcUri.Port

if (-not (Test-PortOpen -Host $host -Port $port)) {
  Write-Host "[chain] Anvil is not running. Starting on $host`:$port ..."
  Start-Process -FilePath "anvil" -ArgumentList "--host $host --port $port" | Out-Null
  if (-not (Wait-ForPort -Host $host -Port $port -TimeoutSeconds 20)) {
    throw "Anvil did not start within timeout."
  }
  Write-Host "[chain] Anvil started."
} else {
  Write-Host "[chain] Anvil already running on $host`:$port."
}

Push-Location $ContractDir
try {
  Write-Host "[chain] Deploying OriginalContent..."
  forge script script/DeployOriginalContent.s.sol:DeployOriginalContent --rpc-url $RpcUrl --broadcast --private-key $PrivateKey
  Write-Host "[chain] Deployment finished."
} finally {
  Pop-Location
}
