# Kit for Cukiernia Sowa

Example cards for a first conversation with Cukiernia Sowa (about 175 cafés in Poland).
They already run a paper stamp card for ice cream ("Lodowy Fanklub": 10 stickers, 1 scoop free),
so the simple example turns that card into a phone card; the 80th-anniversary one is a coffee card (8 stamps, a free coffee).

| File | What it is |
|---|---|
| `card-sowa-simple-iphone.png` / `-android.png` | Simple: their owl in the middle, brown dots as stamps |
| `card-sowa-80-iphone.png` / `-android.png` | For the 80th anniversary: a coffee card with their feather texture, the "80" logo, the owl as the stamp |
| `example-cards-overview.png` | Both designs, plus the two Orsonero designs, on one page |
| `../brochure-sowa-pl.pdf` | The Polish brochure with their name |
| `prezentacja-sowa.pdf` | 12-slide Polish deck for a chain conversation: the two cards, the till, notifications, the Results panel with locations, paper costs, GDPR, a pilot in 3 to 5 shops (source `sales/sowa.html`) |
| `../korzysci-dla-wlasciciela-pl.pdf` | 3 A4 pages for any café owner: benefits, paper card costs, what the panel shows (source `sales/korzysci.html`) |

`art/` holds their logo (`sowa-80-logo.svg`, `sowa-owl-*.png`), used only for this proposal.
Rebuild the images: `node print/make-example-cards.js` (designs in `print/example-cards.html`); the PDFs: `node print/make-pdfs.js`.
The panel pictures in `sales/img/` are screenshots of the demo dashboard (`app/dashboard.html?demo&card=sowa&lang=pl`).
