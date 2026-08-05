[CmdletBinding()]
param(
    [string]$RootDir = $PSScriptRoot
)

$dataPath = Join-Path $RootDir "data\posts.json"
$json = Get-Content -LiteralPath $dataPath -Raw -Encoding UTF8 | ConvertFrom-Json
$site = $json.site
$categories = $json.categories

function Get-NavHtml {
    return @'
    <nav class="links">
      <a href="/">Home</a>
      <div class="dropdown">
        <a href="#">महाराष्ट्र भरती</a>
        <div class="dropdown-menu">
          <a href="/mpsc/">MPSC (राज्यसेवा, संयुक्त)</a>
          <a href="/police/">पोलीस भरती</a>
          <a href="/talathi/">तलाठी भरती</a>
          <a href="/zp/">जि. प. / जिल्हा न्यायालय / आरोग्य विभाग</a>
        </div>
      </div>
      <div class="dropdown">
        <a href="#">केंद्र सरकारी भरती</a>
        <div class="dropdown-menu">
          <a href="/ssc/">SSC (CGL, CHSL, GD, MTS)</a>
          <a href="/rrb/">Railway / RRB (NTPC, Group D, ALP)</a>
          <a href="/army/">Defense (Army, Navy, Airforce)</a>
          <a href="/banking/">Banking (IBPS, SBI)</a>
        </div>
      </div>
      <div class="dropdown">
        <a href="#">ॲडमिट कार्ड & निकाल</a>
        <div class="dropdown-menu">
          <a href="/admit-card/">Hall Tickets</a>
          <a href="/answer-key/">उत्तरतालिका (Answer Keys)</a>
          <a href="/results/">परीक्षा निकाल</a>
        </div>
      </div>
      <div class="dropdown">
        <a href="#">अभ्यास सामग्री</a>
        <div class="dropdown-menu">
          <a href="/current-affairs/">चालू घडामोडी (Current Affairs)</a>
          <a href="/pyq/">जुन्या प्रश्नपत्रिका (PYQ)</a>
          <a href="/syllabus/">अभ्यासक्रम (Syllabus)</a>
        </div>
      </div>
      <a href="/yojna/">शासकीय योजना</a>
    </nav>
'@
}

function Get-FooterHtml {
    return @'
<footer>
  <div class="wrap footer-grid">
    <div>
      <h3>MarathiAura</h3>
      <p>MPSC, तलाठी, पोलीस भरती, आर्मी, RRB, SSC परीक्षांचे विश्वासार्ह अपडेट्स, अभ्यासक्रम आणि तयारी टिप्स मराठीत.</p>
    </div>
    <div>
      <h3>Categories</h3>
      <ul>
        <li><a href="/mpsc/">MPSC</a></li>
        <li><a href="/talathi/">Talathi</a></li>
        <li><a href="/police/">Police bharti</a></li>
        <li><a href="/army/">Army</a></li>
        <li><a href="/rrb/">RRB</a></li>
        <li><a href="/ssc/">SSC</a></li>
        <li><a href="/banking/">Banking</a></li>
        <li><a href="/answer-key/">उत्तरतालिका &amp; कटऑफ</a></li>
        <li><a href="/yojna/">शासकीय योजना</a></li>
      </ul>
    </div>
    <div>
      <h3>Quick links</h3>
      <ul>
        <li><a href="/">Home</a></li>
        <li><a href="/about.html">About</a></li>
        <li><a href="/contact.html">Contact us</a></li>
        <li><a href="/privacy-policy.html">Privacy policy</a></li>
        <li><a href="/terms-and-conditions.html">Terms and conditions</a></li>
        <li><a href="/disclaimer.html">Disclaimer</a></li>
      </ul>
    </div>
  </div>
  <div class="bottom">&copy; 2026 MarathiAura | Trusted Competitive Exam Updates</div>
</footer>
'@
}

