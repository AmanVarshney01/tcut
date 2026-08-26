## !!steps Change the theme

607 themes, Ghostty's collection. Same recording, new colours.

```sh ! render
# !mark
tcut render demo.cast --theme "Gruvbox Dark" -o demo.svg -o demo.html
tcut render demo.cast --width 1280 --height 720 --speed 1.5 -o demo.mp4
tcut render demo.cast --from 2s --to 10s --shadow --watermark "@you" -o clip.gif
tcut render demo.cast --split-chapters --margin-fill transparent -o demo.webm
tcut concat intro.cast demo.cast --gap 500ms -o launch.mp4
tcut publish demo.gif
```

## !!steps Size and speed

Pixel dimensions for the platform; playback speed on the render clock.

```sh ! render
tcut render demo.cast --theme "Gruvbox Dark" -o demo.svg -o demo.html
# !mark
tcut render demo.cast --width 1280 --height 720 --speed 1.5 -o demo.mp4
tcut render demo.cast --from 2s --to 10s --shadow --watermark "@you" -o clip.gif
tcut render demo.cast --split-chapters --margin-fill transparent -o demo.webm
tcut concat intro.cast demo.cast --gap 500ms -o launch.mp4
tcut publish demo.gif
```

## !!steps Cut, shadow, watermark

A window of the recording, polished. Cuts happen on the cast, so this works for SVG as well as GIF.

```sh ! render
tcut render demo.cast --theme "Gruvbox Dark" -o demo.svg -o demo.html
tcut render demo.cast --width 1280 --height 720 --speed 1.5 -o demo.mp4
# !mark
tcut render demo.cast --from 2s --to 10s --shadow --watermark "@you" -o clip.gif
tcut render demo.cast --split-chapters --margin-fill transparent -o demo.webm
tcut concat intro.cast demo.cast --gap 500ms -o launch.mp4
tcut publish demo.gif
```

## !!steps Split by chapter, transparent

One file per `t.chapter()`, with a real alpha channel.

```sh ! render
tcut render demo.cast --theme "Gruvbox Dark" -o demo.svg -o demo.html
tcut render demo.cast --width 1280 --height 720 --speed 1.5 -o demo.mp4
tcut render demo.cast --from 2s --to 10s --shadow --watermark "@you" -o clip.gif
# !mark
tcut render demo.cast --split-chapters --margin-fill transparent -o demo.webm
tcut concat intro.cast demo.cast --gap 500ms -o launch.mp4
tcut publish demo.gif
```

## !!steps Join recordings

Same-size casts, a pause between them, one video.

```sh ! render
tcut render demo.cast --theme "Gruvbox Dark" -o demo.svg -o demo.html
tcut render demo.cast --width 1280 --height 720 --speed 1.5 -o demo.mp4
tcut render demo.cast --from 2s --to 10s --shadow --watermark "@you" -o clip.gif
tcut render demo.cast --split-chapters --margin-fill transparent -o demo.webm
# !mark
tcut concat intro.cast demo.cast --gap 500ms -o launch.mp4
tcut publish demo.gif
```

## !!steps Publish

To your own S3-compatible bucket. There is no hosted service.

```sh ! render
tcut render demo.cast --theme "Gruvbox Dark" -o demo.svg -o demo.html
tcut render demo.cast --width 1280 --height 720 --speed 1.5 -o demo.mp4
tcut render demo.cast --from 2s --to 10s --shadow --watermark "@you" -o clip.gif
tcut render demo.cast --split-chapters --margin-fill transparent -o demo.webm
tcut concat intro.cast demo.cast --gap 500ms -o launch.mp4
# !mark
tcut publish demo.gif
```
