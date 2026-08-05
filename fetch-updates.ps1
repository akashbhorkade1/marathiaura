[CmdletBinding()]
param(
    [string]$RootDir = $PSScriptRoot
)

$dataPath = Join-Path $RootDir "data\posts.json"
$json = Get-Content -LiteralPath $dataPath -Raw -Encoding UTF8 | ConvertFrom-Json
$feeds = $json.feeds
$posts = $json.posts
$categories = $json.categories
$newCount = 0

$categoryKeywords = @{
    "army"     = @("army","agniveer","defence","defense","navy","airforce","nda","cds","ssc tech","jco","sepoy")
    "mpsc"     = @("mpsc","rajyaseva","combined","संयुक्त","राज्यसेवा")
    "police"   = @("police","constable","sipahi","पोलीस","सिपाही")
    "talathi"  = @("talathi","तलाठी","revenue")
    "rrb"      = @("rrb","railway","ntpc","group d","alp","रेल्वे")
    "ssc"      = @("ssc","cgl","chsl","mts","gd constable")
    "banking"  = @("ibps","sbi","bank","rbi","clerk","po","बँक")
    "yojna"    = @("yojna","yojana","scheme","योजना","शासकीय योजना","मुख्यमंत्री","प्रधानमंत्री","लाभ","सबसिडी")
}

function Detect-Category($title) {
    $t = $title.ToLower()
    foreach ($kv in $categoryKeywords.GetEnumerator()) {
        foreach ($kw in $kv.Value) {
            if ($t -match [regex]::Escape($kw)) {
                return $kv.Key
            }
        }
    }
    return "mixed"
}

function Make-Slug($title, $category) {
    $s = $title.ToLower() -replace '[^\w\s-]', '' -replace '\s+', '-'
    $s = $s.Substring(0, [Math]::Min($s.Length, 60))
    $s = $s.TrimEnd('-')
    $catPath = $category
    if ($category -eq "mixed") { $catPath = "updates" }
    return "$catPath/$s.html"
}

function Make-Id($title) {
    $s = $title.ToLower() -replace '[^\w\s]', '' -replace '\s+', '-'
    return $s.Substring(0, [Math]::Min($s.Length, 50)).TrimEnd('-')
}

function Normalize-Title($title) {
    return ($title.ToLower().Trim() -replace '\s+', ' ' -replace '[^\w\s]', '')
}

function Extract-ApplyLink($desc, $link) {
    if ($link -and $link -match '^https?://') { return $link }
    $m = [regex]::Match($desc, 'https?://[^\s<>"\)]+')
    if ($m.Success) { return $m.Value }
    return ""
}

function Generate-Keywords($title, $category) {
    $kws = @()
    $t = $title
    $kws += $t
    $catObj = $categories | Where-Object { $_.id -eq $category } | Select-Object -First 1
    if ($catObj) { $kws += $catObj.nameMr }
    if ($t -match '(\d{4})') { $kws += "भरती $($Matches[1])" }
    if ($category -eq "yojna") { $kws += @("शासकीय योजना", "महाराष्ट्र योजना", "सबसिडी", "लाभ") }
    elseif ($category -eq "army") { $kws += @("आर्मी भरती", "अग्निवीर", "लष्कर भरती") }
    elseif ($category -eq "mpsc") { $kws += @("MPSC भरती", "राज्यसेवा परीक्षा") }
    elseif ($category -eq "police") { $kws += @("पोलीस भरती", "कॉन्स्टेबल") }
    elseif ($category -eq "rrb") { $kws += @("रेल्वे भरती", "NTPC") }
    elseif ($category -eq "ssc") { $kws += @("SSC भरती", "CGL") }
    $kws += "MarathiAura"
    return ($kws | Select-Object -Unique)
}

