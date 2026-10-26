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

## Email: first contact, asking for a meeting (Polish)

Attach: `prezentacja-sowa.pdf`, `card-sowa-simple-iphone.png`, `card-sowa-80-iphone.png`,
`../brochure-sowa-pl.pdf`, `../korzysci-dla-wlasciciela-pl.pdf`. Open the card link on your phone before sending.

**Do:** bok@cukierniasowa.pl (customer service; it is the address in the Lodowy Fanklub rules). Not iod@, which is only for data protection.

**Temat:** Lodowy Fanklub w telefonie: propozycja dla Cukierni Sowa

> Dzień dobry,
>
> uprzejmie proszę o przekazanie tej wiadomości do działu marketingu.
>
> nazywam się Bartosz Witkowski i prowadzę Witkowski Design. Stworzyłem Timbro: karty lojalnościowe, które klienci trzymają w telefonie, w Apple Wallet lub Google Wallet, bez instalowania żadnej aplikacji.
>
> Przygotowałem propozycję specjalnie dla Cukierni Sowa. Lodowy Fanklub (10 naklejek, gałka lodów gratis) świetnie działa na papierze. W telefonie klient go nie zgubi, karta sama przypomni mu o Sowie, a Państwo zobaczą, kto wraca i do którego lokalu.
>
> W załącznikach przesyłam:
> - prezentację dla Cukierni Sowa: obsługa przy kasie, powiadomienia, panel z wynikami każdego lokalu, koszty papierowej karty w 175 lokalach, RODO i pilotaż,
> - dwa projekty karty: Lodowy Fanklub w telefonie oraz kartę kawową na 80-lecie (8 pieczątek, kawa gratis),
> - broszurę Timbro i krótkie zestawienie korzyści dla właściciela lokalu.
>
> Kartę jubileuszową można zobaczyć na żywo i dodać do Apple Wallet: https://timbro.witkowskidesign.com/app/card.html?card=sowa
>
> Proponuję zacząć od pilotażu w 3 do 5 lokalach, żeby sprawdzić kartę w praktyce, zanim zdecydują Państwo o całej sieci.
>
> Bardzo chciałbym się spotkać i pokazać wszystko na żywo, razem z nabijaniem pieczątki telefonem przy kasie. Wystarczy około 30 minut. Chętnie przyjadę do Bydgoszczy, mogę też połączyć się online, w dogodnym dla Państwa terminie. Czy znajdzie się chwila w najbliższych tygodniach?
>
> Z poważaniem
> Bartosz Witkowski
> Witkowski Design
> +48 530 340 988 (także WhatsApp)
> bartek.archi56@gmail.com
> timbro.witkowskidesign.com
