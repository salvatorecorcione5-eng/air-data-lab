# Air Data Lab — SPECIFICATION v0.1

## 1. Scopo didattico
Realizzare una web app statica per studenti universitari di Meccanica del Volo che supporti comprensione e consolidamento di: sistema pitot-statico, catena IAS–CAS–EAS–TAS e regolaggi altimetrici QNH/QFE/STD.

## 2. Principio didattico
Ogni attività significativa segue il ciclo: **PREDICI → INTERAGISCI → OSSERVA → SPIEGA → VERIFICA**. L’app non deve fornire immediatamente la risposta corretta nei challenge.

## 3. Modalità
- **Guided**: spiegazione guidata con prediction checkpoint.
- **Explore**: esplorazione libera di parametri e setting.
- **Challenge**: scenari con decisione dello studente, feedback dopo la scelta e spiegazione del principio.

## 4. Moduli
### A. Pitot-statico
Mostrare Pt, Ps, differenza Pt-Ps e strumenti associati. Prevedere almeno una simulazione di blocco della presa statica con prediction prima dell’esito.

### B. IAS / CAS / EAS / TAS
Mostrare la sequenza delle correzioni e chiedere allo studente di identificare quale effetto viene corretto. Le equazioni e le definizioni aeronautiche saranno fornite/validate dal docente.

### C. Altimetria
Mostrare aerodromo, MSL, aeromobile, altimetro virtuale e pressione impostata. Consentire QNH, QFE e STD 1013.25 hPa. Distinguere chiaramente altitude, height e flight level.

## 5. Challenge QFE per la demo
Scenario: aeroporto con elevazione 2,000 ft MSL. Lo studente deve impostare il riferimento affinché l’altimetro legga 0 ft sulla pista. Prima di mostrare la soluzione chiedere una previsione; dopo la scelta mostrare feedback che spieghi il datum aerodromico.

## 6. Vincoli tecnici
- HTML/CSS/JavaScript client-side.
- Nessun backend.
- Nessuna autenticazione.
- Nessuna API key o segreto nel client.
- Nessuna dipendenza necessaria da un LLM a runtime.
- Responsive per smartphone, tablet e desktop.
- Accessibilità di base: label, keyboard focus, contrasto, testo alternativo.

## 7. Struttura minima
```text
air-data-lab/
├── index.html
├── style.css
├── app.js
├── assets/
├── tests/
└── README.md
```

## 8. Criteri di accettazione
1. Tutte le modalità sono raggiungibili dall’home.
2. Ogni challenge richiede una decisione prima del feedback.
3. Il challenge QFE demo funziona su desktop e smartphone.
4. Nessun errore JavaScript nella console nei percorsi nominali.
5. I test delle funzioni numeriche superano i casi dichiarati.
6. Nessuna definizione aeronautica viene modificata senza esplicita approvazione del docente.
7. README descrive avvio locale e pubblicazione come sito statico.

