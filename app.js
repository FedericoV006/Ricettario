let ricettario = JSON.parse(localStorage.getItem('ricettario_polillo')) || [];
let listaSpesa = JSON.parse(localStorage.getItem('lista_spesa_polillo')) || [];
let paginaCorrenteIndex = 0; 
let paginaPrecedenteIndex = 0; 
let idRicettaInModifica = null;
let idRicettaStoricoAttiva = null; 
let filtroRicercaIndice = ""; 

let passiCorrenti = [];
let indicePassoAttivo = 0;
let chefTimerInterval = null;
let chefSecondiTotali = 0;
let chefSecondiRimanenti = 0;
let chefTimerAttivo = false;
let audioCtx = null;
let ricettaIdCorrenteChef = null;

const btnChiudi = document.getElementById('btn-chiudi-libro');
const copertina = document.getElementById('libro-copertina');
const libroAperto = document.getElementById('libro-aperto');

const modal = document.getElementById('modal-ricetta');
const btnNuovaRicetta = document.getElementById('btn-nuova-ricetta');
const btnAnnulla = document.getElementById('btn-annulla');
const formRicetta = document.getElementById('form-ricetta');

const modalStorico = document.getElementById('modal-storico');

const btnPrec = document.getElementById('btn-prec');
const btnSucc = document.getElementById('btn-succ');

// Copertina editoriale di lusso
document.getElementById('libro-copertina').innerHTML = `
    <div class="dettagli-copertina">
        <img src="https://images.unsplash.com/photo-1543353071-10c8ba85a904?auto=format&fit=crop&w=1000&q=85" alt="Cucina" class="copertina-bg-img">
        <div class="copertina-overlay-sfumatura"></div>
        
        <div class="copertina-contenuto-box">
            <div class="etichetta-copertina">Edizione Privata</div>
            <h1 class="titolo-copertina">Il Mio<br>Ricettario</h1>
            <div class="sottotitolo-copertina">Archivio Personale di Cucina</div>
            <button id="btn-apri-libro" class="btn-apri-copertina">Sfoglia Volume</button>
        </div>
    </div>
`;

document.getElementById('btn-apri-libro').addEventListener('click', () => {
    inizializzaAudioContext();
    copertina.classList.add('nascosto');
    setTimeout(() => {
        libroAperto.classList.remove('nascosto');
        renderizzaLibro();
    }, 300);
});

btnChiudi.addEventListener('click', () => {
    libroAperto.classList.add('nascosto');
    setTimeout(() => {
        copertina.classList.remove('nascosto');
    }, 300);
});

document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'btn-nuova-ricetta') {
        inizializzaAudioContext();
        idRicettaInModifica = null;
        formRicetta.reset();
        modal.querySelector('h2').textContent = "Nuova Ricetta";
        modal.classList.remove('hidden');
    }
});

btnAnnulla.addEventListener('click', () => {
    modal.classList.add('hidden');
    formRicetta.reset();
    idRicettaInModifica = null;
});

formRicetta.addEventListener('submit', (e) => {
    e.preventDefault();

    const personeIniziali = parseInt(document.getElementById('persone').value);
    const ingredientiInseriti = document.getElementById('ingredienti').value;

    if (idRicettaInModifica) {
        const ricetta = ricettario.find(r => r.id === idRicettaInModifica);
        if (ricetta) {
            ricetta.titolo = document.getElementById('titolo').value;
            ricetta.categoria = document.getElementById('categoria').value;
            ricetta.foto = document.getElementById('foto').value;
            ricetta.persone = personeIniziali;
            ricetta.personeBase = personeIniziali;
            ricetta.ingredienti = ingredientiInseriti;
            ricetta.ingredientiBase = ingredientiInseriti;
            ricetta.preparazione = document.getElementById('preparazione').value;
            ricetta.note = document.getElementById('note').value;
        }
    } else {
        const nuovaRicetta = {
            id: Date.now(),
            titolo: document.getElementById('titolo').value,
            categoria: document.getElementById('categoria').value,
            foto: document.getElementById('foto').value,
            persone: personeIniziali,
            personeBase: personeIniziali,
            ingredienti: ingredientiInseriti,
            ingredientiBase: ingredientiInseriti,
            preparazione: document.getElementById('preparazione').value,
            note: document.getElementById('note').value,
            valutazione: 0,
            prove: []
        };
        ricettario.push(nuovaRicetta);
    }

    salvaDati();
    formRicetta.reset();
    idRicettaInModifica = null;
    modal.classList.add('hidden');
    renderizzaLibro();
});

function salvaDati() {
    localStorage.setItem('ricettario_polillo', JSON.stringify(ricettario));
    localStorage.setItem('lista_spesa_polillo', JSON.stringify(listaSpesa));
}

