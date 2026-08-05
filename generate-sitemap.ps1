[CmdletBinding()]
param(
    [string]$SiteUrl = "https://marathiaura.in",
    [string]$RootDir = $PSScriptRoot
)

Set-Location -LiteralPath $RootDir

$lowPriority = @("privacy-policy.html","terms-and-conditions.html","disclaimer.html","404.html","search.html")
$medPriority = @("about.html","contact.html")

$htmlFiles = Get-ChildItem -Recurse -Filter "*.html" | Where-Object { $_.FullName -notmatch '\\node_modules\\' }

$entries = @()

foreach ($file in $htmlFiles) {
    $rel = $file.FullName.Substring($RootDir.Length).Replace('\','/')
    if ($rel.StartsWith('/')) { $rel = $rel.Substring(1) }

    $loc = "$SiteUrl/$rel"

    if ($rel -eq "index.html") {
        $loc = $SiteUrl + "/"
        $priority = "1.0"
        $changefreq = "daily"
    }
    elseif ($rel -match '^(.+?)/index\.html$') {
        $loc = "$SiteUrl/$($Matches[1])/"
        $priority = "0.9"
        $changefreq = "daily"
    }
    elseif ($lowPriority -contains $rel) {
        $priority = "0.3"
        $changefreq = "yearly"
    }
    elseif ($medPriority -contains $rel) {
        $priority = "0.5"
        $changefreq = "monthly"
    }
    else {
        $priority = "0.8"
        $changefreq = "weekly"
    }

    $lastmod = $file.LastWriteTime.ToString("yyyy-MM-dd")

    $entries += "  <url>`n    <loc>$loc</loc>`n    <lastmod>$lastmod</lastmod>`n    <changefreq>$changefreq</changefreq>`n    <priority>$priority</priority>`n  </url>"
}

$sitemap = "<?xml version=`"1.0`" encoding=`"UTF-8`"?>`n<urlset xmlns=`"http://www.sitemaps.org/schemas/sitemap/0.9`">`n$($entries -join "`n")`n</urlset>"

$sitemapPath = Join-Path $RootDir "sitemap.xml"
[System.IO.File]::WriteAllText($sitemapPath, $sitemap, [System.Text.UTF8Encoding]::new($false))

Write-Output "sitemap.xml generated with $($entries.Count) URLs"
