// Original German starter texts, graded from A1 to B2.

export interface StarterLesson {
  title: string;
  level: string;
  description: string;
  text: string;
}

export const STARTER_LESSONS: Record<string, StarterLesson[]> = {
  de: [
    {
      title: "Hallo! Ich heiße Lena.",
      level: "A1",
      description: "Lena stellt sich vor: Wohnort, Studium, Freizeit.",
      text: `Hallo! Ich heiße Lena. Ich bin 24 Jahre alt und komme aus Hamburg. Jetzt wohne ich in München.

Ich bin Studentin. Ich studiere Biologie an der Universität. Das Studium ist schwer, aber es macht Spaß.

Ich wohne in einer kleinen Wohnung mit meiner Freundin Sara. Sara kommt aus Italien. Sie spricht Italienisch, Deutsch und Englisch. Wir kochen oft zusammen. Sara kocht sehr gut, ich koche nicht so gut. Aber ich wasche gern ab!

Am Wochenende gehe ich gern in den Park. Ich lese ein Buch, oder ich treffe Freunde. Manchmal fahren wir mit dem Fahrrad an den See. Im Sommer schwimmen wir dort.

Und du? Wie heißt du? Woher kommst du? Was machst du gern am Wochenende?`,
    },
    {
      title: "Im Café",
      level: "A1",
      description: "Ein Dialog: Kaffee und Kuchen bestellen und bezahlen.",
      text: `Kellner: Guten Morgen! Was darf ich Ihnen bringen?

Tom: Guten Morgen. Ich hätte gern einen Kaffee, bitte.

Kellner: Mit Milch und Zucker?

Tom: Nur mit Milch, bitte. Haben Sie auch Kuchen?

Kellner: Ja, wir haben Apfelkuchen und Käsekuchen. Der Apfelkuchen ist heute ganz frisch.

Tom: Dann nehme ich ein Stück Apfelkuchen.

Kellner: Gern. Möchten Sie Sahne dazu?

Tom: Nein, danke. Ohne Sahne.

Kellner: Kommt sofort.

Tom: Entschuldigung! Ich möchte bitte zahlen.

Kellner: Zusammen oder getrennt?

Tom: Zusammen, bitte.

Kellner: Das macht sieben Euro achtzig.

Tom: Hier sind neun Euro. Stimmt so.

Kellner: Vielen Dank! Einen schönen Tag noch!

Tom: Danke, gleichfalls!`,
    },
    {
      title: "Der verlorene Schlüssel",
      level: "A2",
      description: "Jonas steht vor seiner Tür – und sein Schlüssel ist weg.",
      text: `Es ist Montagmorgen. Jonas steht vor seiner Wohnungstür und sucht in seiner Tasche. Wo ist sein Schlüssel? Er sucht in der Jackentasche, in der Hosentasche und im Rucksack. Nichts.

„So ein Mist!", sagt er leise. In zwanzig Minuten fängt seine Arbeit an, und er hat seinen Laptop in der Wohnung vergessen.

Jonas denkt nach. Gestern Abend war er mit seinem Bruder im Kino. Danach sind sie noch in eine Bar gegangen. Hat er den Schlüssel dort verloren?

Er ruft seinen Bruder an. „Hallo Max, hast du vielleicht meinen Schlüssel gesehen?" Max lacht. „Ja! Du hast ihn gestern in meinem Auto liegen lassen. Ich bringe ihn dir in zehn Minuten vorbei."

Jonas atmet auf. Er setzt sich auf die Treppe und wartet. Zehn Minuten später hält ein kleines rotes Auto vor dem Haus. Max steigt aus und hält den Schlüssel hoch.

„Danke, du bist der Beste!", ruft Jonas. „Ich weiß", antwortet Max und grinst. „Aber heute Abend bezahlst du das Bier."`,
    },
    {
      title: "Ein Wochenende in Berlin",
      level: "A2",
      description: "Eine Reise mit der Schwester: Sehenswürdigkeiten, Currywurst und Regen.",
      text: `Letztes Wochenende bin ich mit meiner Schwester nach Berlin gefahren. Wir haben den Zug genommen, weil er schneller und bequemer als das Auto ist. Die Fahrt hat nur vier Stunden gedauert.

Am Samstagmorgen haben wir zuerst das Brandenburger Tor besucht. Dort waren sehr viele Touristen, aber es war trotzdem schön. Danach sind wir zum Reichstag gelaufen. Von der Glaskuppel hat man einen tollen Blick über die ganze Stadt.

Am Nachmittag haben wir eine Bootsfahrt auf der Spree gemacht. Der Kapitän hat viel über die Geschichte der Stadt erzählt, zum Beispiel über die Mauer, die Berlin fast dreißig Jahre lang geteilt hat.

Am Abend waren wir sehr hungrig. Wir haben in Kreuzberg eine Currywurst gegessen – natürlich mit Pommes! Meine Schwester fand sie ein bisschen zu scharf, aber mir hat sie sehr gut geschmeckt.

Am Sonntag hat es den ganzen Tag geregnet. Deshalb sind wir ins Museum gegangen. Auf der Museumsinsel gibt es fünf große Museen. Wir haben leider nur zwei geschafft. Ich möchte auf jeden Fall bald wieder nach Berlin fahren.`,
    },
    {
      title: "Warum die Deutschen so gern Rad fahren",
      level: "B1",
      description: "Kurze Wege, neue Radwege und Umweltbewusstsein – aber nicht alles ist perfekt.",
      text: `In vielen deutschen Städten sieht man morgens mehr Fahrräder als Autos. Besonders in Münster, Freiburg oder Leipzig gehört das Rad für viele Menschen einfach zum Alltag. Aber woran liegt das eigentlich?

Ein Grund ist die Größe der Städte. Viele Wege sind kürzer als fünf Kilometer, und diese Strecke schafft man mit dem Fahrrad oft schneller als mit dem Auto, vor allem, wenn man die Parkplatzsuche mitrechnet.

Außerdem haben viele Städte in den letzten Jahren kräftig in Radwege investiert. Es gibt breite Fahrradstraßen, auf denen Autos nur zu Gast sind, und an großen Bahnhöfen stehen oft riesige Fahrradparkhäuser.

Auch das Umweltbewusstsein spielt eine wichtige Rolle. Wer mit dem Rad zur Arbeit fährt, produziert keine Abgase und bewegt sich gleichzeitig. Viele Arbeitgeber unterstützen das inzwischen, indem sie ihren Mitarbeitern ein Dienstrad anbieten.

Trotzdem ist nicht alles perfekt. Radfahrer beschweren sich über zu schmale Wege, gefährliche Kreuzungen und Autofahrer, die zu wenig Abstand halten. Und im Winter, wenn es früh dunkel wird und die Straßen nass sind, lassen auch überzeugte Radfahrer ihr Fahrrad manchmal lieber im Keller stehen.

Die Diskussion darüber, wie viel Platz das Auto in der Stadt bekommen soll, wird wohl noch lange weitergehen.`,
    },
    {
      title: "Der Sonntag ist heilig",
      level: "B1",
      description: "Warum in Deutschland am Sonntag fast alle Geschäfte geschlossen sind.",
      text: `In Deutschland sind die meisten Geschäfte am Sonntag geschlossen. Für viele Besucher aus dem Ausland ist das zuerst eine Überraschung. Wer am Samstagabend vergessen hat, Milch oder Brot zu kaufen, hat am Sonntag ein Problem – zumindest auf den ersten Blick.

Die Sonntagsruhe ist sogar im Grundgesetz geschützt. Der Sonntag soll ein Tag der Erholung sein, an dem Familien Zeit miteinander verbringen können. Deshalb darf man an diesem Tag meistens auch keinen Rasen mähen oder laute Arbeiten im Garten machen.

Ganz ohne Einkaufen geht es aber doch. Bäckereien dürfen am Sonntagmorgen einige Stunden öffnen, und viele Menschen holen sich dann frische Brötchen zum Frühstück. Auch Tankstellen und Geschäfte in großen Bahnhöfen haben geöffnet. In Berlin gibt es außerdem die „Spätis", kleine Läden, die bis spät in die Nacht Getränke und Snacks verkaufen.

Nicht alle finden die Regeln gut. Kritiker sagen, sie seien altmodisch und schlecht für die Wirtschaft. Befürworter antworten, dass ein gemeinsamer freier Tag wichtig für die Gesellschaft sei. Und viele, die eine Weile in Deutschland gelebt haben, geben zu: Nach einiger Zeit lernt man den ruhigen Sonntag lieben.`,
    },
    {
      title: "Vom Fischer und seiner Frau",
      level: "B2",
      description: "Das Märchen der Brüder Grimm, frei nacherzählt.",
      text: `Es war einmal ein Fischer, der mit seiner Frau in einer kleinen, schmutzigen Hütte direkt am Meer lebte. Jeden Tag ging er hinaus und angelte.

Eines Tages biss ein großer Butt an. Doch als der Fischer ihn aus dem Wasser zog, begann der Fisch zu sprechen: „Lass mich leben! Ich bin kein richtiger Fisch, sondern ein verwunschener Prinz." Der Fischer war ein gutmütiger Mann, und so setzte er den Butt wieder ins Wasser.

Als er nach Hause kam und seiner Frau davon erzählte, wurde sie wütend. „Hast du dir denn nichts gewünscht?", fragte sie. „Geh sofort zurück und wünsch dir ein kleines Häuschen!" Widerwillig ging der Mann zum Meer und rief den Butt. Und tatsächlich: Als er heimkehrte, stand dort, wo die Hütte gewesen war, ein hübsches Häuschen mit einem Garten.

Doch die Frau war nicht lange zufrieden. Bald wollte sie ein Schloss, dann wollte sie König werden, dann Kaiser und schließlich sogar Papst. Jedes Mal schickte sie ihren Mann zum Meer, und jedes Mal wurde das Wasser dunkler und unruhiger. Der Butt erfüllte jeden Wunsch.

Eines Morgens sah die Frau die Sonne aufgehen und rief: „Ich will werden wie der liebe Gott!" Der Fischer erschrak, doch er gehorchte. Draußen tobte ein furchtbarer Sturm, und die Wellen waren so hoch wie Kirchtürme. Mit zitternder Stimme trug er dem Butt den Wunsch vor.

„Geh nur hin", antwortete der Butt, „sie sitzt schon wieder in ihrer alten Hütte." Und dort sitzen sie noch bis auf den heutigen Tag.`,
    },
    {
      title: "Wie das Gehirn eine Sprache lernt",
      level: "B2",
      description: "Verständlicher Input, Wiederholung in Abständen – und warum Lesen so wirksam ist.",
      text: `Wer als Erwachsener eine Fremdsprache lernt, hat oft das Gefühl, gegen sein eigenes Gehirn zu kämpfen. Vokabeln, die man gestern noch wusste, sind heute plötzlich verschwunden, und Grammatikregeln, die man stundenlang gebüffelt hat, fallen einem im Gespräch einfach nicht ein.

Viele Sprachwissenschaftler sind überzeugt, dass das nicht an mangelndem Talent liegt, sondern an der Methode. Der amerikanische Linguist Stephen Krashen vertritt seit Jahrzehnten die These, dass wir Sprachen vor allem dann erwerben, wenn wir Botschaften verstehen – also durch sogenannten verständlichen Input. Entscheidend sei, dass der Text oder das Gespräch nur ein kleines bisschen über unserem aktuellen Niveau liegt.

Das erklärt, warum Lesen und Zuhören so wirksam sein können. Begegnet man einem Wort immer wieder in unterschiedlichen Zusammenhängen, verknüpft das Gehirn es nach und nach mit Bedeutungen, Klängen und Gefühlen. Aus einer isolierten Vokabel wird so ein lebendiger Teil des eigenen Wortschatzes.

Hinzu kommt der sogenannte Abstandseffekt: Informationen bleiben besser im Gedächtnis, wenn man sie in wachsenden Zeitabständen wiederholt, statt sie an einem einzigen Abend zu pauken. Moderne Lernprogramme nutzen diesen Effekt, indem sie berechnen, wann man ein Wort voraussichtlich vergessen würde, und es kurz davor noch einmal abfragen.

Das Rezept klingt also erstaunlich einfach: viel lesen und hören, was einen wirklich interessiert, unbekannte Wörter im Kontext nachschlagen und sie regelmäßig wiederholen. Geduld braucht man trotzdem – aber jede Seite bringt einen ein kleines Stück weiter.`,
    },
  ],
};
