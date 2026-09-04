# Air Data Lab — SPECIFICATION v0.1

## 1. Scopo didattico
Realizzare una web app statica per studenti universitari di Meccanica del Volo che supporti comprensione e consolidamento di: sistema pitot-statico, catena IAS–CAS–EAS–TAS e regolaggi altimetrici QNH/QFE/STD.

## 2. Principio didattico
Ogni attività significativa segue il ciclo: **PREDICI → INTERAGISCI → OSSERVA → SPIEGA → VERIFICA**. L’app non deve fornire immediatamente la risposta corretta prima dell’azione dello studente.

## 3. Modalità
- **Cockpit**: pannello live Cessna 172 con comandi e strumenti sempre coordinati.
- **Teoria**: percorso visuale animato del sistema Pitot/statico, della misura della velocità e dell’altimetro con capsula aneroide.
- **Esercizi**: problemi progressivi sulla misura della velocità, con risposta verificata e formula di riferimento.

## 4. Moduli
### A. Pitot-statico
Mostrare Pt, Ps, differenza Pt-Ps e strumenti associati. Prevedere almeno una simulazione del blocco della presa statica.

### B. IAS / CAS / EAS / TAS
Mostrare la sequenza delle correzioni e chiedere allo studente di identificare quale effetto viene corretto. Le equazioni e le definizioni aeronautiche saranno fornite/validate dal docente.

### C. Altimetria
Mostrare aerodromo, MSL, aeromobile, altimetro virtuale e pressione impostata. Consentire QNH, QFE e STD 1013.25 hPa. Distinguere chiaramente altitude, height e flight level.

## 5. Pannello teoria ed esercizi
Il pannello Teoria rende visibili, in tre fasi selezionabili, il flusso della pressione totale Pt dal tubo di Pitot, la pressione statica Ps dalle prese statiche, la differenza dinamica `q = Pt − Ps`, la relazione didattica `V ≈ √(2q/ρ)` e il percorso statico verso la capsula aneroide dell’altimetro. Lo spaccato mostra la cassa, la capsula, il leveraggio e l’indice; la deformazione è sincronizzata con la quota del cockpit.

Il pannello Esercizi propone cinque attività: differenza Pt − Ps, correzione CAS/IAS, relazione EAS/TAS, lettura della catena nel modello ISA e riconoscimento della sequenza pitot-stat.

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
2. La teoria mostra almeno il percorso Pitot/statico, l’anemometro e la capsula aneroide.
3. Ogni esercizio richiede una risposta prima di mostrare feedback e soluzione.
4. Teoria ed esercizi funzionano su desktop e smartphone.
5. Nessun errore JavaScript nella console nei percorsi nominali.
6. I test delle funzioni numeriche superano i casi dichiarati.
7. Nessuna definizione aeronautica viene modificata senza esplicita approvazione del docente.
8. README descrive avvio locale e pubblicazione come sito statico.

