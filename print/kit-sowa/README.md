# Kit for Cukiernia Sowa

Example cards for a first conversation with Cukiernia Sowa (about 175 cafés in Poland).
They already run a paper stamp card for ice cream ("Lodowy Fanklub": 10 stickers, 1 scoop free),
so both examples turn that card into a phone card.

| File | What it is |
|---|---|
| `card-sowa-simple-iphone.png` / `-android.png` | Simple: their owl in the middle, brown dots as stamps |
| `card-sowa-80-iphone.png` / `-android.png` | For the 80th anniversary: their fish-scale texture, the "80" logo, the owl as the stamp |
| `example-cards-overview.png` | Both designs, plus the two Orsonero designs, on one page |
| `../brochure-sowa-pl.pdf` | The Polish brochure with their name |

`art/` holds their logo (`sowa-80-logo.svg`, `sowa-owl-*.png`), used only for this proposal.
Rebuild the images: `node print/make-example-cards.js` (designs in `print/example-cards.html`).