function esportaBackup() {
    const dati = { ricettario: ricettario, listaSpesa: listaSpesa };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dati, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "ricettario_polillo_backup.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function importaBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const contenuto = JSON.parse(e.target.result);
            if (contenuto.ricettario) {
                ricettario = contenuto.ricettario;
                if (contenuto.listaSpesa) listaSpesa = contenuto.listaSpesa;
                salvaDati();
                paginaCorrenteIndex = 0;
                renderizzaLibro();
                alert("Backup importato con successo!");
            } else {
                alert("File di backup non valido.");
            }
        } catch (err) {
            alert("Errore durante la lettura del file.");
        }
    };
    reader.readAsText(file);
}

function impostaValutazione(idRicetta, stelle) {
    const ricetta = ricettario.find(r => r.id === idRicetta);
    if (ricetta) {
        ricetta.valutazione = stelle;
        salvaDati();
        renderizzaLibro();
    }
}

function apriStoricoProve(idRicetta) {
    inizializzaAudioContext();
    idRicettaStoricoAttiva = idRicetta;
    chiudiFormNuovaProva();
    renderizzaStoricoModal();
    modalStorico.classList.remove('hidden');
}

function chiudiStoricoProve() {
    modalStorico.classList.add('hidden');
    idRicettaStoricoAttiva = null;
}

function apriFormNuovaProva() {
    document.getElementById('form-nuova-prova-box').style.display = 'block';
    const oggi = new Date().toISOString().split('T')[0];
    document.getElementById('prova-data').value = oggi;
    document.getElementById('prova-nota').value = '';
}

function chiudiFormNuovaProva() {
    document.getElementById('form-nuova-prova-box').style.display = 'none';
}

function salvaNuovaProva(e) {
    e.preventDefault();
    const ricetta = ricettario.find(r => r.id === idRicettaStoricoAttiva);
    if (!ricetta) return;

    if (!ricetta.prove) ricetta.prove = [];

    const dataInput = document.getElementById('prova-data').value;
    let dataFormattata = dataInput;
    if (dataInput) {
        const [anno, mese, giorno] = dataInput.split('-');
        const mesi = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
        dataFormattata = `${parseInt(giorno)} ${mesi[parseInt(mese) - 1]} ${anno}`;
    }

    const nuovaProva = {
        id: Date.now(),
        data: dataFormattata,
        stelle: parseInt(document.getElementById('prova-stelle').value),
        nota: document.getElementById('prova-nota').value
    };

    ricetta.prove.unshift(nuovaProva);

    const sommaStelle = ricetta.prove.reduce((acc, p) => acc + p.stelle, 0);
    ricetta.valutazione = Math.round(sommaStelle / ricetta.prove.length);

    salvaDati();
    chiudiFormNuovaProva();
    renderizzaStoricoModal();
    renderizzaLibro();
}

function eliminaProva(idProva) {
    const ricetta = ricettario.find(r => r.id === idRicettaStoricoAttiva);
    if (!ricetta || !ricetta.prove) return;

    ricetta.prove = ricetta.prove.filter(p => p.id !== idProva);

    if (ricetta.prove.length > 0) {
        const sommaStelle = ricetta.prove.reduce((acc, p) => acc + p.stelle, 0);
        ricetta.valutazione = Math.round(sommaStelle / ricetta.prove.length);
    } else {
        ricetta.valutazione = 0;
    }

    salvaDati();
    renderizzaStoricoModal();
    renderizzaLibro();
}

function renderizzaStoricoModal() {
    const ricetta = ricettario.find(r => r.id === idRicettaStoricoAttiva);
    if (!ricetta) return;

    if (!ricetta.prove) ricetta.prove = [];

    let mediaStelle = 0;
    if (ricetta.prove.length > 0) {
        const somma = ricetta.prove.reduce((acc, p) => acc + p.stelle, 0);
        mediaStelle = (somma / ricetta.prove.length).toFixed(1);
    }

    document.getElementById('storico-sottotitolo').innerHTML = `★ ${mediaStelle} • ${ricetta.prove.length} prove registrate`;

    const container = document.getElementById('lista-prove-container');
    if (ricetta.prove.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: var(--testo-sfumato); font-style: italic; padding: 2rem 0;">Nessuna prova registrata per questa ricetta. Clicca su "+ Segna una prova" per iniziare!</p>`;
        return;
    }

    container.innerHTML = ricetta.prove.map(p => {
        let stelleHtml = '';
        for (let s = 1; s <= 5; s++) {
            stelleHtml += `<span style="color: ${s <= p.stelle ? 'var(--oro-accento)' : '#d1d1d1'}; font-size: 0.9rem;">★</span>`;
        }

        return `
            <div class="prova-card">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 700; font-size: 0.9rem; color: var(--testo-principale);">${p.data}</span>
                    <button onclick="eliminaProva(${p.id})" title="Elimina prova" style="background: none; border: none; color: #b83232; cursor: pointer; font-size: 1.1rem; font-weight: bold;">×</button>
                </div>
                <div style="display: flex; gap: 2px;">${stelleHtml}</div>
                <div style="font-size: 0.95rem; color: var(--testo-principale); margin-top: 0.2rem; line-height: 1.4;">${p.nota || 'Nessuna nota annotata.'}</div>
            </div>
        `;
    }).join('');
}

