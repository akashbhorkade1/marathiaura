[CmdletBinding()]
param(
    [string]$SiteUrl = "https://marathiaura.in",
    [string]$RootDir = $PSScriptRoot
)

$dataPath = Join-Path $RootDir "data\posts.json"
$json = Get-Content -LiteralPath $dataPath -Raw -Encoding UTF8 | ConvertFrom-Json
$posts = $json.posts

$saJson = $env:GOOGLE_INDEXING_SERVICE_ACCOUNT

if (-not $saJson) {
    Write-Output "GOOGLE_INDEXING_SERVICE_ACCOUNT not set. Skipping."
    exit 0
}

try {
    $sa = $saJson | ConvertFrom-Json
}
catch {
    Write-Output "ERROR: Invalid service account JSON"
    exit 1
}

$scope = "https://www.googleapis.com/auth/indexing"
$now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$exp = $now + 3600

$header = @{
    alg = "RS256"
    typ = "JWT"
    kid = $sa.private_key_id
} | ConvertTo-Json -Compress

$payload = @{
    iss = $sa.client_email
    scope = $scope
    aud = "https://oauth2.googleapis.com/token"
    iat = $now
    exp = $exp
} | ConvertTo-Json -Compress

$headerB64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($header)).TrimEnd('=').Replace('+','-').Replace('/','_')
$payloadB64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($payload)).TrimEnd('=').Replace('+','-').Replace('/','_')

$signInput = "$headerB64.$payloadB64"

$privKeyPem = $sa.private_key
$privKeyPem = $privKeyPem -replace '-----BEGIN PRIVATE KEY-----', '' -replace '-----END PRIVATE KEY-----', '' -replace '\s', ''
$keyBytes = [Convert]::FromBase64String($privKeyPem)

$rsa = [System.Security.Cryptography.RSA]::Create()
$rsa.ImportPkcs8PrivateKey($keyBytes, [ref]$null)

$signBytes = [System.Text.Encoding]::ASCII.GetBytes($signInput)
$signature = $rsa.SignData($signBytes, [System.Security.Cryptography.HashAlgorithmName]::SHA256, [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
$sigB64 = [Convert]::ToBase64String($signature).TrimEnd('=').Replace('+','-').Replace('/','_')

$jwt = "$signInput.$sigB64"

try {
    $tokenBody = "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=$jwt"
    $tokenResp = Invoke-RestMethod -Uri "https://oauth2.googleapis.com/token" -Method Post -Body $tokenBody -ContentType "application/x-www-form-urlencoded"
    $accessToken = $tokenResp.access_token
    Write-Output "Google OAuth2 token acquired."
}
catch {
    Write-Output "ERROR: Failed to get OAuth2 token: $($_.Exception.Message)"
    exit 1
}

$urls = @($SiteUrl)
$catPaths = $json.categories | ForEach-Object { "$SiteUrl$($_.path)" }
$urls += $catPaths

$sitemapUrl = "$SiteUrl/sitemap.xml"
$urls += $sitemapUrl

$recentPosts = $posts | Sort-Object date -Descending | Select-Object -First 10
foreach ($p in $recentPosts) {
    $urls += "$SiteUrl/$($p.slug)"
}

$successCount = 0
$errorCount = 0

foreach ($url in $urls) {
    try {
        $body = @{
            url = $url
            type = "URL_UPDATED"
        } | ConvertTo-Json -Depth 3

        $headers = @{
            "Authorization" = "Bearer $accessToken"
            "Content-Type" = "application/json"
        }

        Invoke-RestMethod -Uri "https://indexing.googleapis.com/v3/urlNotifications:publish" -Method Post -Body $body -Headers $headers -ContentType "application/json; charset=utf-8" | Out-Null
        $successCount++
        Write-Output "  OK: $url"
    }
    catch {
        $errorCount++
        Write-Output "  ERROR: $url - $($_.Exception.Message)"
    }
}

Write-Output "`nGoogle Indexing API: $successCount submitted, $errorCount errors"
