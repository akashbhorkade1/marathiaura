[CmdletBinding()]
param(
    [string]$RootDir = $PSScriptDir
)

$dataPath = Join-Path $RootDir "data\posts.json"
$json = Get-Content -LiteralPath $dataPath -Raw -Encoding UTF8 | ConvertFrom-Json
$posts = $json.posts
$pdfDir = Join-Path $RootDir "pdfs"

if (-not (Test-Path -LiteralPath $pdfDir)) {
    New-Item -ItemType Directory -Path $pdfDir -Force | Out-Null
}

$downloaded = 0

foreach ($post in $posts) {
    if ($post.pdfUrl -and (Test-Path -LiteralPath (Join-Path $RootDir $post.pdfUrl.TrimStart('/')))) {
        continue
    }

    $sourceUrl = $post.pdfSourceUrl
    if (-not $sourceUrl) { continue }

    $pdfFileName = "$($post.id).pdf"
    $pdfPath = Join-Path $pdfDir $pdfFileName

    if (Test-Path -LiteralPath $pdfPath) { continue }

    try {
        Write-Output "Attempting PDF download: $($post.title)"
        $resp = Invoke-WebRequest -Uri $sourceUrl -UseBasicParsing -TimeoutSec 20

        $contentType = $resp.Headers.'Content-Type'
        $isPdf = $contentType -match 'pdf' -or $sourceUrl -match '\.pdf'

        if ($isPdf) {
            [System.IO.File]::WriteAllBytes($pdfPath, $resp.Content)
            $post.pdfUrl = "/pdfs/$pdfFileName"
            $downloaded++
            Write-Output "  OK: $pdfFileName"
        }
        else {
            Write-Output "  SKIP: Not a PDF (Content-Type: $contentType)"
            $post.pdfSourceUrl = $sourceUrl
        }
    }
    catch {
        Write-Output "  ERROR: $($_.Exception.Message)"
        $post.pdfSourceUrl = $sourceUrl
    }
}

if ($downloaded -gt 0) {
    $json | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $dataPath -Encoding UTF8
    Write-Output "`nDownloaded $downloaded PDFs"
}
else {
    Write-Output "`nNo new PDFs downloaded"
}