function Expand-Content($title, $desc, $category, $link) {
    $sections = @()

    $sections += @{
        heading = "सविस्तर माहिती"
        type = "text"
        body = $desc
    }

    if ($category -ne "yojna") {
        $sections += @{
            heading = "पात्रता व महत्वाची माहिती"
            type = "list"
            items = @(
                "ही भरती भारत सरकार / महाराष्ट्र शासनाच्या अधिकृत जाहिरातीनुसार आहे",
                "अर्ज करण्यापूर्वी अधिकृत जाहिरात नक्की वाचा",
                "ऑनलाइन अर्ज अधिकृत संकेतस्थळावरूनच करा",
                "अर्ज शेवटच्या तारखेपूर्वी नक्की सादर करा",
                "कोणत्याही मध्यस्थाला पैसे देऊ नका — ही भरती निःशुल्क आहे"
            )
        }

        $sections += @{
            heading = "तयारीचे टिप्स"
            type = "list"
            items = @(
                "अभ्यासक्रम पूर्णपणे समजून घ्या",
                "जुन्या प्रश्नपत्रिका सोडवा (MarathiAura वर उपलब्ध)",
                "रोजच्या चालू घडामोडी वाचा",
                "मॉक टेस्ट द्या आणि वेळेचे नियोजन करा",
                "Telegram आणि WhatsApp ग्रुप जॉइन करा — सर्वात आधी अपडेट मिळवा"
            )
        }
    }
    else {
        $sections += @{
            heading = "योजनेचे फायदे"
            type = "list"
            items = @(
                "महाराष्ट्रातील पात्र नागरिकांना लाभ मिळेल",
                "अर्ज प्रक्रिया ऑनलाइन किंवा ऑफलाइन उपलब्ध",
                "आर्थिक मदत / सबसिडी लाभ",
                "अधिकृत संकेतस्थळावरून सविस्तर माहिती मिळवा"
            )
        }

        $sections += @{
            heading = "अर्ज कसा करावा"
            type = "olist"
            items = @(
                "अधिकृत संकेतस्थळावर जा",
                "नोंदणी करा किंवा लॉग इन करा",
                "आवश्यक माहिती भरा",
                "कागदपत्रे अपलोड करा",
                "अर्ज सादर करा आणि पावती डाउनलोड करा"
            )
        }

        $sections += @{
            heading = "महत्वाची सूचना"
            type = "text"
            body = "ही योजना महाराष्ट्र शासन / केंद्र सरकारची आहे. पात्र नागरिकांनी अर्ज नक्की करावा. अधिकृत संकेतस्थळावरूनच अर्ज करावा. कोणत्याही अधिकृत नसलेल्या व्यक्तीला पैसे देऊ नका."
        }
    }

    return $sections
}

$existingIds = @($posts | ForEach-Object { $_.id })
$existingSlugs = @($posts | ForEach-Object { $_.slug })
$existingLinks = @($posts | ForEach-Object { $_.sourceUrl })
$existingTitlesNorm = @($posts | ForEach-Object { Normalize-Title $_.title })

$hasNewBharti = $false

foreach ($feed in $feeds) {
    Write-Output "Fetching: $($feed.name) ($($feed.url))"

    try {
        $rss = [xml](Invoke-WebRequest -Uri $feed.url -UseBasicParsing -TimeoutSec 30).Content
        $items = $rss.rss.channel.item

        foreach ($item in $items | Select-Object -First 15) {
            $title = $item.title
            if (-not $title) { continue }

            $desc = if ($item.description) { $item.description } else { $title }
            $desc = $desc -replace '<[^>]+>', ''
            if ($desc.Length -gt 300) { $desc = $desc.Substring(0, 300) + "..." }

            $pubDate = if ($item.pubDate) {
                try { ([DateTime]$item.pubDate).ToString("yyyy-MM-dd") } catch { (Get-Date).ToString("yyyy-MM-dd") }
            } else {
                (Get-Date).ToString("yyyy-MM-dd")
            }

            $link = if ($item.link) { $item.link } else { "" }

            $cat = Detect-Category $title
            if ($feed.category -eq "yojna") { $cat = "yojna" }

            $id = Make-Id $title
            $slug = Make-Slug $title $cat
            $normTitle = Normalize-Title $title

            $isDuplicate = $false
            if ($id -in $existingIds) { $isDuplicate = $true }
            if (-not $isDuplicate -and $slug -in $existingSlugs) { $isDuplicate = $true }
            if (-not $isDuplicate -and $link -and $link -in $existingLinks) { $isDuplicate = $true }
            if (-not $isDuplicate -and $normTitle -in $existingTitlesNorm) { $isDuplicate = $true }
            if ($isDuplicate) { continue }

            $idx = 1; $baseSlug = $slug
            while ($slug -in $existingSlugs) { $slug = $baseSlug -replace '\.html$', "-$idx.html"; $idx++ }

            $baseId = $id; $idIdx = 1
            while ($id -in $existingIds) { $id = "$baseId-$idIdx"; $idIdx++ }

            $applyLink = Extract-ApplyLink $desc $link
            $keywords = Generate-Keywords $title $cat
            $sections = Expand-Content $title $desc $cat $link

            $importantLinks = @()
            if ($applyLink) {
                $importantLinks += @{ title = "ऑनलाइन अर्ज करा"; url = $applyLink; label = "अर्ज करा" }
            }
            if ($link -and $link -ne $applyLink) {
                $importantLinks += @{ title = "अधिकृत जाहिरात पहा"; url = $link; label = "जाहिरात पहा" }
            }

            $newPost = @{
                id = $id
                title = $title
                category = $cat
                slug = $slug
                badge = "new"
                date = $pubDate
                updated = (Get-Date).ToString("yyyy-MM-dd")
                shortDesc = $desc
                keywords = $keywords
                applyLink = $applyLink
                pdfUrl = ""
                pdfSourceUrl = $applyLink
                ogImage = "/og-images/$id.svg"
                wordCount = 0
                socialPosted = @{ whatsapp = $false; instagram = $false; youtube = $false }
                sourceUrl = $link
                sourceName = $feed.name
                importantLinks = $importantLinks
                sections = $sections
            }

            $json.posts += [PSCustomObject]$newPost
            $existingIds += $id
            $existingSlugs += $slug
            if ($link) { $existingLinks += $link }
            $existingTitlesNorm += $normTitle
            $newCount++
            if ($cat -ne "yojna") { $hasNewBharti = $true }
            Write-Output "  NEW: $title"
        }
    }
    catch {
        Write-Output "  ERROR fetching $($feed.name): $($_.Exception.Message)"
    }
}

