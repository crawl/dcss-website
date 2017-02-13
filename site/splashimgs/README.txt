When adding images to this directory, also update the available_images hash in the addImageUrls function in dcss.js with the new number of branch images.

To optimise images in this directory, compress them as follows:
    pngquant --speed 1 --nofs --strip --verbose 128 $file (creates $file-or8.png)
    advpng -z -4 *.png

The pngquant command reduces PNGs to 128 colours, which is generally more than enough for Crawl (typically 64 is fine) and reduces the filesize to ~25% of original.
Advpng is simply lossless recompression.