function Get-JoinCtaHtml {
    return @'
<section class="join-cta">
  <div class="join-cta-inner">
    <div class="join-cta-text">
      <div class="join-cta-title">&#128276; सर्वात आधी अपडेट्स मिळवा</div>
      <div class="join-cta-sub">नवीन भरती, निकाल अभ्यासक्रम इथे तुमच्या फोनवर सर्वप्रथम</div>
    </div>
    <div class="join-cta-buttons">
      <a class="join-btn telegram" href="https://t.me/+zCKGI81nUS83ZDE1" target="_blank" rel="noopener">
        <svg class="join-icon" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="120" cy="120" r="120" fill="#229ED9"/><path fill="#fff" d="M179.6 72.4l-20.4 96.2c-1.5 6.8-5.5 8.5-11.2 5.3l-31-22.9-15 14.4c-1.7 1.7-3.1 3.1-6.3 3.1l2.3-31.9 58-52.4c2.5-2.3-.5-3.5-3.9-1.3l-71.7 45.1-30.9-9.7c-6.7-2.1-6.8-6.7 1.4-9.9l120.9-46.6c5.6-2.1 10.5 1.3 8.8 9.6z"/></svg>
        Telegram जॉइन करा
      </a>
      <a class="join-btn whatsapp" href="https://whatsapp.com/channel/0029Vb8NfVsAzNc0x5mGX32b" target="_blank" rel="noopener">
        <svg class="join-icon" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="#25D366"/><path fill="#fff" d="M23.5 8.5A9.9 9.9 0 0 0 16.1 5.4c-5.5 0-10 4.5-10 10 0 1.8.5 3.5 1.3 5l-1.4 5.1 5.2-1.4c1.4.8 3.1 1.2 4.8 1.2 5.5 0 10-4.5 10-10 0-2.7-1-5.2-2.9-7.1zm-7.4 15.3c-1.5 0-3-.4-4.3-1.2l-.3-.2-3.2.8.9-3.1-.2-.3a8.3 8.3 0 0 1-1.3-4.5c0-4.6 3.7-8.3 8.3-8.3 2.2 0 4.3.9 5.9 2.4a8.2 8.2 0 0 1 2.4 5.9c0 4.6-3.8 8.5-8.2 8.5zm4.5-6.2c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.2-.7.8-.8 1-.2.2-.3.2-.5.1-.2-.1-1-.4-1.9-1.2-.7-.6-1.2-1.4-1.3-1.6-.2-.2 0-.4.1-.5l.4-.4c.1-.1.2-.2.2-.4.1-.2 0-.3 0-.5-.1-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.2-.9.9-.9 2.2s1 2.6 1.1 2.8c.1.2 2 3 4.7 4.2.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3z"/></svg>
         WhatsApp जॉइन करा
       </a>
       <a class="join-btn youtube" href="https://www.youtube.com/@MarathiAura-exam" target="_blank" rel="noopener">
         <svg class="join-icon" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="#FF0000"/><path fill="#fff" d="M23.5 9.5c-.4-1.5-1.6-2.7-3.1-3.1C17.5 6 16 6 16 6s-1.5 0-4.4.4c-1.5.4-2.7 1.6-3.1 3.1C8 12.5 8 16 8 16s0 3.5.5 6.5c.4 1.5 1.6 2.7 3.1 3.1 2.9.4 4.4.4 4.4.4s1.5 0 4.4-.4c1.5-.4 2.7-1.6 3.1-3.1.5-3 .5-6.5.5-6.5s0-3.5-.5-6.5zm-9.2 9.3v-5.6l5.3 2.8-5.3 2.8z"/></svg>
         Youtube जॉइन करा
       </a>
    </div>
  </div>
</section>
'@
}