function renderizzaLibro() {
    const titoloSxHeader = document.getElementById('titolo-sinistra-header');
    const titoloDxHeader = document.getElementById('titolo-destra-header');
    const contSx = document.getElementById('contenuto-pagina-sinistra');
    const contDx = document.getElementById('contenuto-pagina-destra');
    const numPagSx = document.getElementById('num-pag-sx');
    const numPagDx = document.getElementById('num-pag-dx');

    const paginaSinistraEl = document.querySelector('.pagina-sinistra');
    const paginaDestraEl = document.querySelector('.pagina-destra');

    const isMobile = window.innerWidth <= 1024;
    
    let spreadIndex = paginaCorrenteIndex;
    if (isMobile) {
        spreadIndex = Math.floor(paginaCorrenteIndex / 2);
        const isRightPage = (paginaCorrenteIndex % 2 === 1);

        if (paginaSinistraEl && paginaDestraEl) {
            if (!isRightPage) {
                paginaSinistraEl.classList.add('pagina-attiva-mobile');
                paginaDestraEl.classList.remove('pagina-attiva-mobile');
            } else {
                paginaSinistraEl.classList.remove('pagina-attiva-mobile');
                paginaDestraEl.classList.add('pagina-attiva-mobile');
            }
        }
    } else {
        if (paginaSinistraEl && paginaDestraEl) {
            paginaSinistraEl.classList.remove('pagina-attiva-mobile');
            paginaDestraEl.classList.remove('pagina-attiva-mobile');
        }
    }

    const maxSpread = ricettario.length + 1;
    const maxMobileIndex = (ricettario.length + 2) * 2 - 1;

    if (isMobile) {
        btnPrec.style.display = paginaCorrenteIndex === 0 ? 'none' : 'inline-block';
        btnSucc.style.display = paginaCorrenteIndex >= maxMobileIndex ? 'none' : 'inline-block';
    } else {
        btnPrec.style.display = paginaCorrenteIndex === 0 ? 'none' : 'inline-block';
        btnSucc.style.display = paginaCorrenteIndex >= maxSpread ? 'none' : 'inline-block';
    }

    if (spreadIndex === 0) {
        titoloSxHeader.textContent = "INDICE GENERALE";
        titoloDxHeader.textContent = "COLLEZIONE";
        numPagSx.textContent = "1";
        numPagDx.textContent = "2";

        const categorieMapping = [
            { id: 'colazioni', titoloSezione: 'Colazioni & Bakery' },
            { id: 'primi-mare', titoloSezione: 'Primi di Mare' },
            { id: 'primi-terra', titoloSezione: 'Primi di Terra' },
            { id: 'secondi-mare', titoloSezione: 'Secondi di Mare' },
            { id: 'secondi-terra', titoloSezione: 'Secondi di Terra' },
            { id: 'pizze', titoloSezione: 'Pizze & Lievitati' },
            { id: 'contorni', titoloSezione: 'Contorni' },
            { id: 'dolci', titoloSezione: 'Dolci & Pasticceria' }
        ];

        let htmlSx = `
            <div style="margin-bottom: 0.8rem;">
                <input type="text" id="input-cerca-indice" value="${filtroRicercaIndice}" oninput="aggiornaFricercaIndice(this.value)" placeholder="🔍 Cerca ricetta..." style="width: 100%; padding: 0.6rem 0.9rem; border-radius: 8px; border: 1px solid var(--colore-bordo); font-size: 0.9rem; box-sizing: border-box; background: #fff;">
            </div>
            <div class="indice-romanzo-scroll">
        `;

        categorieMapping.forEach(cat => {
            let ricetteCat = ricettario.filter(r => r.categoria === cat.id);
            if (filtroRicercaIndice.trim() !== "") {
                ricetteCat = ricetteCat.filter(r => r.titolo.toLowerCase().includes(filtroRicercaIndice.toLowerCase()));
            }

            if (ricetteCat.length === 0 && filtroRicercaIndice.trim() !== "") return;

            let htmlLista = '';
            if (ricetteCat.length === 0) {
                htmlLista = `<li class="voce-indice vuota" style="color: #999; font-style: italic; padding: 0.5rem 0.8rem;">Nessuna ricetta presente</li>`;
            } else {
                htmlLista = ricetteCat.map(r => {
                    const indiceGlobale = ricettario.findIndex(item => item.id === r.id);
                    const numeroPaginaLibro = (indiceGlobale + 1) * 2 + 1;
                    return `
                        <li class="voce-indice" onclick="vaiAllaRicetta(${indiceGlobale})" style="display: flex; flex-direction: column; align-items: flex-start; gap: 0.3rem; padding: 0.6rem 0.5rem; border-bottom: 1px solid rgba(0,0,0,0.05);">
                            <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
                                <span style="font-weight: 600; font-size: 0.95rem;">${r.titolo}</span>
                                <span style="font-size: 0.75rem; color: var(--testo-sfumato);">pag. ${numeroPaginaLibro}</span>
                            </div>
                            <div style="display: flex; gap: 1rem; align-items: center; width: 100%; justify-content: flex-end; margin-top: 0.2rem;" onclick="event.stopPropagation()">
                                <button onclick="apriModificaRicetta(${r.id})" title="Modifica" style="background: none; border: none; cursor: pointer; font-size: 0.85rem;">✏️ Modifica</button>
                                <button onclick="eliminaRicetta(${r.id})" title="Elimina" style="background: none; border: none; color: #b83232; font-size: 0.85rem; cursor: pointer; font-weight: bold;">✕ Elimina</button>
                            </div>
                        </li>
                    `;
                }).join('');
            }

            htmlSx += `
                <div class="sezione-indice-gruppo">
                    <h4>${cat.titoloSezione}</h4>
                    <ul class="lista-capitoli">${htmlLista}</ul>
                </div>
            `;
        });

        const pagListaSpesa = (ricettario.length + 1) * 2 + 1;
        htmlSx += `
            <div class="sezione-indice-gruppo" style="margin-top: 1.5rem; margin-bottom: 1rem; border-top: 1px dashed var(--colore-bordo); padding-top: 1rem;">
                <h4 style="color: var(--oro-accento); cursor: pointer; font-size: 1rem;" onclick="vaiAllaSpesa()">🛒 LISTA DELLA SPESA (pag. ${pagListaSpesa})</h4>
            </div>
        `;

        htmlSx += '</div>';
        contSx.innerHTML = htmlSx;

        if (filtroRicercaIndice.trim() !== "") {
            setTimeout(() => {
                const inputEl = document.getElementById('input-cerca-indice');
                if (inputEl) {
                    inputEl.focus();
                    inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length);
                }
            }, 50);
        }

        contDx.innerHTML = `
            <div style="text-align: center; margin-top: 4rem; color: var(--testo-sfumato); display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <p style="font-size: 1.1rem; font-weight: 500; margin-bottom: 2rem;">Seleziona una ricetta dall'indice o creane una nuova per iniziare.</p>
                <button id="btn-nuova-ricetta" class="btn-classico" style="font-size: 1rem; padding: 0.9rem 2.2rem; border-radius: 30px;">+ Nuova Ricetta</button>
            </div>
        `;

    } else if (spreadIndex <= ricettario.length) {
        const ricetta = ricettario[spreadIndex - 1];
        if (!ricetta) return;

        titoloSxHeader.textContent = ricetta.titolo.toUpperCase();
        titoloDxHeader.textContent = ricetta.titolo.toUpperCase();
        
        const pagDispari = spreadIndex * 2 + 1;
        const pagPari = pagDispari + 1;
        numPagSx.textContent = pagDispari;
        numPagDx.textContent = pagPari;

        if (!ricetta.personeBase) ricetta.personeBase = ricetta.persone;
        if (!ricetta.ingredientiBase) ricetta.ingredientiBase = ricetta.ingredienti;
        if (ricetta.valutazione === undefined) ricetta.valutazione = 0;
        if (!ricetta.prove) ricetta.prove = [];

        const righeIngredienti = ricetta.ingredienti.split('\n').filter(r => r.trim() !== '');
        const htmlIngredienti = righeIngredienti.map((ing, i) => `
            <div style="display: flex; justify-content: space-between; align-items: center; margin: 0.5rem 0; font-size: 0.95rem; border-bottom: 1px solid rgba(0,0,0,0.05); padding-bottom: 0.4rem;">
                <span>• ${ing}</span>
                <button id="btn-carrello-${spreadIndex}-${i}" onclick="aggiungiAllaSpesaSilenzioso('${ing.replace(/'/g, "\\'")}', this.id)" title="Aggiungi alla spesa" style="background: none; border: none; cursor: pointer; font-size: 1.1rem; opacity: 0.7;">🛒</button>
            </div>
        `).join('');

        let htmlNoteSezione = '';
        if (ricetta.note && ricetta.note.trim() !== '') {
            htmlNoteSezione = `
                <div class="box-note-chef">
                    <div style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; color: var(--oro-accento); margin-bottom: 0.3rem;">Note dello Chef</div>
                    <div style="font-size: 0.9rem; color: var(--testo-principale); font-style: italic; line-height: 1.4;">${ricetta.note}</div>
                </div>
            `;
        }

        let htmlStelle = '';
        for (let s = 1; s <= 5; s++) {
            const attivaClass = s <= ricetta.valutazione ? 'attiva' : '';
            htmlStelle += `<span class="stella ${attivaClass}" onclick="impostaValutazione(${ricetta.id}, ${s})">★</span>`;
        }

        let arrayPassi = ricetta.preparazione
            .split(/(?:\r\n|\r|\n|\d+\.\s+)/)
            .map(p => p.trim())
            .filter(p => p.length > 0);

        if (arrayPassi.length === 0) arrayPassi = [ricetta.preparazione];

        const htmlPassiPreparazione = arrayPassi.map((passo, idx) => {
            const matchTempo = passo.match(/(\d+)\s*(ore|ora|minuti|minuto|min|secondi|secondo|sec)/i);
            let bottoneTimerHtml = '';

            if (matchTempo) {
                bottoneTimerHtml = `<button class="btn-avvia-minuto" onclick="avviaTimerDaPasso(${ricetta.id}, ${idx})">⏱️ Avvia ${matchTempo[0]}</button>`;
            }

            return `
                <div class="passo-preparazione-card">
                    <div class="passo-numero-cerchio">${idx + 1}</div>
                    <div class="passo-contenuto">
                        <div>${passo}</div>
                        ${bottoneTimerHtml}
                    </div>
                </div>
            `;
        }).join('');

        contSx.innerHTML = `
            <div style="height: 100%; display: flex; flex-direction: column; justify-content: space-between;">
                <div style="overflow-y: auto; max-height: 720px; padding-right: 0.3rem;">
                    <div class="ricetta-header-grid" style="margin-bottom: 1.2rem;">
                        ${ricetta.foto ? `<img src="${ricetta.foto}" alt="${ricetta.titolo}" class="ricetta-foto-principale" onerror="this.style.display='none'">` : ''}
                        <div class="ricetta-info-testo">
                            <div class="ricetta-meta-tags">
                                <span>Ricetta</span>
                                <div class="stelle-valutazione" title="Valuta questa ricetta">${htmlStelle}</div>
                            </div>
                            <h2>${ricetta.titolo}</h2>
                            <div style="display: flex; gap: 0.6rem; margin-top: 0.5rem; align-items: center; flex-wrap: wrap;">
                                <button onclick="avviaModalChef(${ricetta.id})" class="btn-modalita-cucina-principale">
                                    <span>▶ Modalità cucina</span>
                                </button>
                                <button onclick="apriStoricoProve(${ricetta.id})" class="btn-piccolo" style="background: rgba(212, 175, 55, 0.1); border: 1px solid var(--oro-accento); padding: 5px 10px; border-radius: 20px; font-size: 0.8rem; color: var(--testo-principale);" title="Storico prove">
                                    📊 Storico (${ricetta.prove.length})
                                </button>
                            </div>
                        </div>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--colore-bordo); padding-bottom: 0.8rem; margin-bottom: 1rem;">
                        <h4 style="color: var(--testo-principale); margin: 0; font-size: 1.1rem; font-weight: 700;">Ingredienti</h4>
                        <span style="font-size: 0.85rem; color: var(--testo-sfumato); font-weight: 600;">${righeIngredienti.length} voci</span>
                    </div>

                    <div style="background: rgba(212, 175, 55, 0.05); border: 1px solid var(--colore-bordo); border-radius: 10px; padding: 0.8rem; margin-bottom: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem;">
                            <span style="font-weight: 600; letter-spacing: 0.5px;">PORZIONI</span>
                            <div style="display: flex; align-items: center; gap: 0.8rem;">
                                <button onclick="cambiaPorzioni(${ricetta.id}, -1)" style="background: white; border: 1px solid var(--colore-bordo); width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-weight: bold;">-</button>
                                <span id="span-persone" style="font-weight: 700; font-size: 1rem;">${ricetta.persone}</span>
                                <button onclick="cambiaPorzioni(${ricetta.id}, 1)" style="background: white; border: 1px solid var(--colore-bordo); width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-weight: bold;">+</button>
                            </div>
                        </div>
                    </div>

                    <div id="testo-ingredienti">
                        ${htmlIngredienti}
                    </div>
                </div>

                <div style="display: flex; gap: 0.6rem; align-items: center; padding-top: 0.8rem; border-top: 1px solid var(--colore-bordo); margin-top: auto;">
                    <button onclick="apriModificaRicetta(${ricetta.id})" title="Modifica" style="background: white; border: 1px solid var(--colore-bordo); border-radius: 8px; padding: 6px 12px; cursor: pointer; font-size: 0.9rem;">✏️</button>
                    <button onclick="vaiAllaSpesa()" title="Lista spesa" style="background: white; border: 1px solid var(--colore-bordo); border-radius: 8px; padding: 6px 12px; cursor: pointer; font-size: 0.9rem;">🛒</button>
                    <button onclick="vaiAllIndice()" title="Indice" style="background: white; border: 1px solid var(--colore-bordo); border-radius: 8px; padding: 6px 12px; cursor: pointer; font-size: 0.9rem;">🏠</button>
                </div>
            </div>
        `;

        contDx.innerHTML = `
            <div style="height: 100%; display: flex; flex-direction: column; justify-content: space-between;">
                <div style="overflow-y: auto; max-height: 720px; padding-right: 0.3rem;">
                    <h4 style="color: var(--testo-principale); margin: 0 0 0.8rem 0; font-size: 1.1rem; font-weight: 700;">Preparazione</h4>
                    <div style="margin-bottom: 1.5rem;">
                        ${htmlPassiPreparazione}
                    </div>

                    ${htmlNoteSezione}
                </div>
            </div>
        `;

    } else {
        titoloSxHeader.textContent = "LISTA DELLA SPESA";
        titoloDxHeader.textContent = "NOTE E ACQUISTI";
        
        const pagDispari = spreadIndex * 2 + 1;
        const pagPari = pagDispari + 1;
        numPagSx.textContent = pagDispari;
        numPagDx.textContent = pagPari;

        let htmlSpesaSx = `
            <div style="height: 100%; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h4 style="color: var(--testo-principale); margin: 0; font-size: 1.1rem; font-weight: 700;">Da Acquistare</h4>
                        ${listaSpesa.length > 0 ? `<button onclick="svuotaSpesa()" class="btn-piccolo" style="color: #b83232;">Svuota Lista</button>` : ''}
                    </div>
        `;

        if (listaSpesa.length === 0) {
            htmlSpesaSx += `<p style="font-style: italic; color: var(--testo-sfumato); font-size: 0.95rem;">La lista della spesa è vuota. Clicca sui carrellini 🛒 accanto agli ingredienti.</p>`;
        } else {
            htmlSpesaSx += `<div style="max-height: 450px; overflow-y: auto; padding-right: 0.3rem;"><ul style="list-style: none; padding: 0; margin: 0;">`;
            listaSpesa.forEach((item, index) => {
                htmlSpesaSx += `
                    <li style="display: flex; align-items: center; justify-content: space-between; margin: 0.6rem 0; font-size: 1rem; ${item.comprato ? 'text-decoration: line-through; opacity: 0.4;' : ''}">
                        <label style="display: flex; align-items: center; gap: 0.8rem; cursor: pointer; flex-grow: 1;">
                            <input type="checkbox" ${item.comprato ? 'checked' : ''} onchange="toggleSpesa(${index})" style="cursor: pointer; width: 18px; height: 18px; accent-color: var(--oro-accento);">
                            <span>${item.nome}</span>
                        </label>
                        <button onclick="rimuoviDaSpesa(${index})" style="background: none; border: none; color: #b83232; cursor: pointer; font-size: 1.1rem;">×</button>
                    </li>
                `;
            });
            htmlSpesaSx += `</ul></div>`;
        }

        htmlSpesaSx += `</div></div>`;
        contSx.innerHTML = htmlSpesaSx;

        contDx.innerHTML = `
            <div style="height: 100%; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box;">
                <div style="text-align: center; margin-top: 3rem;">
                    <p style="color: var(--testo-sfumato); font-size: 1rem; font-weight: 500;">Spunta gli ingredienti man mano che li acquisti.</p>
                    <div style="font-size: 3rem; margin-top: 1rem; opacity: 0.7;">🛒</div>
                </div>

                <div style="padding-top: 0.8rem; border-top: 1px solid var(--colore-bordo); display: flex; justify-content: flex-end;">
                    <button onclick="tornaIndietroDaSpesa()" class="btn-classico" style="font-size: 0.85rem; padding: 0.5rem 1rem;">← Torna indietro</button>
                </div>
            </div>
        `;
    }
}

