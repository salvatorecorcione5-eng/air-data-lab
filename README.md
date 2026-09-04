# Air Data Lab

Laboratorio web statico e interattivo per Meccanica del Volo. La demo mette in relazione un profilo verticale animato, un anemometro virtuale, un altimetro virtuale, un variometro e i regolaggi QFE, QNH e STD.

## Avvio locale

Non sono richieste dipendenze o API key. È sufficiente servire la cartella con un server statico:

```bash
python -m http.server 8000
```

Poi aprire [http://localhost:8000](http://localhost:8000).

In alternativa è possibile usare qualsiasi server statico. L’apertura diretta di `index.html` può funzionare, ma un server locale è preferibile per simulare il deployment reale.

## Struttura

- `index.html` — struttura semantica, controlli, scena e strumenti SVG.
- `style.css` — layout responsive, accessibilità visiva e stile degli strumenti.
- `air-data-model.js` — funzioni numeriche pure, riutilizzabili e testabili.
- `app.js` — stato dell’interazione, rendering live, teoria animata ed esercizi sulla misura della velocità.
- `tests/app.test.js` — test numerici ISA, catena pitot-statico, QFE e blocco statico.

Le modalità sono tre: Cockpit (pannello live C172), Teoria (schema animato del sistema Pitot/static, derivazione `Pt − Ps = q → V`, spaccato dell’altimetro e capsula aneroide sincronizzata con la quota) ed Esercizi (cinque problemi progressivi sulla catena Pt–Ps, CAS–IAS, EAS–TAS e sul modello ISA).

Il cockpit consente di cambiare TAS e osservare la lancetta IAS/CAS in movimento. Il variometro permette di impostare un rateo di salita o discesa e avviare una simulazione temporale: l’aeromobile e le quote nella scena si spostano mentre pressione e strumenti vengono ricalcolati.

## Modello didattico

La demo usa il modello ISA nella troposfera, con i valori del materiale fornito:

- `P0 = 101325 Pa`;
- `T0 = 288.15 K`;
- `rho0 = 1.225 kg/m³`;
- `R = 287 J/(kg K)`;
- gradiente termico `0.0065 K/m`;
- `gamma = 1.4`.

Lo scenario live usa un aeroporto a `2.000 ft MSL` e un QNH dimostrativo di `1005,00 hPa`. QFE è calcolato come la pressione ISA alla quota della pista, così sulla pista la lettura QFE è 0 ft. QNH riferisce la lettura al MSL; STD usa 1013,25 hPa.

La catena della velocità è resa esplicita: il modello calcola la pressione totale comprimibile dal Mach, ricava CAS dalla pressione differenziale rispetto a `rho0`, EAS da `TAS * sqrt(rho/rho0)` e IAS dalla correzione di posizione configurabile. La correzione EAS/CAS è quindi coerente con la relazione fornita nelle slide; non viene introdotto un diagramma proprietario non presente nel materiale.

Il blocco della presa statica è una simulazione didattica semplificata: la pressione usata dall’altimetro e dal differenziale dell’anemometro resta quella catturata al momento del blocco. Va confrontata con il docente prima di usarla come rappresentazione operativa completa.

## Test

Con Node.js installato:

```bash
node --test tests/app.test.js
```

## Deployment statico

Pubblicare l’intera cartella su un hosting statico, mantenendo insieme `index.html`, `style.css`, `air-data-model.js` e `app.js`. Non inserire chiavi API, segreti o dati personali nel repository. Verificare l’URL pubblico e, se usato, il QR code dopo la pubblicazione.

## Nota didattica

Le definizioni aeronautiche e le equazioni devono essere validate dal docente. In particolare, la distinzione usata nell’esperienza è:

- **height**: distanza verticale dalla pista/stazione di riferimento;
- **altitude**: quota rispetto al livello medio del mare;
- **flight level / quota-pressione**: riferimento alla pressione standard STD/QNE.