function Generate-OgImage($post) {
    $ogDir = Join-Path $RootDir "og-images"
    if (-not (Test-Path -LiteralPath $ogDir)) { New-Item -ItemType Directory -Path $ogDir -Force | Out-Null }

    $cat = $categories | Where-Object { $_.id -eq $post.category } | Select-Object -First 1
    $catName = if ($cat) { $cat.nameMr } else { "अपडेट" }

    $safeTitle = $post.title -replace '&', '&amp;' -replace '"', '&quot;' -replace '<', '&lt;' -replace '>', '&gt;'
    $titleLine1 = $safeTitle
    $titleLine2 = ""
    if ($safeTitle.Length -gt 50) {
        $words = $safeTitle.Split(' ')
        $line1Words = @()
        $line2Words = @()
        $current = $line1Words
        foreach ($w in $words) {
            if (($current -join ' ').Length + $w.Length -lt 48 -and $current -eq $line1Words) {
                $line1Words += $w
            } else {
                if ($current -eq $line1Words) { $current = $line2Words }
                $line2Words += $w
            }
        }
        $titleLine1 = $line1Words -join ' '
        $titleLine2 = $line2Words -join ' '
    }

    $svg = @"
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0c447c"/>
      <stop offset="100%" style="stop-color:#2074b8"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="0" y="0" width="1200" height="6" fill="#ff6f00"/>
  <text x="60" y="100" font-family="Arial,sans-serif" font-size="28" fill="#ff6f00" font-weight="bold">$catName</text>
  <text x="60" y="200" font-family="Arial,sans-serif" font-size="52" fill="#ffffff" font-weight="bold">$titleLine1</text>
  <text x="60" y="270" font-family="Arial,sans-serif" font-size="52" fill="#ffffff" font-weight="bold">$titleLine2</text>
  <rect x="60" y="330" width="100" height="4" fill="#ff6f00"/>
  <text x="60" y="400" font-family="Arial,sans-serif" font-size="30" fill="#dce8f5">marathiaura.in</text>
  <text x="60" y="450" font-family="Arial,sans-serif" font-size="24" fill="#a8c8e8">विश्वासार्ह भरती अपडेट्स मराठीत</text>
</svg>
"@

    $svgPath = Join-Path $ogDir "$($post.id).svg"
    [System.IO.File]::WriteAllText($svgPath, $svg, [System.Text.UTF8Encoding]::new($false))
    return "/og-images/$($post.id).svg"
}

function Render-Section($section) {
    $sb = [System.Text.StringBuilder]::new()
    [void]$sb.AppendLine("  <div class=""content-section"">")
    [void]$sb.AppendLine("    <h2>$($section.heading)</h2>")

    if ($section.type -eq "table") {
        [void]$sb.AppendLine("    <table class=""info-table"">")
        [void]$sb.AppendLine("      <thead><tr>")
        foreach ($h in $section.headers) {
            [void]$sb.AppendLine("        <th>$h</th>")
        }
        [void]$sb.AppendLine("      </tr></thead>")
        [void]$sb.AppendLine("      <tbody>")
        foreach ($row in $section.rows) {
            [void]$sb.AppendLine("        <tr>")
            foreach ($cell in $row) {
                [void]$sb.AppendLine("          <td>$cell</td>")
            }
            [void]$sb.AppendLine("        </tr>")
        }
        [void]$sb.AppendLine("      </tbody></table>")
    }
    elseif ($section.type -eq "list") {
        [void]$sb.AppendLine("    <ul>")
        foreach ($item in $section.items) {
            [void]$sb.AppendLine("      <li>$item</li>")
        }
        [void]$sb.AppendLine("    </ul>")
    }
    elseif ($section.type -eq "olist") {
        [void]$sb.AppendLine("    <ol>")
        foreach ($item in $section.items) {
            [void]$sb.AppendLine("      <li>$item</li>")
        }
        [void]$sb.AppendLine("    </ol>")
    }
    elseif ($section.type -eq "text") {
        [void]$sb.AppendLine("    <p>$($section.body)</p>")
    }

    [void]$sb.AppendLine("  </div>")
    return $sb.ToString()
}