function aggiornaFricercaIndice(valore) {
    filtroRicercaIndice = valore;
    renderizzaLibro();
}

function inizializzaAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function avviaModalChef(idRicetta, passoIniziale = 0) {
    inizializzaAudioContext();
    fermaTuttoAllarme();
    ricettaIdCorrenteChef = idRicetta;
    
    const ricetta = ricettario.find(r => r.id === idRicetta);
    if (!ricetta) return;

    passiCorrenti = ricetta.preparazione
        .split(/(?:\r\n|\r|\n|\d+\.\s+)/)
        .map(p => p.trim())
        .filter(p => p.length > 0);

    if (passiCorrenti.length === 0) passiCorrenti = [ricetta.preparazione];

    indicePassoAttivo = passoIniziale;
    document.getElementById('chef-fs-titolo-ricetta').textContent = ricetta.titolo.toUpperCase();
    
    const modalChef = document.getElementById('modal-chef');
    const containerSfondo = document.getElementById('chef-sfondo-container');
    
    if (ricetta.foto) {
        containerSfondo.innerHTML = `
            <img src="${ricetta.foto}" class="chef-bg-sfumato" alt="Sfondo ricetta">
            <div class="chef-overlay-scuro"></div>
        `;
    } else {
        containerSfondo.innerHTML = '';
    }

    modalChef.classList.remove('hidden');
    mostraPassoChefFullscreen();
}

