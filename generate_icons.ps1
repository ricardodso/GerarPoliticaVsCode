# generate_icons.ps1
# Gera os icones PNG da extensao (16, 48, 128) usando System.Drawing.
Add-Type -AssemblyName System.Drawing

$base = Join-Path $PSScriptRoot 'icons'
if (-not (Test-Path $base)) { New-Item -ItemType Directory -Path $base | Out-Null }

$sizes = @(16, 48, 128)

foreach ($s in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($s, $s)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    # Fundo degrade azul
    $rect = New-Object System.Drawing.Rectangle(0, 0, $s, $s)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect,
        [System.Drawing.Color]::FromArgb(37, 78, 202),
        [System.Drawing.Color]::FromArgb(66, 133, 244),
        45
    )
    $g.FillRectangle($brush, $rect)

    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White)
    $pen.Width = [Math]::Max(1, [int]([double]$s / 16.0))
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

    $x = [int]([double]$s * 0.22)
    $lineW = [int]([double]$s * 0.56)

    # Colchetes { } - desenhados como "chaves" simples
    $b = [int]([double]$s * 0.30)   # x dos colchetes
    $t1 = [int]([double]$s * 0.20)
    $t2 = [int]([double]$s * 0.34)
    $t3 = [int]([double]$s * 0.50)
    $t4 = [int]([double]$s * 0.64)
    $t5 = [int]([double]$s * 0.78)

    # { esquerdo: usa pontos para simular
    $g.DrawLine($pen, $b, $t1, $b, $t1 + [int]([double]$s*0.02))
    $g.DrawLine($pen, $b, $t2, $b, $t3)
    $g.DrawLine($pen, $b, $t4, $b, $t5)

    # } direito
    $r = [int]([double]$s * 0.70)
    $g.DrawLine($pen, $r, $t1, $r, $t1 + [int]([double]$s*0.02))
    $g.DrawLine($pen, $r, $t2, $r, $t3)
    $g.DrawLine($pen, $r, $t4, $r, $t5)

    # Linhas JSON (internas)
    $g.DrawLine($pen, $x, $t2, $x + $lineW, $t2)
    $g.DrawLine($pen, $x, $t3, $x + $lineW - [int]([double]$s*0.08), $t3)
    $g.DrawLine($pen, $x, $t4, $x + $lineW, $t4)

    $path = Join-Path $base "icon$($s).png"
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)

    Write-Output "Gerado: $path ($((Get-Item $path).Length) bytes)"

    $g.Dispose()
    $bmp.Dispose()
    $pen.Dispose()
    $brush.Dispose()
}

Write-Output "Concluido!"