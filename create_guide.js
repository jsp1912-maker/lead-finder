const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, LevelFormat } = require('docx');
const fs = require('fs');

const green = "005826";

const h1 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  children: [new TextRun({ text, bold: true, color: green, size: 32, font: "Arial" })],
  spacing: { before: 400, after: 200 },
});

const h2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  children: [new TextRun({ text, bold: true, color: green, size: 26, font: "Arial" })],
  spacing: { before: 300, after: 150 },
});

const p = (text) => new Paragraph({
  children: [new TextRun({ text, size: 22, font: "Arial" })],
  spacing: { before: 80, after: 80 },
});

const bullet = (text) => new Paragraph({
  numbering: { reference: "bullets", level: 0 },
  children: [new TextRun({ text, size: 22, font: "Arial" })],
  spacing: { before: 60, after: 60 },
});

const tip = (text) => new Paragraph({
  children: [new TextRun({ text: "💡 " + text, size: 22, font: "Arial", italics: true, color: "444444" })],
  spacing: { before: 60, after: 60 },
  indent: { left: 720 },
});

const doc = new Document({
  numbering: {
    config: [{
      reference: "bullets",
      levels: [{
        level: 0,
        format: LevelFormat.BULLET,
        text: "•",
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } }
      }]
    }]
  },
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } }
  },
  sections: [{
    children: [
      // Titel
      new Paragraph({
        children: [new TextRun({ text: "Gebruikershandleiding", bold: true, size: 52, font: "Arial", color: green })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 100 },
      }),
      new Paragraph({
        children: [new TextRun({ text: "Heineken Lead Finder", bold: true, size: 36, font: "Arial", color: "333333" })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 600 },
      }),

      // Intro
      p("De Lead Finder is een tool waarmee je snel sportverenigingen en eetgelegenheden kunt vinden als potentiële leads. Je kunt contactgegevens opzoeken, e-mails schrijven en leads beheren — allemaal vanuit één overzicht."),
      p("Jouw leads zijn alleen voor jou zichtbaar. Collega's hebben hun eigen account met eigen leads."),

      new Paragraph({ spacing: { before: 200, after: 200 } }),

      // 1. Inloggen
      h1("1. Inloggen & Account aanmaken"),
      bullet("Ga naar de app URL (vraag deze op bij je manager)"),
      bullet('Klik op "Registreren" als je nog geen account hebt'),
      bullet("Vul je naam, e-mailadres en wachtwoord in (minimaal 8 tekens)"),
      bullet("Je account blijft permanent bewaard — je hoeft niet opnieuw te registreren"),
      tip("Je leads zijn persoonlijk. Andere gebruikers zien jouw leads niet."),

      new Paragraph({ spacing: { before: 100 } }),

      // 2. Breed zoeken
      h1("2. Breed zoeken"),
      p("Met breed zoeken vind je meerdere clubs tegelijk in een stad of regio."),
      bullet("Kies een sport/club type (bijv. Voetbalclub, Tennisclub, Hockeyclub, Eetgelegenheid)"),
      bullet("Kies een stad uit de lijst"),
      bullet("Kies het aantal clubs dat je wilt vinden (max 50)"),
      bullet("Kies de afstand: alleen deze stad, +10km, +25km of +50km"),
      bullet('Klik op "Zoeken" — de app zoekt automatisch via Google Maps'),
      bullet("Clubs zonder website worden automatisch overgeslagen"),
      tip("Gebruik de afstandsfilter om een hele regio in één keer te doorzoeken."),

      new Paragraph({ spacing: { before: 100 } }),

      // 3. Op naam zoeken
      h1("3. Op naam zoeken"),
      p("Met op naam zoeken zoek je een specifieke club of meerdere clubs tegelijk op."),
      bullet("Typ de naam van een specifieke club in het zoekveld"),
      bullet("Of upload een Excel-bestand met meerdere namen (één naam per cel)"),
      bullet("De app zoekt elke club individueel op via Google Maps"),
      tip("Je kunt tientallen namen tegelijk uploaden via Excel. Houd rekening met ~1-2 minuten per club."),

      new Paragraph({ spacing: { before: 100 } }),

      // 4. Leads beheren
      h1("4. Leads beheren"),
      p("Elke gevonden lead verschijnt als een kaartje met de volgende informatie:"),
      bullet("Naam en stad"),
      bullet("Website, e-mailadres en telefoonnummer"),
      bullet("Logo van de club"),
      p("Je kunt per lead het volgende doen:"),
      bullet("Status instellen: Nieuw, Gecontacteerd, Geïnteresseerd of Afgewezen"),
      bullet("Een notitie toevoegen (bijv. gesproken met Jan op 15 juni)"),
      bullet("Een follow-up datum instellen"),
      bullet("De lead verwijderen"),
      tip("Stel altijd een status in zodat je bijhoudt wie je al benaderd hebt."),

      new Paragraph({ spacing: { before: 100 } }),

      // 5. E-mail schrijven
      h1("5. E-mail schrijven"),
      bullet('Klik op "Email schrijven" bij een lead'),
      bullet("De app genereert automatisch een gepersonaliseerde e-mail op basis van de clubgegevens"),
      bullet("Je kunt de tekst aanpassen voordat je hem verstuurt"),
      bullet("De e-mail wordt opgeslagen bij de lead"),
      tip("Pas de e-mail altijd even aan voor je hem verstuurt — een persoonlijk tintje werkt beter."),

      new Paragraph({ spacing: { before: 100 } }),

      // 6. Exporteren
      h1("6. Exporteren"),
      bullet('Klik op "Exporteren" rechtsboven in het scherm'),
      bullet("Kies Excel (.xlsx) of CSV"),
      bullet("Het bestand bevat alle zichtbare leads met al hun gegevens"),
      tip("Exporteer regelmatig als backup van je leads."),

      new Paragraph({ spacing: { before: 100 } }),

      // 7. Filteren & Sorteren
      h1("7. Filteren & Sorteren"),
      bullet("Gebruik de Filter-knop om te filteren op status (Nieuw, Gecontacteerd, Geïnteresseerd, Afgewezen)"),
      bullet("Gebruik de Sorteren-knop om te sorteren op naam, stad of datum"),
      tip("Filter op 'Nieuw' om snel te zien welke leads je nog niet benaderd hebt."),

      new Paragraph({ spacing: { before: 100 } }),

      // 8. Linker menu
      h1("8. Linker menu"),
      bullet("Eetgelegenheden — zoek naar restaurants en horecagelegenheden"),
      bullet("Sportverenigingen — zoek naar sportclubs"),
      bullet("Evenementen — zoek naar evenementen in een stad"),
      bullet("Dashboard — overzicht van al je leads"),
      bullet("Alle leads / Nieuw / Gecontacteerd / Geïnteresseerd / Afgewezen — gefilterde weergaven"),

      new Paragraph({ spacing: { before: 200 } }),

      // Footer
      new Paragraph({
        children: [new TextRun({ text: "Vragen? Neem contact op met de beheerder van de app.", size: 20, italics: true, color: "888888", font: "Arial" })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 400 },
      }),
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("Gebruikershandleiding_LeadFinder.docx", buffer);
  console.log("Guide aangemaakt: Gebruikershandleiding_LeadFinder.docx");
});