function avviaTimerDaPasso(idRicetta, indicePasso) {
    avviaModalChef(idRicetta, indicePasso);
    setTimeout(() => {
        const btnAvvia = document.getElementById('btn-fs-pausa') || document.querySelector('.chef-fs-btn-timer');
        if (btnAvvia && !chefTimerAttivo) {
            avviaPausaChefTimer();
        }
    }, 100);
}

function chiudiModalChef() {
    fermaTuttoAllarme();
    document.getElementById('modal-chef').classList.add('hidden');
}

function mostraPassoChefFullscreen() {
    fermaTuttoAllarme();
    const testoPasso = passiCorrenti[indicePassoAttivo];
    
    document.getElementById('chef-fs-step-indicatore').textContent = `PASSAGGIO ${indicePassoAttivo + 1} DI ${passiCorrenti.length}`;
    document.getElementById('chef-fs-testo').textContent = testoPasso;

    const containerBarre = document.getElementById('chef-fs-barre');
    containerBarre.innerHTML = passiCorrenti.map((_, idx) => `
        <div class="chef-fs-segmento ${idx <= indicePassoAttivo ? 'attivo' : ''}"></div>
    `).join('');

    const containerTimer = document.getElementById('chef-fs-timer-container');
    const matchCorretto = testoPasso.match(/(\d+)\s*(ore|ora|minuti|minuto|min|secondi|secondo|sec)/i);

    if (matchCorretto) {
        let quantita = parseInt(matchCorretto[1]);
        let unita = matchCorretto[2].toLowerCase();
        
        if (unita.startsWith('ora')) {
            chefSecondiTotali = quantita * 3600;
        } else if (unita.startsWith('min')) {
            chefSecondiTotali = quantita * 60;
        } else {
            chefSecondiTotali = quantita;
        }

        chefSecondiRimanenti = chefSecondiTotali;

        containerTimer.innerHTML = `
            <button class="chef-fs-btn-timer" onclick="avviaPausaChefTimer()">
                ⏱️ Avvia ${matchCorretto[0]}
            </button>
        `;
    } else {
        containerTimer.innerHTML = '';
    }

    document.getElementById('chef-fs-btn-prec').style.visibility = indicePassoAttivo === 0 ? 'hidden' : 'visible';
    document.getElementById('chef-fs-btn-succ').textContent = indicePassoAttivo === passiCorrenti.length - 1 ? 'Fine ✓' : 'Avanti →';
}