function Generate-PostPage($post) {
    $cat = $categories | Where-Object { $_.id -eq $post.category } | Select-Object -First 1
    $catName = if ($cat) { $cat.name } else { "" }
    $catPath = if ($cat) { $cat.path } else { "/" }
    $catNameMr = if ($cat) { $cat.nameMr } else { "अपडेट" }

    $badgeHtml = ""
    if ($post.badge -eq "new") { $badgeHtml = " <span class=""badge badge-new"">नवीन</span>" }
    elseif ($post.badge -eq "urgent") { $badgeHtml = " <span class=""badge badge-urgent"">तातडीचे</span>" }

    $navHtml = Get-NavHtml
    $footerHtml = Get-FooterHtml
    $joinCtaHtml = Get-JoinCtaHtml

    $ogImagePath = Generate-OgImage $post

    $sectionsHtml = ""
    foreach ($sec in $post.sections) {
        $sectionsHtml += Render-Section $sec
    }

    $importantLinksHtml = ""
    $ilSb = [System.Text.StringBuilder]::new()
    [void]$ilSb.AppendLine("  <div class=""content-section"">")
    [void]$ilSb.AppendLine("    <h2>महत्वाच्या लिंक्स</h2>")
    [void]$ilSb.AppendLine("    <div class=""post-list"">")

    if ($post.pdfUrl) {
        [void]$ilSb.AppendLine("      <div class=""download-card"">")
        [void]$ilSb.AppendLine("        <div class=""dl-info"">")
        [void]$ilSb.AppendLine("          <div class=""dl-title"">सविस्तर जाहिरात (PDF)</div>")
        [void]$ilSb.AppendLine("          <div class=""dl-meta"">अधिकृत PDF जाहिरात डाउनलोड करा</div>")
        [void]$ilSb.AppendLine("        </div>")
        [void]$ilSb.AppendLine("        <a href=""$($post.pdfUrl)"" download>PDF डाउनलोड</a>")
        [void]$ilSb.AppendLine("      </div>")
    }
    elseif ($post.pdfSourceUrl) {
        [void]$ilSb.AppendLine("      <div class=""download-card"">")
        [void]$ilSb.AppendLine("        <div class=""dl-info"">")
        [void]$ilSb.AppendLine("          <div class=""dl-title"">सविस्तर जाहिरात (PDF)</div>")
        [void]$ilSb.AppendLine("          <div class=""dl-meta"">अधिकृत संकेतस्थळावरून PDF डाउनलोड करा</div>")
        [void]$ilSb.AppendLine("        </div>")
        [void]$ilSb.AppendLine("        <a href=""$($post.pdfSourceUrl)"" target=""_blank"" rel=""noopener"">PDF पहा</a>")
        [void]$ilSb.AppendLine("      </div>")
    }

    if ($post.importantLinks -and $post.importantLinks.Count -gt 0) {
        foreach ($link in $post.importantLinks) {
            [void]$ilSb.AppendLine("      <div class=""download-card"">")
            [void]$ilSb.AppendLine("        <div class=""dl-info"">")
            [void]$ilSb.AppendLine("          <div class=""dl-title"">$($link.title)</div>")
            [void]$ilSb.AppendLine("        </div>")
            [void]$ilSb.AppendLine("        <a href=""$($link.url)"" target=""_blank"" rel=""noopener"">$($link.label)</a>")
            [void]$ilSb.AppendLine("      </div>")
        }
    }

    [void]$ilSb.AppendLine("    </div>")
    [void]$ilSb.AppendLine("  </div>")
    $importantLinksHtml = $ilSb.ToString()

    $keywordsStr = ""
    if ($post.keywords -and $post.keywords.Count -gt 0) {
        $keywordsStr = $post.keywords -join ", "
    }

    $applyLinkHtml = ""
    if ($post.applyLink) {
        $applyLinkHtml = @"
  <div class="alert-bar">
    <div class="alert-text">
      <strong>&#9888; तातडीचे:</strong> ऑनलाइन अर्ज शेवटच्या तारखेपूर्वी नक्की करा!
    </div>
    <a class="cta-btn" href="$($post.applyLink)" target="_blank" rel="noopener">अर्ज करा</a>
  </div>
"@
    }

    $faqSchema = ""
    if ($post.sections) {
        $faqItems = @()
        foreach ($sec in $post.sections) {
            if ($sec.type -eq "list" -and $sec.items.Count -gt 0) {
                $answer = ($sec.items | Select-Object -First 3) -join " "
                $faqItems += @{ "@type" = "Question"; "name" = $sec.heading; "acceptedAnswer" = @{ "@type" = "Answer"; "text" = $answer } }
            }
        }
        if ($faqItems.Count -gt 0) {
            $faqSchema = "<script type=""application/ld+json"">" + "`n{`n  ""@context"": ""https://schema.org"",`n  ""@type"": ""FAQPage"",`n  ""mainEntity"": " + ($faqItems | ConvertTo-Json -Depth 5 -Compress) + "`n}`n</script>"
        }
    }

    $page = @"
<!DOCTYPE html>
<html lang="mr">
<head>
<meta charset="UTF-8">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
<title>$($post.title) – MarathiAura</title>
<meta name="description" content="$($post.shortDesc)">
<meta name="keywords" content="$keywordsStr">
<meta name="author" content="MarathiAura टीम">
<meta name="robots" content="index, follow">
<link rel="canonical" href="$($site.url)/$($post.slug)">
<meta property="og:title" content="$($post.title) – MarathiAura">
<meta property="og:description" content="$($post.shortDesc)">
<meta property="og:image" content="$($site.url)$ogImagePath">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/svg+xml">
<meta property="og:type" content="article">
<meta property="og:url" content="$($site.url)/$($post.slug)">
<meta property="og:site_name" content="MarathiAura">
<meta property="og:locale" content="mr_IN">
<meta property="article:published_time" content="$($post.date)T00:00:00+05:30">
<meta property="article:modified_time" content="$($post.updated)T00:00:00+05:30">
<meta property="article:section" content="$catNameMr">
$(if ($post.keywords) { ($post.keywords | ForEach-Object { "<meta property=""article:tag"" content=""$_"">" }) -join "`n" })
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="$($post.title) – MarathiAura">
<meta name="twitter:description" content="$($post.shortDesc)">
<meta name="twitter:image" content="$($site.url)$ogImagePath">
<meta name="twitter:site" content="@marathiaura">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "$($post.title)",
  "datePublished": "$($post.date)",
  "dateModified": "$($post.updated)",
  "author": {"@type": "Organization", "name": "MarathiAura"},
  "publisher": {"@type": "Organization", "name": "MarathiAura", "url": "$($site.url)"},
  "mainEntityOfPage": "$($site.url)/$($post.slug)",
  "description": "$($post.shortDesc)",
  "image": "$($site.url)$ogImagePath"
}
</script>
$faqSchema
<link rel="stylesheet" href="/style.css">
<link rel="manifest" href="/manifest.json">
</head>
<body>