if (-not $hasNewBharti) {
    Write-Output "`nNo new bharti found. Adding Yojna post for Maharashtra..."
    $yojnaTopics = @(
        @{ title = "मुख्यमंत्री माझी शाळा सुंदर शाळा 2026"; desc = "महाराष्ट्र शासनाची मुख्यमंत्री माझी शाळा सुंदर शाळा योजना 2026 — शाळांचा विकास, पायाभूत सुविधा सुधारणा आणि डिजिटल क्रांतीसाठी विशेष अनुदान. सर्व जिल्हा परिषद शाळांसाठी लागू."; apply = "https://education.maharashtra.gov.in" },
        @{ title = "प्रधानमंत्री आवास योजना 2026 — महाराष्ट्र"; desc = "PMAY ग्रामीण व शहरी दोन्ही घटकांतर्गत गरिबांसाठी घर बांधणी सबसिडी. EWS, LIG, MIG श्रेणीसाठी कर्ज व सबसिडीचा लाभ. महाराष्ट्रातील सर्व पात्र नागरिक अर्ज करू शकतात."; apply = "https://pmaymis.gov.in" },
        @{ title = "आयुष्मान भारत महाराष्ट्र 2026 — ₹5 लाख आरोग्य विमा"; desc = "आयुष्मान भारत प्रधानमंत्री जन आरोग्य योजनेंतर्गत प्रत्येक कुटुंबाला वार्षिक ₹5 लाखांचा आरोग्य विमा. महाराष्ट्रातील SEBC, EWS श्रेणीतील पात्र नागरिक लाभ घेऊ शकतात."; apply = "https://pmjay.gov.in" },
        @{ title = "श्रमिक महामंडल योजना महाराष्ट्र 2026"; desc = "महाराष्ट्र श्रमिक महामंडल योजनेंतर्गत बिगार कामगार, दैनंदिन वेतन श्रमिक यांना शैक्षणिक मदत, वैद्यकीय सुविधा आणि गृहनिर्माण अनुदान. ऑनलाइन अर्ज सुविधा उपलब्ध."; apply = "https://mahakamgar.maharashtra.gov.in" }
    )

    $randomYojna = $yojnaTopics | Get-Random
    $yId = Make-Id $randomYojna.title
    $ySlug = Make-Slug $randomYojna.title "yojna"
    $yNormTitle = Normalize-Title $randomYojna.title

    if ($yId -notin $existingIds -and $yNormTitle -notin $existingTitlesNorm) {
        $yKeywords = Generate-Keywords $randomYojna.title "yojna"
        $ySections = Expand-Content $randomYojna.title $randomYojna.desc "yojna" $randomYojna.apply

        $yojnaPost = @{
            id = $yId
            title = $randomYojna.title
            category = "yojna"
            slug = $ySlug
            badge = "new"
            date = (Get-Date).ToString("yyyy-MM-dd")
            updated = (Get-Date).ToString("yyyy-MM-dd")
            shortDesc = $randomYojna.desc
            keywords = $yKeywords
            applyLink = $randomYojna.apply
            pdfGenerated = $false
            ogImage = "/og-images/$yId.svg"
            wordCount = 0
            socialPosted = @{ whatsapp = $false; instagram = $false; youtube = $false }
            sourceUrl = $randomYojna.apply
            sourceName = "MaharashtraYojna"
            importantLinks = @(
                @{ title = "अर्ज करा / अधिक माहिती"; url = $randomYojna.apply; label = "अर्ज करा" }
            )
            sections = $ySections
        }

        $json.posts += [PSCustomObject]$yojnaPost
        $newCount++
        Write-Output "  YOJNA: $($randomYojna.title)"
    }
}

if ($newCount -gt 0) {
    $json | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $dataPath -Encoding UTF8
    Write-Output "`nAdded $newCount new posts to posts.json"
}
else {
    Write-Output "`nNo new posts found"
}