function passoSuccessivo() {
    fermaTuttoAllarme();
    if (indicePassoAttivo < passiCorrenti.length - 1) {
        indicePassoAttivo++;
        mostraPassoChefFullscreen();
    } else {
        chiudiModalChef();
    }
}

function passoPrecedente() {
    fermaTuttoAllarme();
    if (indicePassoAttivo > 0) {
        indicePassoAttivo--;
        mostraPassoChefFullscreen();
    }
}

function avviaPausaChefTimer() {
    inizializzaAudioContext();
    const containerTimer = document.getElementById('chef-fs-timer-container');

    if (!chefTimerAttivo) {
        chefTimerAttivo = true;
        
        containerTimer.innerHTML = `
            <div class="chef-fs-timer-attivo-box">
                <span id="chef-fs-display" class="chef-fs-timer-display">--:--</span>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="chef-fs-btn-timer" onclick="avviaPausaChefTimer()" id="btn-fs-pausa">Pausa</button>
                    <button class="chef-fs-btn-timer" onclick="azzeraChefTimerFullscreen()">Azzera</button>
                </div>
            </div>
        `;

        aggiornaDisplayChefFs();

        chefTimerInterval = setInterval(() => {
            if (chefSecondiRimanenti > 0) {
                chefSecondiRimanenti--;
                aggiornaDisplayChefFs();
            } else {
                fermaChefTimer();
                chefSecondiRimanenti = 0;
                aggiornaDisplayChefFs();
                suonaSquilloUnicoTimer();
                
                if (containerTimer) {
                    containerTimer.innerHTML = `
                        <div class="chef-fs-timer-attivo-box">
                            <span class="chef-fs-timer-display" style="color: #ff4d4d;">00:00 🔔</span>
                            <button class="chef-fs-btn-timer" onclick="azzeraChefTimerFullscreen()">Riavvia</button>
                        </div>
                    `;
                }
            }
        }, 1000);
    } else {
        chefTimerAttivo = false;
        clearInterval(chefTimerInterval);
        const btnPausa = document.getElementById('btn-fs-pausa');
        if (btnPausa) btnPausa.textContent = "Riprendi";
    }
}

