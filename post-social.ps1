[CmdletBinding()]
param(
    [string]$RootDir = $PSScriptRoot
)

$dataPath = Join-Path $RootDir "data\posts.json"
$json = Get-Content -LiteralPath $dataPath -Raw -Encoding UTF8 | ConvertFrom-Json
$site = $json.site
$posts = $json.posts

$WHATSAPP_API = $env:WHATSAPP_API_KEY
$INSTAGRAM_TOKEN = $env:INSTAGRAM_ACCESS_TOKEN
$INSTAGRAM_ACCOUNT = $env:INSTAGRAM_BUSINESS_ACCOUNT_ID
$YOUTUBE_CLIENT = $env:YOUTUBE_CLIENT_SECRETS
$YOUTUBE_CREDENTIALS = $env:YOUTUBE_CREDENTIALS

$postedCount = 0

foreach ($post in $posts) {
    if (-not $post.socialPosted) { continue }

    $url = "$($site.url)/$($post.slug)"
    $cat = $json.categories | Where-Object { $_.id -eq $post.category } | Select-Object -First 1
    $catName = if ($cat) { $cat.nameMr } else { "अपडेट" }

    $shortMsg = "$($post.title)`n`n$catName | MarathiAura`n`nअर्ज करा: $($post.applyLink)`n`nवाचा: $url"

    if ($post.applyLink) {
        $shortMsg += "`n`nअर्ज करा: $($post.applyLink)"
    }

    if (-not $post.socialPosted.whatsapp -and $WHATSAPP_API) {
        try {
            $body = @{
                messaging_product = "whatsapp"
                to = $env:WHATSAPP_RECIPIENT_ID
                type = "text"
                text = @{ body = $shortMsg }
            } | ConvertTo-Json -Depth 5

            $headers = @{
                "Authorization" = "Bearer $WHATSAPP_API"
                "Content-Type" = "application/json"
            }

            $response = Invoke-RestMethod -Uri "https://graph.facebook.com/v19.0/$($env:WHATSAPP_PHONE_NUMBER_ID)/messages" -Method Post -Body $body -Headers $headers -ContentType "application/json"
            $post.socialPosted.whatsapp = $true
            Write-Output "  WhatsApp posted: $($post.title)"
        }
        catch {
            Write-Output "  WhatsApp ERROR: $($_.Exception.Message)"
        }
    }

    if (-not $post.socialPosted.instagram -and $INSTAGRAM_TOKEN -and $INSTAGRAM_ACCOUNT) {
        try {
            $igCaption = "$($post.title)`n`n$($post.shortDesc)`n`n#$($post.category) #भरती #MarathiAura #महाराष्ट्र #नोकरी #sarkarijob #exam"

            $igBody = @{
                image_url = "$($site.url)$($post.ogImage)"
                caption = $igCaption
            } | ConvertTo-Json -Depth 5

            $igHeaders = @{
                "Authorization" = "Bearer $INSTAGRAM_TOKEN"
                "Content-Type" = "application/json"
            }

            $containerResp = Invoke-RestMethod -Uri "https://graph.facebook.com/v19.0/$INSTAGRAM_ACCOUNT/media" -Method Post -Body $igBody -Headers $igHeaders -ContentType "application/json"
            Start-Sleep -Seconds 5

            $publishBody = @{
                creation_id = $containerResp.id
            } | ConvertTo-Json -Depth 5

            Invoke-RestMethod -Uri "https://graph.facebook.com/v19.0/$INSTAGRAM_ACCOUNT/media_publish" -Method Post -Body $publishBody -Headers $igHeaders -ContentType "application/json"
            $post.socialPosted.instagram = $true
            Write-Output "  Instagram posted: $($post.title)"
        }
        catch {
            Write-Output "  Instagram ERROR: $($_.Exception.Message)"
        }
    }

    if (-not $post.socialPosted.youtube -and $YOUTUBE_CLIENT -and $YOUTUBE_CREDENTIALS) {
        try {
            $ytTitle = "$($post.title) — MarathiAura"
            $ytDesc = "$($post.shortDesc)`n`nअर्ज करा: $($post.applyLink)`nवाचा: $url`n`n#भरती #$($post.category) #MarathiAura #महाराष्ट्र"

            $ytScript = @"
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
import json, sys

creds = Credentials.from_authorized_user_file('$YOUTUBE_CREDENTIALS')
youtube = build('youtube', 'v3', credentials=creds)
request = youtube.playlistItems().insert(
    part='snippet',
    body={
        'snippet': {
            'playlistId': '$($env:YOUTUBE_PLAYLIST_ID)',
            'resourceId': {
                'kind': 'youtube#video',
                'videoId': sys.argv[1]
            }
        }
    }
)
request.execute()
"@
            Write-Output "  YouTube: Video needs manual upload. Title: $ytTitle"
            Write-Output "  YouTube Description: $ytDesc"
            $post.socialPosted.youtube = $true
        }
        catch {
            Write-Output "  YouTube ERROR: $($_.Exception.Message)"
        }
    }

    $allPosted = $post.socialPosted.whatsapp -and $post.socialPosted.instagram -and $post.socialPosted.youtube
    if ($allPosted) { $postedCount++ }
}

$json | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $dataPath -Encoding UTF8
Write-Output "`nSocial posting complete. $postedCount posts fully posted."
