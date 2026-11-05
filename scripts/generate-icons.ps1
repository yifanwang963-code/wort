# Export the existing Georgia italic w. mark and its original colors as PNG icons.
Add-Type -AssemblyName System.Drawing
$iconDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../public/icons'))
$family = [Drawing.FontFamily]::new('Georgia')
$format = [Drawing.StringFormat]::GenericTypographic
$font = [Drawing.Font]::new($family, 370, [Drawing.FontStyle]::Italic, [Drawing.GraphicsUnit]::Pixel)
$measureBitmap = [Drawing.Bitmap]::new(512,512)
$measureGraphics = [Drawing.Graphics]::FromImage($measureBitmap)
$advance = $measureGraphics.MeasureString('w',$font,1000,$format).Width
$whitePath = [Drawing.Drawing2D.GraphicsPath]::new()
$dotPath = [Drawing.Drawing2D.GraphicsPath]::new()
$whitePath.AddString('w',$family,2,370,[Drawing.PointF]::new(0,0),$format)
$dotPath.AddString('.',$family,2,370,[Drawing.PointF]::new($advance,0),$format)
$bounds = [Drawing.RectangleF]::Union($whitePath.GetBounds(),$dotPath.GetBounds())
$transform = [Drawing.Drawing2D.Matrix]::new()
$transform.Translate((512-$bounds.Width)/2-$bounds.X,(512-$bounds.Height)/2-$bounds.Y-10)
$whitePath.Transform($transform)
$dotPath.Transform($transform)
$background = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#7866a8'))
$dotBrush = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#d9d3b8'))
$rounded = [Drawing.Drawing2D.GraphicsPath]::new()
$rounded.AddArc(0,0,306,306,180,90)
$rounded.AddArc(206,0,306,306,270,90)
$rounded.AddArc(206,206,306,306,0,90)
$rounded.AddArc(0,206,306,306,90,90)
$rounded.CloseFigure()
foreach ($size in @(192,512)) {
  $bitmap = [Drawing.Bitmap]::new($size,$size)
  $graphics = [Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.ScaleTransform($size/512.0,$size/512.0)
  $graphics.FillPath($background,$rounded)
  $graphics.FillPath([Drawing.Brushes]::White,$whitePath)
  $graphics.FillPath($dotBrush,$dotPath)
  $bitmap.Save((Join-Path $iconDirectory "wort-$size.png"),[Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}
foreach ($resource in @($measureGraphics,$measureBitmap,$whitePath,$dotPath,$rounded,$transform,$background,$dotBrush,$font,$family)) { $resource.Dispose() }