function fermaChefTimer() {
    chefTimerAttivo = false;
    clearInterval(chefTimerInterval);
}

function azzeraChefTimerFullscreen() {
    fermaTuttoAllarme();
    chefSecondiRimanenti = chefSecondiTotali;
    avviaPausaChefTimer();
}

function aggiornaDisplayChefFs() {
    const min = Math.floor(chefSecondiRimanenti / 60);
    const sec = chefSecondiRimanenti % 60;
    const display = document.getElementById('chef-fs-display');
    if (display) {
        display.textContent = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    }
}

function suonaSquilloUnicoTimer() {
    try {
        inizializzaAudioContext();
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();

                osc.type = 'square';
                osc.frequency.setValueAtTime(1400, audioCtx.currentTime);
                
                gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);

                osc.connect(gain);
                gain.connect(audioCtx.destination);

                osc.start();
                osc.stop(audioCtx.currentTime + 0.12);
            }, i * 160);
        }
    } catch (e) {
        console.log("Audio non supportato");
    }
}

function fermaTuttoAllarme() {
    fermaChefTimer();
}

function aggiungiAllaSpesaSilenzioso(nomeIngrediente, btnId) {
    listaSpesa.push({ nome: nomeIngrediente, comprato: false });
    salvaDati();

    const btn = document.getElementById(btnId);
    if (btn) {
        btn.textContent = "✔";
        btn.style.color = "var(--oro-accento)";
        setTimeout(() => {
            btn.textContent = "🛒";
            btn.style.color = "initial";
        }, 1200);
    }
}