<div class="progress-bar" id="reading-progress"></div>

<header>
  <div class="wrap navbar">
    <a href="/" style="display:flex; align-items:center; text-decoration:none;">
  <img src="/logo-nav.png" alt="MarathiAura" style="height:44px; width:auto;">
</a>
    $navHtml
  </div>
  <div class="wrap">
    <form class="search-box" action="/search.html" method="get" role="search">
      <input type="search" name="q" placeholder="भरती शोधा..." aria-label="Search">
      <button type="submit">शोधा</button>
    </form>
  </div>
</header>

<main class="wrap">

  <div class="breadcrumb"><a href="/">Home</a> &rsaquo; <a href="$catPath">$catName</a> &rsaquo; $($post.title)</div>

  <div class="page-header">
    <h1>$($post.title)$badgeHtml</h1>
  </div>
  <div class="last-updated">प्रकाशित: $($post.date) &middot; अखेरचे अद्ययावत: $($post.updated) &middot; MarathiAura टीम</div>

  <div class="content-section">
    <p><strong>थोडक्यात:</strong> $($post.shortDesc)</p>
  </div>

$applyLinkHtml

$sectionsHtml

$importantLinksHtml

  <div class="trust-row">
    <span>&#128196; स्रोत: <a href="$($post.applyLink)" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:underline;">अधिकृत संकेतस्थळ</a></span>
    <span>&#9888; ही माहिती केवळ सर्वसाधारण मार्गदर्शनासाठी आहे. अंतिम व अचूक माहितीसाठी नेहमी अधिकृत जाहिरात तपासा.</span>
  </div>

$joinCtaHtml

</main>

$footerHtml

<script>
(function(){
  var bar=document.getElementById('reading-progress');
  if(!bar)return;
  function update(){
    var h=document.documentElement.scrollHeight-window.innerHeight;
    if(h<=0){bar.style.width='0%';return;}
    var s=window.scrollY;
    bar.style.width=Math.min((s/h)*100,100)+'%';
  }
  window.addEventListener('scroll',update,{passive:true});
  window.addEventListener('resize',update);
  update();
})();
</script>

</body>
</html>
"@

    $outPath = Join-Path $RootDir $post.slug
    $outDir = Split-Path $outPath -Parent
    if (-not (Test-Path -LiteralPath $outDir)) {
        New-Item -ItemType Directory -Path $outDir -Force | Out-Null
    }
    [System.IO.File]::WriteAllText($outPath, $page, [System.Text.UTF8Encoding]::new($false))
    Write-Output "Generated: $($post.slug)"
}

foreach ($post in $json.posts) {
    Generate-PostPage $post
}

Write-Output "`nDone. Generated $($json.posts.Count) post pages from posts.json"
