/**
 * CENTRALE CONFIGURATIE VOOR HET SPEL
 * -----------------------------------
 * Pas hier eenvoudig per speler de pincode of het wachtwoord aan.
 * Hoofdletters maken niet uit bij het invoeren (bv. "1042" of "geheim").
 *
 * Elke speler heeft een eigen pagina in het mapje: spelers/<id>.html
 */

const SPEL_CONFIG = {
  // Mastercode waarmee de leiding elk dossier én het Leiding Paneel kan openen:
  masterCode: "leiding2026",

  // LIVE DATABASE INSTELLINGEN:
  // 1) Standaard werkt het live scorebord direct via een beveiligd realtime kanaal (cloudChannel).
  //    Kies hier een unieke naam voor jullie spel zodat niemand anders op hetzelfde kanaal zit:
  cloudChannel: "jb_operatie_dossier_2026_x9k2m",

  // 2) Optioneel: Heb je een eigen gratis Firebase Realtime Database aangemaakt?
  //    Plak dan hier de URL (bv. "https://jouw-project-default-rtdb.europe-west1.firebasedatabase.app")
  //    Als dit leeg ("") is, gebruikt de site automatisch de directe cloudChannel hierboven!
  firebaseDatabaseUrl: "",

  // PUNTENTELLING INSTELLINGEN (Aflopend per plek):
  // 1e plek krijgt 100 pt, 2e plek 95 pt, 3e plek 90 pt ... minimum 10 pt
  scoreInstellingen: {
    eerstePlekPunten: 100,
    stapPerPlek: 5,
    minimumPunten: 10
  },

  // STANDAARD GROEPEN & KLEUREN (EXACT 6 GROEPEN: ELK TEAM START OP EEN UNIEKE LOCATIE):
  // Groep 1 (Blauw) -> Zandpoort
  // Groep 2 (Rood)  -> Begijnhof
  // Groep 3 (Geel)  -> Bovenpoort
  // Groep 4 (Groen) -> Stadspark
  // Groep 5 (Paars) -> Kerkplein
  // Groep 6 (Oranje)-> Nieuw Lokaal
  standaardGroepen: [
    { id: "Groep Blauw",  naam: "Groep Blauw",  kleur: "#3b82f6" }, // Start: Zandpoort
    { id: "Groep Rood",   naam: "Groep Rood",   kleur: "#ef4444" }, // Start: Begijnhof
    { id: "Groep Geel",   naam: "Groep Geel",   kleur: "#eab308" }, // Start: Bovenpoort
    { id: "Groep Groen",  naam: "Groep Groen",  kleur: "#10b981" }, // Start: Stadspark
    { id: "Groep Paars",  naam: "Groep Paars",  kleur: "#a855f7" }, // Start: Kerkplein
    { id: "Groep Oranje", naam: "Groep Oranje", kleur: "#f97316" }  // Start: Nieuw Lokaal
  ],

  // HEADQUARTERS (Centrale commandopost op de radar-kaart met rood HQ-icoon):
  headquarters: {
    id: "headquarters",
    naam: "HEADQUARTERS",
    adres: "Kapucijnenstraat 7, 2200 Herentals",
    beschrijving: "Centrale commandopost & uitvalsbasis van de spelleiding (Gamemaster HQ)",
    lat: 51.17994,
    lng: 4.82938
  },

  // BONUSOPDRACHTEN & INTERCEPTIES (Verschijnen in elk spelersmapje):
  bonusRiddles: [
    {
      id: "burner_sms",
      type: "riddle",
      titel: "ONDERSCHEPTE SMS BURNER-PHONE",
      subtitel: "SIGINT INTERCEPTIE // STADSARCHIEF HERENTALS",
      punten: 40,
      codewoord: "hangjongeren",
      toetsaanslagen: "44 - 2 - 66 - 4 - 5 - 666 - 66 - 4 - 33 - 777 - 33 - 66",
      verhaal: "Onze SIGINT-afluisterdienst heeft ontdekt dat het stadsbestuur voor gevoelige communicatie géén traceerbare smartphones gebruikt, maar een oude, ongeregistreerde burner-phone (een retro Nokia met numerieke fysieke druktoetsen). Onze antenne heeft zojuist een uitgaande SMS-toetsenreeks van dit toestel kunnen onderscheppen.",
      instructie: "Ontcijfer het onderschepte woord en voer het hieronder in om het direct naar Gamemaster HQ te sturen voor bonuspunten!"
    },
    {
      id: "tap_therese",
      type: "riddle",
      titel: "GELEKT AUDIO-TRANSCRIPT // TAP GESPREK THÉRÈSE",
      subtitel: "SIGINT TAP #4208 // KABINET STAD HERENTALS",
      punten: 60,
      codewoord: "smssosnaarvicce",
      oplossingWeergave: "SMS SOS naar Vicce",
      verhaal: "Onze inlichtingendienst heeft een afgeluisterd telefoongesprek onderschept tussen Thérèse van de stad Herentals en de geheime koper over de illegale verkoop van ons KSA-lokaal. Het transcript is zwaar gecensureerd met zwarte balken, maar onze cryptograaf ontdekte een verborgen patroon in de typemachine-letters...",
      instructie: "Bestudeer het transcript van het telefoongesprek. De verdachte, vetgedrukte letters vormen in chronologische leesvolgorde een geheime boodschap. Ontcijfer de code en voer de geheime actie uit!"
    },
    {
      id: "carte_blanche",
      type: "creative_challenge",
      titel: "OPERATIE CARTE BLANCHE // HET VRIJE SPEL",
      subtitel: "VRIJE CREATIEVE STUNT // VERRAS HQ",
      punten: 0, // Vrij in te stellen door Gamemaster HQ
      verhaal: "In tijden van acute crisis zijn de beste geheimagenten niet diegenen die star de protocollen volgen, maar diegenen die out-of-the-box denken en het onmogelijke waarmaken. Gamemaster HQ geeft jullie team totale 'Carte Blanche'!",
      instructie: "Doe iets buitengewoons, hilarisch, creatiefs of grensverleggends. Het kan letterlijk VANALLES zijn: een absurde sketch of stunt op video, een epische spionagefoto, een zelfgeschreven ode of gedicht, een geniaal fysiek voorwerp (of een markant persoon/voorbijganger!) meebrengen naar het Hoofdkwartier, een nep-aanwijzing planten... Geen limiet op de verbeelding. Hoe origineler en spectaculairder de inzending, hoe meer bonuspunten Victor jullie toekent bij de eindjurering!",
      uploadHint: "Upload hier jullie video, foto of beschrijving van jullie vrije stunt naar Gamemaster HQ (of kondig jullie fysieke verrassing voor HQ aan!)."
    },
    {
      id: "ad_fundum",
      type: "video_challenge",
      titel: "OPERATIE AD FUNDUM // CAFÉ INFILTRATIE",
      subtitel: "HUMINT VELDTEST // SNELSTE 'AT' WINT",
      punten: 140,
      verhaal: "Een echte veldagent moet te allen tijde alert en paraat zijn, maar moet ook bliksemsnel zijn glas kunnen leegdrinken wanneer de plicht roept en HQ plots het evacuatie-signaal geeft!",
      instructie: "Infiltreer undercover een café in Herentals en bestel aan de toog een pint (of een frisdrank voor wie geen alcohol drinkt). Trek een adje ('at')! Film het adje van start tot finish op video met een lopende stopwatch (bv. op een tweede gsm) duidelijk zichtbaar in beeld. De snelste tijd pakt de maximale bonus!",
      uploadHint: "Film het adje met stopwatch en upload de video hier direct naar Gamemaster HQ."
    },
    {
      id: "snack_vicce",
      type: "physical_delivery",
      titel: "OPERATIE SNACK ATTACK // RED GAMEMASTER VICCE",
      subtitel: "LOGISTIEKE NOODMISSIE // PROVIAND VOOR HQ",
      punten: 0, // Vrij in te stellen door Gamemaster HQ
      verhaal: "Gamemaster Vicce is al dagen- en nachtenlang onafgebroken bezig met het uitpluizen van deze duistere samenzwering, het bouwen van het commandoportaal en het bewaken van de satellietverbindingen. Zijn energiepeil staat op 1% en zijn maag knort luid over de frequenties. Hij heeft acute honger!",
      instructie: "Zorg dat Gamemaster Vicce niet bezwijkt: breng hem op het einde van de tocht een snack mee terug naar het Hoofdkwartier (Kapucijnenstraat 7) die hij écht lust (bv. frituur, bakkerij, nachtwinkel of café). De beste snack levert koninklijke bonuspunten op!",
      uploadHint: "Optioneel: maak alvast een teaser-foto van de snack bij aankoop en upload die hieronder."
    },
    {
      id: "derde_partij_koor",
      type: "video_challenge",
      titel: "OPERATIE VOLKSSTEM // OVERTUIG DE DERDE PARTIJ",
      subtitel: "PSY-OPS STRATEGIE // MINIMAAL 6 VREEMDEN TEGELIJK",
      punten: 160,
      verhaal: "Om de louche derde partij definitief af te schrikken en te bewijzen dat heel Herentals achter de KSA staat, hebben we een overweldigende, massale volksgetuigenis nodig. Eén getuige is niet genoeg; we moeten tonen dat de straat achter ons staat!",
      instructie: "Krijg minstens 6 volslagen vreemden (voorbijgangers in Herentals) tegelijkertijd voor jullie camera en laat ze in koor, luid en overtuigend roepen: 'Redt de KSA, de ware eigenaars van de erfpacht!'.",
      uploadHint: "Film de 6 vreemden die de leuze in koor roepen en upload de video hier direct voor HQ."
    },
    {
      id: "speurhond_k9",
      type: "photo_challenge",
      titel: "OPERATIE SPEURHOND // K9 REKRUTERINGSBUREAU",
      subtitel: "K9 TACTICAL SQUAD // VIERVOETIGE INLICHTINGENDIENST",
      punten: 50,
      verhaal: "De inlichtingendienst van HQ kampt met een acuut capaciteitstekort in de K9-afdeling. We zoeken dringend een talentvolle speurhond in Herentals om sporen van het stadsbestuur te volgen en de kluis te bewaken.",
      instructie: "HQ zoekt nog een speurhond. Vind een geschikte kandidaat, neem een foto met de hond en upload hem als officieel sollicitatiedossier voor Gamemaster HQ!",
      uploadHint: "Upload hier de foto met de kandidaat-speurhond."
    },
    {
      id: "flyer_bierfeesten",
      type: "photo_challenge",
      titel: "OPERATIE BIERFEESTEN // CAFÉ INFILTRATIE & PROPAGANDA",
      subtitel: "INFILTRATIE & PROMOTIE // +100 PT",
      punten: 100,
      verhaal: "Nu ons lokaal op het spel staat en de stad met erfpachtcontracten sjoemelt, mogen we absoluut geen enkel risico nemen met onze inkomsten. De Bierfeesten zijn onze levenslijn: dit evenement móét een gigantisch succes worden! We moeten zien dat dit evenement van ons zeker niet faalt nu ons lokaal op het spel staat.",
      instructie: "Infiltreer undercover een café in Herentals en flyer het hele café vol met flyers van de Bierfeesten (leg flyers op de toog, op alle tafels, aan het prikbord, etc.). Maak een duidelijke foto/video als onomstotelijk bewijs en upload het naar HQ!",
      uploadHint: "Upload hier de foto of video van het geflyerde café als bewijs voor HQ."
    }
  ],

  // LOCATIE-MAPJES (De 1e code per locatie geldt voor iedereen; elk groepje krijgt een andere volgorde!):
  // Pas hier eenvoudig de 'code', 'opdracht', 'bonusOpdracht', 'gelektDocument' en 'veldTool' per locatie aan!
  locaties: [
    {
      id: "zandpoort",
      naam: "Zandpoort",
      punten: 150,
      adres: "Zandstraat 41–43, 2200 Herentals",
      beschrijving: "De historische stadspoortdoorgang tussen de Zandstraat en de Nonnenstraat",
      lat: 51.17674,
      lng: 4.83328,
      code: "zand1",
      opdracht: "We hebben een mol in de jeugddienst van de stad zitten. Hij is op de hoogte, HQ heeft hem ingelicht. Bel hem op het nummer 0486 95 87 20, zeg het geheime codewoord, voer zijn opdracht uit en in ruil daarvoor zal hij in de volgende jeugdraad de stad aansprakelijk stellen, zodat we ze vanbinnenuit verantwoordelijk stellen en hun daden onthullen.",
      bonusOpdracht: "Bonusopdracht: Neem aan de Zandpoort een undercover spionagefoto waarop jullie groep onherkenbaar gecamoufleerd opgaat in het straatbeeld terwijl jullie bellen met de mol! (De groep met het beste materiaal, de snelste tijd én volbrachte bonusopdrachten wint!)",
      vereistBewijs: [
        "Telefonisch contact met de mol (0486 95 87 20) met het juiste codewoord",
        "Uitvoering van de geheime opdracht die de mol jullie aan de telefoon dicteert",
        "Upload hieronder jullie officiële tagmark-bewijsmateriaal voor Gamemaster HQ"
      ],
      uploadTitel: "📷 BEWIJSMATERIAAL // TAGMARK UPLOADZONE",
      uploadHint: "Upload hier het officiële tagmark-bewijs na telefonisch contact met de infiltrant.",
      uploadKnopTekst: "Upload Tagmark naar HQ",
      gelektDocument: {
        titel: "GELEKT DOSSIER #01/06 // INTERNE FICHE JEUGDDIENST",
        stempel: "BRON: HUMINT-MOL // JEUGDRAAD",
        inhoud: `
          <p><strong>BETREFT:</strong> Geheime spoedprocedure verkoop KSA-erfpacht (Markgravenstraat 77).</p>
          <p>Uit interne notulen van dienst <span class="doc-redacted">██████████</span> blijkt dat het schepencollege de jeugdraad volledig buitenspel heeft gezet. Gisteren om <strong>16u36</strong> gaf kabinet <span class="doc-redacted">███████</span> mondeling akkoord om het pand vanavond om <strong>22u00</strong> vrij van erfpacht over te dragen.</p>
          <p>Onze infiltrant binnen de stedelijke jeugddienst (codenaam <strong>"DE POORTWACHTER"</strong>) heeft de originele erfpacht-akte achtergehouden en wacht op jullie oproep om het stadsbestuur tijdens de eerstvolgende jeugdraad vanbinnenuit te ontmaskeren.</p>
        `
      },
      veldTool: {
        type: "mol_telefoon",
        telefoonWeergave: "0486 95 87 20",
        telefoonHref: "tel:0486958720",
        codewoord: "DE DAKPANNEN LIGGEN LOS",
        instructie: "Bel de mol via de knop hieronder. Zodra hij opneemt, zeg je EERST het exacte codewoord hieronder zodat hij weet dat jullie door HQ gestuurd zijn!"
      }
    },
    {
      id: "begijnhof",
      naam: "Begijnhof",
      punten: 70,
      adres: "Begijnhof 1–30, 2200 Herentals",
      beschrijving: "Toegangspoort via de Begijnenstraat / Nonnenstraat",
      lat: 51.18035,
      lng: 4.83666,
      code: "begijn2",
      opdracht: "De KSA is begonnen als een gelovige jeugdbeweging, en soms moeten we een ode brengen. Breng een zo creatief mogelijke versie van het avondlied. Hoewel HQ niet gelovig is, moeten we alle pistes bewandelen. Spreek de Heer aan in ons avondlied, upload de video hieronder en breng het mee als bewijsmateriaal naar HQ.",
      bonusOpdracht: "Bonusopdracht: Voer het avondlied meerstemmig of in processie uit op jullie knieën bij een poort/standbeeld in het Begijnhof, óf zing het in een totaal onverwacht muziekgenre (bv. rap, opera of gregoriaans koor)!",
      vereistBewijs: [
        "Video-opname van jullie creatiefste versie van het avondlied (waarin de Heer wordt aangesproken)",
        "Upload de video hieronder in het mapje Begijnhof",
        "Breng de video ook op jullie gsm mee terug als bewijsmateriaal naar HQ"
      ],
      uploadTitel: "🎬 UPLOADZONE BEGIJNHOF // VIDEO VAN HET AVONDLIED",
      uploadHint: "Kies of film jullie video van het avondlied en upload hem rechtstreeks in dit mapje.",
      gelektDocument: {
        titel: "GELEKT DOSSIER #02/06 // AUDIO-TRANSCRIPTIE TAP 16u36",
        stempel: "SIGINT-TAP #1636 // WOORDELIJK VERSLAG",
        inhoud: `
          <p><strong>[16:36:12] ONBEKENDE KOPER (<span class="doc-redacted">████████ NV</span>):</strong> "Als wij vanavond om 22u00 het bedrag van <span class="doc-redacted">€███.000</span> storten, willen we 100% garantie dat die jeugdbeweging tegen volgende maand uit het pand is, zodra het nieuwe dak erop ligt."</p>
          <p><strong>[16:36:29] STAD HERENTALS (<span class="doc-redacted">Dhr. ██████</span>):</strong> "Maak u geen zorgen. Die van de KSA zijn een oude parochie-beweging uit <span class="doc-redacted">19██</span>, die bidden nog eerder voor een mirakel dan dat ze ons juridisch kunnen tegenhouden."</p>
          <p><strong>NOOT VAN HQ:</strong> Ze onderschatten onze roots. Tijd om in het historische Begijnhof alle registers open te trekken.</p>
        `
      },
      veldTool: {
        type: "avondlied_tekst",
        titel: "📜 SPIEKBRIEFJE // ORIGINELE TEKST KSA-AVONDLIED",
        tekst: "O Heer, de avond is neergekomen,\nde zonne zonk, het duister klom.\nDe winden doorruisen de bomen,\nen verre sterren staan alom...\n\nWij knielen neer om u te zingen\nin 't slapend woud ons avondlied.\nWij danken u voor wat we ontvingen,\nen vragen, heer, verlaat ons niet!\n\nKnielen, knielen, knielen wij neder,\ndoor de stilte weerklinkt onze bee.\nLuist'rend fluist'ren kruinen mee\nen sterren staren teder.\nGeef ons Heer, zegen en rust en vree.",
        instructie: "Gebruik deze authentieke tekst als basis, spreek de Heer expliciet aan om ons lokaal te redden en maak er de meest creatieve uitvoering ooit van!"
      }
    },
    {
      id: "bovenpoort",
      naam: "Bovenpoort",
      punten: 130,
      adres: "Bovenrij 19–21, 2200 Herentals",
      beschrijving: "De overgebleven stadspoort aan het einde van de Bovenrij richting Molseweg",
      lat: 51.17408,
      lng: 4.83830,
      code: "boven3",
      opdracht: "Hier zoeken we een getuige die ons verhaal wil verdedigen. Neem een interview op met een voorbijganger, overtuig hen waarvoor de KSA staat en laat hen een getuigenis opnemen waarom het lokaal van ons moet zijn. Wees creatief: bij een overtuigende boodschap kunnen we deze misschien opsturen naar de onbekende 3e partij om hen te overtuigen om de verkoop toch niet te laten doorgaan en het stad te laten zitten met hun deal. Upload de video naar het HQ-portaal.",
      bonusOpdracht: "Bonusopdracht: Hoe meer zielen, hoe meer druk! Krijg minstens 2 verschillende voorbijgangers in jullie video zover om vurig 'HET LOKAAL BLIJFT VAN DE KSA!' in de camera te roepen.",
      vereistBewijs: [
        "Video-interview met een voorbijganger die getuigt waarom het lokaal van de KSA moet blijven",
        "Overtuigende boodschap gericht aan de onbekende 3e partij om van de aankoop af te zien",
        "Upload de video rechtstreeks naar het HQ-portaal in dit mapje"
      ],
      uploadTitel: "🎬 UPLOADZONE BOVENPOORT // GETUIGENIS-VIDEO VOOR 3e PARTIJ",
      uploadHint: "Upload hier het opgenomen video-interview met de voorbijganger(s) zodat HQ dit kan doorsturen naar de 3e partij.",
      gelektDocument: {
        titel: "GELEKT DOSSIER #03/06 // GEHEIME OVEREENKOMST 3e PARTIJ",
        stempel: "VERTROUWELIJK CONTRACT // ARTIKEL 14.2",
        inhoud: `
          <p><strong>GELEKTE KOOPOVEREENKOMST TUSSEN STAD HERENTALS &amp; <span class="doc-redacted">IMMO-GROEP ███████ NV</span>:</strong></p>
          <p style="background: rgba(0,0,0,0.28); padding: 0.55rem; border-left: 3px solid #f59e0b; font-family: var(--font-mono); font-size: 0.78rem;">
            "ARTIKEL 14.2 (ONTBINDENDE CLAUSULE): De Koper (<span class="doc-redacted">Dhr. ████████</span>) behoudt zich het recht voor om vóór <strong>22u00</strong> kosteloos van de aankoop af te zien indien blijkt dat de huidige bezetter (KSA) gesteund wordt door de lokale bevolking en er reputatieschade dreigt."
          </p>
          <p><strong>ANALYSE HQ:</strong> Dit is de zwakke plek van de deal! Als we een krachtige video-getuigenis van een inwoner/voorbijganger doorsturen naar de koper, trekt de 3e partij zich terug en blijft het stad met lege handen achter.</p>
        `
      },
      veldTool: {
        type: "interview_vragen",
        titel: "🎙️ PERS-BRIEFING // RICHTVRAGEN VOOR JULLIE KROONGETUIGE",
        vragen: [
          "1. Leg kort uit: 'Het stad wil vanavond om 22u00 ons KSA-lokaal stiekem verkopen zodra ons dak vernieuwd is. Wat vindt u van zo'n achterbakse streek?'",
          "2. Laat de getuige zeggen waarom een jeugdbeweging zoals KSA onmisbaar is in Herentals.",
          "3. Laat de getuige recht in de camera tegen de geheime koper zeggen: 'Trek uw bod in en laat dit lokaal van de KSA!'"
        ]
      }
    },
    {
      id: "stadspark",
      naam: "Stadspark",
      punten: 80,
      adres: "Belgiëlaan, 2200 Herentals",
      beschrijving: "Begrensd door de Belgiëlaan, Olympiadelaan en Augustijnenlaan",
      lat: 51.18059,
      lng: 4.83180,
      code: "park4",
      opdracht: "Het park ligt centraal perfect gelegen om het radio- en wifisignaal van de stad te onderscheppen. Blijkt dat hun connecties ergens ondergronds toevallig pal onder het stadspark eindigen, de ideale plek om een hack uit te voeren. Hier hacken jullie de connectie van de stad om ervoor te zorgen dat de deal om 22u00 niet doorgaat.",
      bonusOpdracht: "Bonusopdracht: Vind in het Stadspark een zichtbare rioolput, elektriciteitskast of lantaarnpaal en maak een dramatische 'hacker-actiefoto' alsof jullie daar ondergronds op het stadsnetwerk inpluggen!",
      vereistBewijs: [
        "Voer de ondergrondse SIGINT-hack hieronder uit in de interactieve terminal terwijl jullie in het Stadspark staan",
        "Upload een groepsfoto/bewijsfoto in het Stadspark dat de connectie van de stad verbroken is"
      ],
      uploadTitel: "📷🎬 UPLOADZONE STADSPARK // BEWIJS VAN ONDERGRONDSE HACK",
      uploadHint: "Upload hier jullie groepsfoto / actiefoto van de geslaagde signaal-hack in het Stadspark.",
      gelektDocument: {
        titel: "GELEKT DOSSIER #04/06 // ONDERGRONDS GLASVEZELPLAN STAD",
        stempel: "INFRASTRUCTUUR // KNOOPPUNT NODE-PK04",
        inhoud: `
          <p><strong>TECHNISCH RAPPORT SIGINT-EENHEID:</strong> De beveiligde dataverbinding tussen het Stadhuis en notariaat <span class="doc-redacted">█████████</span> loopt via een ondergrondse straal- en glasvezelbundel die pal onder het <strong>Stadspark</strong> kruist op frequentie <strong>144.80 MHz</strong>.</p>
          <p>Via deze verbinding wordt om <strong>22u00</strong> de digitale handtekening en de bankbevestiging (<span class="doc-redacted">SWIFT-████</span>) doorgestuurd. Door het ondergrondse knooppunt <code>NODE-PK04</code> in het park te overbelasten, blokkeren we de overdracht.</p>
        `
      },
      veldTool: {
        type: "sigint_hack",
        titel: "💻 INTERACTIEVE VELD-TERMINAL // KNOOPPUNT NODE-PK04 HACKEN",
        frequentie: "144.80 MHz",
        overridePin: "2200"
      }
    },
    {
      id: "kerkplein",
      naam: "Kerkplein (Sint-Waldetrudis)",
      punten: 100,
      adres: "Kerkplein, 2200 Herentals",
      beschrijving: "Het plein rondom de Sint-Waldetrudiskerk",
      lat: 51.17470,
      lng: 4.83467,
      code: "kerk5",
      opdracht: "Tijd om ons voor te bereiden op een blackmail. Het is mogelijk dat het stad ons ontdekt en doorheeft dat we met deze missie bezig zijn. We moeten klaar zijn om een borgsom te betalen, aangezien de stad enkel in geld communiceert. Haal per groep €10 euro af en bewaar ze om terug mee naar HQ te brengen. Film dat je het geld afhaalt, het moet live gebeuren.",
      bonusOpdracht: "Bonusopdracht: Regel het briefje van €10 zónder een klassieke bankautomaat te gebruiken (wissel bijvoorbeeld muntgeld of doe een kleine betaling bij een voorbijganger of handelszaak rond het Kerkplein in ruil voor een biljet van €10 — film de live wissel!).",
      vereistBewijs: [
        "Haal per groep €10 cash af (of wissel live voor een briefje van €10)",
        "Film de geldafhaling / wissel LIVE en upload de video hieronder in het mapje",
        "Breng het fysieke briefje van €10 veilig mee terug naar HQ (Kapucijnenstraat 7)"
      ],
      uploadTitel: "🎬 UPLOADZONE KERKPLEIN // LIVE VIDEO VAN €10 GELDAFHALING",
      uploadHint: "Upload hier de live video waarop duidelijk te zien is dat jullie het biljet van €10 afhalen of wisselen.",
      gelektDocument: {
        titel: "GELEKT DOSSIER #05/06 // ZWARTGELD-PROTOCOL STADSWACHT",
        stempel: "INTERNE NOTA // DIENST HANDHAVING",
        inhoud: `
          <p><strong>ONDERSCHEPTE INSTRUCTIE AAN CONTROLEURS (<span class="doc-redacted">PATROUILLE-05</span>):</strong> "Er zijn geruchten dat KSA-leden vanavond in kleine cellen door het centrum rond de Sint-Waldetrudiskerk bewegen om de verkoop van 22u00 te saboteren."</p>
          <p>"Indien een groep betrapt wordt, kan het dossier enkel 'geseponeerd' worden tegen een onmiddellijke contante borgsom in niet-traceerbare biljetten van <strong>€10,00 per eenheid</strong>. Het stad spreekt immers maar één taal: klinkende munt."</p>
        `
      },
      veldTool: {
        type: "blackmail_instructie",
        titel: "💶 BLACKMAIL- & BORGSOM-PROTOCOL (€10 CASH)",
        punten: [
          "Zorg dat de opname LIVE gebeurt terwijl het briefje van €10 tevoorschijn komt (aan een automaat, kassa of wissel met voorbijganger).",
          "Toon het biljet van €10 duidelijk in de camera met de Sint-Waldetrudiskerk of het Kerkplein op de achtergrond.",
          "Bewaar het biljet veilig bij jullie groepsleider: dit moet fysiek op tafel gelegd worden op HQ!"
        ]
      }
    },
    {
      id: "nieuw-lokaal",
      naam: "Nieuw Lokaal",
      punten: 100,
      adres: "Markgravenstraat 77, 2200 Herentals",
      beschrijving: "Renovatie / voormalige tekenacademie",
      lat: 51.17800,
      lng: 4.82503,
      code: "lokaal6",
      opdracht: "Hier moeten we bewijsmateriaal verzamelen. Duik in het puin van het dak dat net afgebroken is. Vind een zo goed mogelijk bewijsstuk dat het dak spijsrot was. Neem een foto, upload hem hieronder, maar neem ook het bewijsstuk terug mee naar HQ!",
      bonusOpdracht: "Bonusopdracht: Neem bij het puin een 'Forensisch CSI-verslag' op video op (max. 25 sec) waarin één groepslid als bloedserieuze dak-expert het stuk spijsrot dak analyseert voor de rechtbank!",
      vereistBewijs: [
        "Zoek in het afgebroken dakpuin het meest overtuigende stuk 'spijsrot' dakmateriaal",
        "Neem ter plekke een duidelijke bewijsfoto (en/of CSI-bonusvideo) en upload die hieronder",
        "Neem het fysieke stuk spijsrot dak mee terug naar HQ als tastbaar bewijsstuk!"
      ],
      uploadTitel: "📷🎬 UPLOADZONE NIEUW LOKAAL // FOTO & CSI-BEWIJS SPIJSROT DAK",
      uploadHint: "Upload hier de foto van jullie spijsrotte dak-bewijsstuk (vergeet het stuk niet fysiek mee naar HQ te nemen!).",
      gelektDocument: {
        titel: "GELEKT DOSSIER #06/06 // VERVALST KEURINGSVERSLAG DAK",
        stempel: "FORENSISCH DOELWIT // MARKGRAVENSTRAAT 77",
        inhoud: `
          <p><strong>VERVALSTE BIJLAGE BIJ VERKOOPAKTE (<span class="doc-redacted">REF #AKTE-77</span>):</strong> Om de verkoopprijs aan de derde partij op te drijven, heeft het stad verklaard dat de dakconstructie vóór de werken <em>"in kerngezonde staat verkeerde"</em> en dat de KSA de renovatie onnodig vertraagde.</p>
          <p><strong>OPDRACHT HQ:</strong> Als wij met <strong>echt, fysiek spijsrot puin</strong> van het pas afgebroken dak kunnen bewijzen dat het keuringsverslag van aannemer <span class="doc-redacted">██████████ BV</span> vervalst is, is de verkoopakte van 22u00 onmiddellijk nietig wegens schriftvervalsing!</p>
        `
      },
      veldTool: {
        type: "forensisch_protocol",
        titel: "🔬 FORENSISCHE CHECKLIST // BEWIJSSTUK 'SPIJSROT DAK'",
        punten: [
          "Zoek naar vermolmd dakgebinte, doorgerotte panlatten, schimmelsporen of afbrokkelend dakmateriaal.",
          "⚠️ VEILIGHEID OP DE WERF: Kijk goed uit waar je stapt bij het puin en pas op voor uitstekende nagels of splinters.",
          "Neem het beste bewijsstuk fysiek mee naar het Hoofdkwartier (Kapucijnenstraat 7) voor de eindjurering!"
        ]
      }
    }
  ],

  spelers: [
    { id: "daan",      naam: "Daan",      dossierNr: "01", code: "1042", groepId: "Groep Rood" },
    { id: "dominique", naam: "Dominique", dossierNr: "02", code: "2819", groepId: "Groep Geel" },
    { id: "eline",     naam: "Eline",     dossierNr: "03", code: "3940" },
    { id: "emile",     naam: "Emile",     dossierNr: "04", code: "4175", groepId: "Groep Paars" },
    { id: "floris",    naam: "Floris",    dossierNr: "05", code: "5623", groepId: "Groep Geel" },
    { id: "gino",      naam: "Gino",      dossierNr: "06", code: "6381" },
    { id: "hanne",     naam: "Hanne",     dossierNr: "07", code: "7492" },
    { id: "jassin",    naam: "Jassin",    dossierNr: "08", code: "8514", groepId: "Groep Blauw" },
    { id: "jules",     naam: "Jules",     dossierNr: "09", code: "9267", groepId: "Groep Geel" },
    { id: "julie",     naam: "Julie",     dossierNr: "10", code: "1938", groepId: "Groep Paars" },
    { id: "len",       naam: "Len",       dossierNr: "11", code: "2476" },
    { id: "leon",      naam: "Leon",      dossierNr: "12", code: "3589", groepId: "Groep Rood" },
    { id: "lex",       naam: "Lex",       dossierNr: "13", code: "4612", groepId: "Groep Paars" },
    { id: "lotte",     naam: "Lotte",     dossierNr: "14", code: "5734", groepId: "Groep Groen" },
    { id: "luna",      naam: "Luna",      dossierNr: "15", code: "6845", groepId: "Groep Paars" },
    { id: "mart",      naam: "Mart",      dossierNr: "16", code: "7956" },
    { id: "matthijs",  naam: "Matthijs",  dossierNr: "17", code: "8167", groepId: "Groep Blauw" },
    { id: "merlijn",   naam: "Merlijn",   dossierNr: "18", code: "9378", groepId: "Groep Rood" },
    { id: "olivier",   naam: "Olivier",   dossierNr: "19", code: "1489" },
    { id: "phebe",     naam: "Phebe",     dossierNr: "20", code: "2591" },
    { id: "riet",      naam: "Riet",      dossierNr: "21", code: "3614", groepId: "Groep Blauw" },
    { id: "rik",       naam: "Rik",       dossierNr: "22", code: "4725", groepId: "Groep Groen" },
    { id: "rosan",     naam: "Rosan",     dossierNr: "23", code: "5836", groepId: "Groep Groen" },
    { id: "siebe",     naam: "Siebe",     dossierNr: "24", code: "6947" },
    { id: "tobias",    naam: "Tobias",    dossierNr: "25", code: "7158" },
    { id: "vicce",     naam: "Vicce",     dossierNr: "26", code: "8269" },
    { id: "lander",    naam: "Lander",    dossierNr: "27", code: "1234" }
  ]
};

if (typeof window !== "undefined") {
  window.SPEL_CONFIG = SPEL_CONFIG;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = SPEL_CONFIG;
}