function toggleSpesa(index) {
    if (listaSpesa[index]) {
        listaSpesa[index].comprato = !listaSpesa[index].comprato;
        salvaDati();
        renderizzaLibro();
    }
}

function rimuoviDaSpesa(index) {
    listaSpesa.splice(index, 1);
    salvaDati();
    renderizzaLibro();
}

function svuotaSpesa() {
    if (confirm("Vuoi svuotare interamente la lista della spesa?")) {
        listaSpesa = [];
        salvaDati();
        renderizzaLibro();
    }
}

function vaiAllaSpesa() {
    paginaPrecedenteIndex = paginaCorrenteIndex; 
    const isMobile = window.innerWidth <= 1024;
    const targetSpread = ricettario.length + 1;
    paginaCorrenteIndex = isMobile ? targetSpread * 2 : targetSpread;
    renderizzaLibro();
}

function tornaIndietroDaSpesa() {
    paginaCorrenteIndex = paginaPrecedenteIndex; 
    renderizzaLibro();
}

function vaiAllIndice() {
    paginaCorrenteIndex = 0;
    renderizzaLibro();
}

function apriModificaRicetta(id) {
    inizializzaAudioContext();
    const ricetta = ricettario.find(r => r.id === id);
    if (!ricetta) return;

    idRicettaInModifica = id;

    document.getElementById('titolo').value = ricetta.titolo;
    document.getElementById('categoria').value = ricetta.categoria;
    document.getElementById('foto').value = ricetta.foto || '';
    document.getElementById('persone').value = ricetta.personeBase || ricetta.persone;
    document.getElementById('ingredienti').value = ricetta.ingredientiBase || ricetta.ingredienti;
    document.getElementById('preparazione').value = ricetta.preparazione;
    document.getElementById('note').value = ricetta.note || '';

    modal.querySelector('h2').textContent = "Modifica Ricetta";
    modal.classList.remove('hidden');
}

function cambiaPorzioni(id, delta) {
    const ricetta = ricettario.find(r => r.id === id);
    if (!ricetta) return;

    if (ricetta.persone + delta < 1) return;

    ricetta.persone += delta;
    const fattore = ricetta.persone / ricetta.personeBase;

    ricetta.ingredienti = ricetta.ingredientiBase.replace(/(\d+([.,]\d+)?)/g, (match) => {
        let num = parseFloat(match.replace(',', '.'));
        let scalato = num * fattore;
        return Number.isInteger(scalato) ? scalato : scalato.toFixed(1);
    });

    salvaDati();
    renderizzaLibro();
}

btnSucc.addEventListener('click', () => {
    const isMobile = window.innerWidth <= 1024;
    const maxIndex = isMobile ? (ricettario.length + 2) * 2 - 1 : ricettario.length + 1;
    if (paginaCorrenteIndex < maxIndex) {
        paginaCorrenteIndex++;
        renderizzaLibro();
    }
});

btnPrec.addEventListener('click', () => {
    if (paginaCorrenteIndex > 0) {
        paginaCorrenteIndex--;
        renderizzaLibro();
    }
});

function vaiAllaRicetta(indiceArray) {
    filtroRicercaIndice = ""; 
    const isMobile = window.innerWidth <= 1024;
    const targetSpread = indiceArray + 1;
    paginaCorrenteIndex = isMobile ? targetSpread * 2 : targetSpread;
    renderizzaLibro();
}

function eliminaRicetta(id) {
    if (confirm("Vuoi eliminare questa ricetta?")) {
        ricettario = ricettario.filter(r => r.id !== id);
        salvaDati();
        paginaCorrenteIndex = 0;
        renderizzaLibro();
    }
}