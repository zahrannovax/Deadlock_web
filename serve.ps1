$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:8150/")
$listener.Start()
$root = $PSScriptRoot
Write-Host "Serving $root on http://localhost:8150/"
while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response
    $path = $request.Url.LocalPath
    if ($path -eq "/") { $path = "/index.html" }
    $filePath = Join-Path $root ($path.TrimStart("/"))
    if (Test-Path $filePath -PathType Leaf) {
        $ext = [System.IO.Path]::GetExtension($filePath)
        $contentType = switch ($ext) {
            ".html" { "text/html" }
            ".css" { "text/css" }
            ".js" { "application/javascript" }
            ".jpg" { "image/jpeg" }
            ".png" { "image/png" }
            ".webp" { "image/webp" }
            ".svg" { "image/svg+xml" }
            ".mp4" { "video/mp4" }
            ".xml" { "application/xml" }
            ".txt" { "text/plain" }
            default { "application/octet-stream" }
        }
        $response.Headers.Add("Cache-Control", "no-store")
        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        $response.ContentType = $contentType
        $response.ContentLength64 = $bytes.Length
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $response.StatusCode = 404
    }
    $response.OutputStream.Close()
}
