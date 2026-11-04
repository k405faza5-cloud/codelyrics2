$ports = @(8080, 8081, 8082, 3000, 5000, 5500)
$folder = $PSScriptRoot
$listener = $null
$activePrefix = $null

foreach ($p in $ports) {
    try {
        $candidatePrefix = "http://localhost:$p/"
        $testListener = New-Object System.Net.HttpListener
        $testListener.Prefixes.Add($candidatePrefix)
        $testListener.Start()
        $listener = $testListener
        $activePrefix = $candidatePrefix
        break
    } catch {
        # Try next port
    }
}

if ($null -eq $listener) {
    Write-Host "Tidak dapat memulai server lokal di port manapun. Membuka index.html..." -ForegroundColor Yellow
    Start-Process (Join-Path $folder "index.html")
    exit
}

Write-Host "==========================================================" -ForegroundColor Green
Write-Host " CodeLyrics Studio Server Berjalan di: $activePrefix" -ForegroundColor Cyan
Write-Host " [Fitur Auto Rekam Tab Aktif 100% di Browser]" -ForegroundColor Green
Write-Host " Tekan Ctrl+C untuk menutup server" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Green

Start-Process $activePrefix

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $localPath = $request.Url.LocalPath.TrimStart('/')
        if ([string]::IsNullOrEmpty($localPath)) {
            $localPath = "index.html"
        }
        $filePath = Join-Path $folder $localPath

        if (Test-Path $filePath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            
            switch ($ext) {
                ".html" { $response.ContentType = "text/html; charset=utf-8" }
                ".css"  { $response.ContentType = "text/css; charset=utf-8" }
                ".js"   { $response.ContentType = "application/javascript; charset=utf-8" }
                ".webm" { $response.ContentType = "video/webm" }
                ".mp3"  { $response.ContentType = "audio/mpeg" }
                ".mp4"  { $response.ContentType = "video/mp4" }
                ".json" { $response.ContentType = "application/json; charset=utf-8" }
                ".jpeg" { $response.ContentType = "image/jpeg" }
                ".jpg"  { $response.ContentType = "image/jpeg" }
                ".png"  { $response.ContentType = "image/png" }
                ".svg"  { $response.ContentType = "image/svg+xml" }
                ".woff2"{ $response.ContentType = "font/woff2" }
                ".woff" { $response.ContentType = "font/woff" }
                default { $response.ContentType = "application/octet-stream" }
            }

            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
        }
        $response.Close()
    } catch {
        # continue loop
    }
}
