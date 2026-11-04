$folder = $PSScriptRoot

# Cari daftar IP Address Wi-Fi / LAN aktif
$ips = @(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback' -and $_.IPAddress -notmatch '^169\.' } | Select-Object -ExpandProperty IPAddress)
$wifiIP = $ips | Where-Object { $_ -match '^192\.168\.' } | Select-Object -First 1
if (-not $wifiIP) { $wifiIP = $ips | Select-Object -First 1 }
if (-not $wifiIP) { $wifiIP = "127.0.0.1" }

$tcpListener = $null
$ports = @(8080, 8081, 8082, 3000, 5000, 5500)

foreach ($p in $ports) {
    try {
        $temp = New-Object System.Net.Sockets.TcpListener ([System.Net.IPAddress]::Any, $p)
        $temp.Start()
        $tcpListener = $temp
        $port = $p
        break
    } catch {
        # port busy, try next
    }
}

if ($null -eq $tcpListener) {
    Write-Host "Tidak dapat membuka port jaringan." -ForegroundColor Red
    pause
    exit
}

$pcUrl = "http://localhost:$port/"
$phoneUrls = @($ips | ForEach-Object { "http://$($_):$port/" })

Clear-Host
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "      CodeLyrics Studio - Mode Siap Pakai di HP          " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Green
Write-Host ""
Write-Host " [?] CARA BUKA DI HP ANDA (Android / iPhone):" -ForegroundColor Yellow
Write-Host "  1. Pastikan HP dan Laptop terhubung ke Wi-Fi / Hotspot yang SAMA" -ForegroundColor Gray
Write-Host "  2. Buka Google Chrome atau Safari di HP Anda" -ForegroundColor Gray
Write-Host "  3. Ketik salah satu alamat ini di browser HP:" -ForegroundColor Gray
Write-Host ""
foreach ($u in $phoneUrls) {
    Write-Host "     $u     " -ForegroundColor Black -BackgroundColor Green
}
Write-Host ""
Write-Host " --------------------------------------------------------" -ForegroundColor DarkGray
Write-Host " [v] Buka di Laptop: $pcUrl" -ForegroundColor Cyan
Write-Host " [x] Jangan tutup jendela ini selama web dibuka di HP" -ForegroundColor DarkYellow
Write-Host "==========================================================" -ForegroundColor Green

Start-Process $pcUrl

while ($true) {
    try {
        $client = $tcpListener.AcceptTcpClient()
        [System.Threading.Tasks.Task]::Run({
            param($c, $dir)
            try {
                $stream = $c.GetStream()
                $reader = New-Object System.IO.StreamReader($stream)
                $reqLine = $reader.ReadLine()
                if (-not $reqLine) { $c.Close(); return }

                $parts = $reqLine.Split(' ')
                if ($parts.Length -lt 2) { $c.Close(); return }

                $path = $parts[1].TrimStart('/')
                if ([string]::IsNullOrEmpty($path)) { $path = "index.html" }
                $cleanPath = $path.Split('?')[0]
                $fullPath = Join-Path $dir $cleanPath

                if (Test-Path $fullPath -PathType Leaf) {
                    $ext = [System.IO.Path]::GetExtension($fullPath).ToLower()
                    $mime = switch ($ext) {
                        ".html" { "text/html; charset=utf-8" }
                        ".css"  { "text/css; charset=utf-8" }
                        ".js"   { "application/javascript; charset=utf-8" }
                        ".webm" { "video/webm" }
                        ".mp3"  { "audio/mpeg" }
                        ".mp4"  { "video/mp4" }
                        ".json" { "application/json; charset=utf-8" }
                        ".png"  { "image/png" }
                        ".jpg"  { "image/jpeg" }
                        ".jpeg" { "image/jpeg" }
                        ".svg"  { "image/svg+xml" }
                        ".woff2"{ "font/woff2" }
                        default { "application/octet-stream" }
                    }
                    $bytes = [System.IO.File]::ReadAllBytes($fullPath)
                    $header = "HTTP/1.1 200 OK`r`nContent-Type: $mime`r`nContent-Length: $($bytes.Length)`r`nAccess-Control-Allow-Origin: *`r`nConnection: close`r`n`r`n"
                    $hBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
                    $stream.Write($hBytes, 0, $hBytes.Length)
                    $stream.Write($bytes, 0, $bytes.Length)
                } else {
                    $err = "HTTP/1.1 404 Not Found`r`nContent-Length: 0`r`nConnection: close`r`n`r`n"
                    $eBytes = [System.Text.Encoding]::ASCII.GetBytes($err)
                    $stream.Write($eBytes, 0, $eBytes.Length)
                }
                $c.Close()
            } catch {
                try { $c.Close() } catch {}
            }
        }.GetNewClosure(), @($client, $folder)) | Out-Null
    } catch {
        Start-Sleep -Milliseconds 150
    }
}
