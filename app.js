const SUPABASE_URL = 'https://bzrukvwbiofqoqavctgj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_L4SfyknPe1qIHWa5mAcf-Q_LYH7jlfI';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let ricettario = [];
let listaSpesa = [];
let paginaCorrenteIndex = 0; 
let idRicettaInModifica = null;
let idRicettaStoricoAttiva = null; 
let filtroRicercaIndice = ""; 
let ultimaPaginaPrimaDellaSpesa = 0;

let passiCorrenti = [];
let indicePassoAttivo = 0;
let chefTimerInterval = null;
let chefSecondiTotali = 0;
let chefSecondiRimanenti = 0;
let chefTimerAttivo = false;
let audioCtx = null;
let ricettaIdCorrenteChef = null;

const copertina = document.getElementById('libro-copertina');
const libroAperto = document.getElementById('libro-aperto');
const modal = document.getElementById('modal-ricetta');
const btnAnnulla = document.getElementById('btn-annulla');
const formRicetta = document.getElementById('form-ricetta');
const modalStorico = document.getElementById('modal-storico');

async function caricaDatiDaCloud() {
    try {
        const resRicette = await supabaseClient.from('ricette').select('*');
        if (resRicette.data) ricettario = resRicette.data;

        const resSpesa = await supabaseClient.from('lista_spesa').select('*');
        if (resSpesa.data) listaSpesa = resSpesa.data;

        renderizzaLibro();
    } catch (err) {
        console.error("Errore caricamento dati da Supabase:", err);
    }
}

caricaDatiDaCloud();

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

const btnChiudi = document.getElementById('btn-chiudi-libro');
if (btnChiudi) {
    btnChiudi.addEventListener('click', () => {
        libroAperto.classList.add('nascosto');
        setTimeout(() => {
            copertina.classList.remove('nascosto');
        }, 300);
    });
}

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

formRicetta.addEventListener('submit', async (e) => {
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
            ricetta.persone_base = personeIniziali;
            ricetta.ingredienti = ingredientiInseriti;
            ricetta.ingredienti_base = ingredientiInseriti;
            ricetta.preparazione = document.getElementById('preparazione').value;
            ricetta.note = document.getElementById('note').value;

            await supabaseClient
                .from('ricette')
                .update({
                    titolo: ricetta.titolo,
                    categoria: ricetta.categoria,
                    foto: ricetta.foto,
                    persone: ricetta.persone,
                    persone_base: ricetta.persone_base,
                    ingredienti: ricetta.ingredienti,
                    ingredienti_base: ricetta.ingredienti_base,
                    preparazione: ricetta.preparazione,
                    note: ricetta.note
                })
                .eq('id', ricetta.id);
        }
    } else {
        const nuovaRicetta = {
            id: Date.now(),
            titolo: document.getElementById('titolo').value,
            categoria: document.getElementById('categoria').value,
            foto: document.getElementById('foto').value,
            persone: personeIniziali,
            persone_base: personeIniziali,
            ingredienti: ingredientiInseriti,
            ingredienti_base: ingredientiInseriti,
            preparazione: document.getElementById('preparazione').value,
            note: document.getElementById('note').value,
            valutazione: 0,
            prove: []
        };
        ricettario.push(nuovaRicetta);
        
        await supabaseClient.from('ricette').insert([nuovaRicetta]);
    }

    formRicetta.reset();
    idRicettaInModifica = null;
    modal.classList.add('hidden');
    renderizzaLibro();
});

async function aggiornaRicettaCloud(ricetta) {
    await supabaseClient
        .from('ricette')
        .update({
            titolo: ricetta.titolo,
            categoria: ricetta.categoria,
            foto: ricetta.foto,
            persone: ricetta.persone,
            persone_base: ricetta.persone_base,
            ingredienti: ricetta.ingredienti,
            ingredienti_base: ricetta.ingredienti_base,
            preparazione: ricetta.preparazione,
            note: ricetta.note,
            valutazione: ricetta.valutazione,
            prove: ricetta.prove
        })
        .eq('id', ricetta.id);
    renderizzaLibro();
}

async function aggiornaSpesaCloud() {
    await supabaseClient.from('lista_spesa').delete().neq('id', 0);
    if (listaSpesa.length > 0) {
        await supabaseClient.from('lista_spesa').insert(listaSpesa);
    }
}

async function impostaValutazione(idRicetta, stelle) {
    const ricetta = ricettario.find(r => r.id === idRicetta);
    if (ricetta) {
        ricetta.valutazione = stelle;
        await aggiornaRicettaCloud(ricetta);
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

async function salvaNuovaProva(e) {
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

    await aggiornaRicettaCloud(ricetta);
    chiudiFormNuovaProva();
    renderizzaStoricoModal();
}

async function eliminaProva(idProva) {
    const ricetta = ricettario.find(r => r.id === idRicettaStoricoAttiva);
    if (!ricetta || !ricetta.prove) return;

    ricetta.prove = ricetta.prove.filter(p => p.id !== idProva);

    if (ricetta.prove.length > 0) {
        const sommaStelle = ricetta.prove.reduce((acc, p) => acc + p.stelle, 0);
        ricetta.valutazione = Math.round(sommaStelle / ricetta.prove.length);
    } else {
        ricetta.valutazione = 0;
    }

    await aggiornaRicettaCloud(ricetta);
    renderizzaStoricoModal();
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

    document.getElementById('storico-sottotitolo').innerHTML = `★ ${mediaStelle} · ${ricetta.prove.length} prove registrate`;

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

function ricalcolaIngrediente(ingredienteTesto, personeBase, personeAttuali) {
    if (!personeBase || personeBase === personeAttuali || personeBase <= 0) return ingredienteTesto;
    
    return ingredienteTesto.replace(/(\d+(?:[.,]\d+)?)/g, (match) => {
        const num = parseFloat(match.replace(',', '.'));
        if (isNaN(num)) return match;
        const proporzione = (num / personeBase) * personeAttuali;
        return Number.isInteger(proporzione) ? proporzione : proporzione.toFixed(1).replace('.0', '');
    });
}

function renderizzaLibro() {
    const titoloSxHeader = document.getElementById('titolo-sinistra-header');
    const titoloDxHeader = document.getElementById('titolo-destra-header');
    const contSx = document.getElementById('contenuto-pagina-sinistra');
    const contDx = document.getElementById('contenuto-pagina-destra');

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

    // Ordinamento rigoroso in base alle categorie dell'indice
    ricettario.sort((a, b) => {
        const idxA = categorieMapping.findIndex(c => c.id === a.categoria);
        const idxB = categorieMapping.findIndex(c => c.id === b.categoria);
        return idxA - idxB;
    });

    const isMobile = window.innerWidth <= 1024;
    const maxSpread = ricettario.length + 1;
    const maxIndex = isMobile ? (ricettario.length + 2) * 2 - 1 : maxSpread;

    let spreadIndex = paginaCorrenteIndex;
    if (isMobile) {
        spreadIndex = Math.floor(paginaCorrenteIndex / 2);
    }

    const btnPrecSx = document.getElementById('btn-prec-sx');
    const btnSuccDx = document.getElementById('btn-succ-dx');

    const gestisciIndietro = () => {
        if (paginaCorrenteIndex > 0) {
            paginaCorrenteIndex--;
            renderizzaLibro();
        }
    };

    const gestisciAvanti = () => {
        if (paginaCorrenteIndex < maxIndex) {
            paginaCorrenteIndex++;
            renderizzaLibro();
        }
    };

    if (btnPrecSx) {
        btnPrecSx.onclick = gestisciIndietro;
        btnPrecSx.style.display = paginaCorrenteIndex > 0 ? 'inline-block' : 'none';
    }

    if (btnSuccDx) {
        btnSuccDx.onclick = gestisciAvanti;
        btnSuccDx.style.display = paginaCorrenteIndex < maxIndex ? 'inline-block' : 'none';
    }

    const paginaSinistraEl = document.querySelector('.pagina-sinistra');
    const paginaDestraEl = document.querySelector('.pagina-destra');

    if (isMobile) {
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

    const numPagSxEl = document.getElementById('num-pag-sx');
    const numPagDxEl = document.getElementById('num-pag-dx');

    if (spreadIndex === 0) {
        titoloSxHeader.textContent = "INDICE GENERALE";
        titoloDxHeader.textContent = "COLLEZIONE";
        if (numPagSxEl) numPagSxEl.textContent = "1";
        if (numPagDxEl) numPagDxEl.textContent = "2";

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
                    const indiceSpreadRicetta = indiceGlobale + 1;
                    const numeroPaginaLibro = indiceSpreadRicetta * 2 + 1;
                    return `
                        <li class="voce-indice" onclick="vaiAllaRicettaIndice(${indiceSpreadRicetta})" style="display: flex; flex-direction: column; align-items: flex-start; gap: 0.3rem; padding: 0.6rem 0.5rem; border-bottom: 1px solid rgba(0,0,0,0.05); cursor: pointer;">
                            <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
                                <span style="font-weight: 600; font-size: 0.95rem;">${r.titolo}</span>
                                <span style="font-size: 0.75rem; color: var(--testo-sfumato); text-align: right; min-width: 40px;">pag. ${numeroPaginaLibro}</span>
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
                <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;" onclick="vaiAllaSpesa()">
                    <h4 style="color: var(--oro-accento); margin: 0; font-size: 1rem;">🛒 LISTA DELLA SPESA</h4>
                    <span style="font-size: 0.75rem; color: var(--testo-sfumato);">pag. ${pagListaSpesa}</span>
                </div>
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

        const catOggetto = categorieMapping.find(c => c.id === ricetta.categoria);
        const nomeCategoria = catOggetto ? catOggetto.titoloSezione.toUpperCase() : "RICETTA";

        titoloSxHeader.textContent = ricetta.titolo.toUpperCase();
        titoloDxHeader.textContent = nomeCategoria;
        
        const pagDispari = spreadIndex * 2 + 1;
        const pagPari = pagDispari + 1;
        if (numPagSxEl) numPagSxEl.textContent = pagDispari;
        if (numPagDxEl) numPagDxEl.textContent = pagPari;

        if (!ricetta.persone_base) ricetta.persone_base = ricetta.persone;
        if (!ricetta.ingredienti_base) ricetta.ingredienti_base = ricetta.ingredienti;
        if (ricetta.valutazione === undefined) ricetta.valutazione = 0;
        if (!ricetta.prove) ricetta.prove = [];

        const righeIngredientiBase = ricetta.ingredienti_base.split('\n').filter(r => r.trim() !== '');
        const htmlIngredienti = righeIngredientiBase.map((ingBase, i) => {
            const ingRicalcolato = ricalcolaIngrediente(ingBase, ricetta.persone_base, ricetta.persone);
            return `
                <div style="display: flex; justify-content: space-between; align-items: center; margin: 0.5rem 0; font-size: 0.95rem; border-bottom: 1px solid rgba(0,0,0,0.05); padding-bottom: 0.4rem;">
                    <span>• ${ingRicalcolato}</span>
                    <button id="btn-carrello-${spreadIndex}-${i}" onclick="aggiungiAllaSpesaSilenzioso('${ingRicalcolato.replace(/'/g, "\\'")}', this.id)" title="Aggiungi alla spesa" style="background: none; border: none; cursor: pointer; font-size: 1.1rem; opacity: 0.7;">🛒</button>
                </div>
            `;
        }).join('');

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
                        <span style="font-size: 0.85rem; color: var(--testo-sfumato); font-weight: 600;">${righeIngredientiBase.length} voci</span>
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
        if (numPagSxEl) numPagSxEl.textContent = pagDispari;
        if (numPagDxEl) numPagDxEl.textContent = pagPari;

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
                    <li style="display: flex; align-items: center; justify-content: space-between; margin: 0.6rem 0; font-size: 1rem;" class="${item.comprato ? 'spesa-comprata' : ''}">
                        <label class="custom-checkbox-label">
                            <input type="checkbox" ${item.comprato ? 'checked' : ''} onchange="toggleSpesa(${index})" style="display: none;">
                            <span class="custom-tick-box"></span>
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
    
    const titoloChefEl = document.getElementById('chef-fs-titolo-ricetta');
    if (titoloChefEl) titoloChefEl.textContent = ricetta.titolo.toUpperCase();

    const bgChefEl = document.getElementById('chef-bg-sfocato');
    if (bgChefEl) {
        if (ricetta.foto && ricetta.foto.trim() !== '') {
            bgChefEl.style.backgroundImage = `url('${ricetta.foto}')`;
            bgChefEl.style.display = 'block';
        } else {
            bgChefEl.style.backgroundImage = 'none';
            bgChefEl.style.display = 'none';
        }
    }

    mostraPassoChefCorrente();
    
    const modalChef = document.getElementById('modal-chef');
    if (modalChef) modalChef.classList.remove('hidden');
}

function mostraPassoChefCorrente() {
    const containerTesto = document.getElementById('chef-fs-testo');
    const indicatoreStep = document.getElementById('chef-fs-step-indicatore');
    const barraContainer = document.getElementById('chef-fs-barre');
    const btnSucc = document.getElementById('chef-fs-btn-succ');
    
    if (passiCorrenti.length > 0) {
        if (containerTesto) containerTesto.textContent = passiCorrenti[indicePassoAttivo];
        if (indicatoreStep) indicatoreStep.textContent = `PASSAGGIO ${indicePassoAttivo + 1} DI ${passiCorrenti.length}`;
    } else {
        if (containerTesto) containerTesto.textContent = "Nessun passaggio disponibile.";
        if (indicatoreStep) indicatoreStep.textContent = "PASSAGGIO 1";
    }

    if (btnSucc) {
        if (indicePassoAttivo === passiCorrenti.length - 1) {
            btnSucc.textContent = "Fine ✓";
        } else {
            btnSucc.textContent = "Avanti →";
        }
    }

    if (barraContainer) {
        barraContainer.innerHTML = passiCorrenti.map((_, idx) => `
            <div style="flex: 1; height: 4px; background: ${idx <= indicePassoAttivo ? 'var(--oro-accento)' : 'rgba(255,255,255,0.3)'}; border-radius: 2px; transition: background 0.3s;"></div>
        `).join('');
    }

    const passoTesto = passiCorrenti[indicePassoAttivo] || "";
    const matchTempo = passoTesto.match(/(\d+)\s*(ore|ora|minuti|minuto|min|secondi|secondo|sec)/i);
    
    const timerContainer = document.getElementById('chef-fs-timer-container');
    if (timerContainer) {
        if (matchTempo) {
            timerContainer.style.display = 'flex';
            impostaTimerDaMatch(matchTempo[0]);
        } else {
            timerContainer.style.display = 'none';
            fermaTuttoAllarme();
        }
    }
}

function passoPrecedente() {
    if (indicePassoAttivo > 0) {
        indicePassoAttivo--;
        fermaTuttoAllarme();
        mostraPassoChefCorrente();
    }
}

function passoSuccessivo() {
    if (indicePassoAttivo < passiCorrenti.length - 1) {
        indicePassoAttivo++;
        fermaTuttoAllarme();
        mostraPassoChefCorrente();
    } else {
        chiudiModalChef();
    }
}

function chiudiModalChef() {
    fermaTuttoAllarme();
    const modalChef = document.getElementById('modal-chef');
    if (modalChef) modalChef.classList.add('hidden');
}

function impostaTimerDaMatch(stringaTempo) {
    const numMatch = stringaTempo.match(/\d+/);
    if (!numMatch) return;
    const valore = parseInt(numMatch[0]);

    let secondi = 0;
    if (stringaTempo.toLowerCase().includes('ora') || stringaTempo.toLowerCase().includes('ore')) {
        secondi = valore * 3600;
    } else if (stringaTempo.toLowerCase().includes('min')) {
        secondi = valore * 60;
    } else {
        secondi = valore;
    }

    chefSecondiTotali = secondi;
    chefSecondiRimanenti = secondi;
    aggiornaDisplayTimer();
}

function avviaTimerDaPasso(idRicetta, indicePasso) {
    avviaModalChef(idRicetta, indicePasso);
    avviaChefTimer();
}

function avviaChefTimer() {
    if (chefTimerAttivo) return;
    if (chefSecondiRimanenti <= 0 && chefSecondiTotali > 0) {
        chefSecondiRimanenti = chefSecondiTotali;
    }
    if (chefSecondiRimanenti <= 0) return;

    chefTimerAttivo = true;
    chefTimerInterval = setInterval(() => {
        chefSecondiRimanenti--;
        aggiornaDisplayTimer();
        if (chefSecondiRimanenti <= 0) {
            fermaChefTimer();
            suonaAllarmeFineTimer();
        }
    }, 1000);
}

function pausaChefTimer() {
    chefTimerAttivo = false;
    clearInterval(chefTimerInterval);
}

function resetChefTimer() {
    fermaChefTimer();
    chefSecondiRimanenti = chefSecondiTotali;
    aggiornaDisplayTimer();
}

function fermaChefTimer() {
    chefTimerAttivo = false;
    clearInterval(chefTimerInterval);
}

function fermaTuttoAllarme() {
    fermaChefTimer();
}

function aggiornaDisplayTimer() {
    const displayEl = document.getElementById('chef-timer-display');
    if (!displayEl) return;

    const ore = Math.floor(chefSecondiRimanenti / 3600);
    const minuti = Math.floor((chefSecondiRimanenti % 3600) / 60);
    const secondi = chefSecondiRimanenti % 60;

    let testo = '';
    if (ore > 0) {
        testo = `${ore.toString().padStart(2, '0')}:${minuti.toString().padStart(2, '0')}:${secondi.toString().padStart(2, '0')}`;
    } else {
        testo = `${minuti.toString().padStart(2, '0')}:${secondi.toString().padStart(2, '0')}`;
    }
    displayEl.textContent = testo;
}

function suonaAllarmeFineTimer() {
    if (!audioCtx) return;
    try {
        let beeps = 0;
        const intervalId = setInterval(() => {
            if (beeps >= 6 || !audioCtx) {
                clearInterval(intervalId);
                return;
            }
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.15);
            beeps++;
        }, 250);
    } catch (e) {
        console.log("Audio non supportato o bloccato dal browser");
    }
}

function vaiAllaRicettaIndice(spreadIndexTarget) {
    const isMobile = window.innerWidth <= 1024;
    paginaCorrenteIndex = isMobile ? spreadIndexTarget * 2 : spreadIndexTarget;
    renderizzaLibro();
}

function vaiAllIndice() {
    paginaCorrenteIndex = 0;
    renderizzaLibro();
}

function vaiAllaSpesa() {
    ultimaPaginaPrimaDellaSpesa = paginaCorrenteIndex;
    const isMobile = window.innerWidth <= 1024;
    const spreadSpesa = ricettario.length + 1;
    paginaCorrenteIndex = isMobile ? spreadSpesa * 2 : spreadSpesa;
    renderizzaLibro();
}

function tornaIndietroDaSpesa() {
    paginaCorrenteIndex = ultimaPaginaPrimaDellaSpesa;
    renderizzaLibro();
}

async function eliminaRicetta(id) {
    if (confirm("Vuoi davvero eliminare questa ricetta?")) {
        ricettario = ricettario.filter(r => r.id !== id);
        await supabaseClient.from('ricette').delete().eq('id', id);
        paginaCorrenteIndex = 0;
        renderizzaLibro();
    }
}

function apriModificaRicetta(id) {
    const ricetta = ricettario.find(r => r.id === id);
    if (!ricetta) return;
    
    idRicettaInModifica = id;
    document.getElementById('titolo').value = ricetta.titolo;
    document.getElementById('categoria').value = ricetta.categoria;
    document.getElementById('foto').value = ricetta.foto || '';
    document.getElementById('persone').value = ricetta.persone;
    document.getElementById('ingredienti').value = ricetta.ingredienti;
    document.getElementById('preparazione').value = ricetta.preparazione;
    document.getElementById('note').value = ricetta.note || '';

    modal.querySelector('h2').textContent = "Modifica Ricetta";
    modal.classList.remove('hidden');
}

async function aggiungiAllaSpesaSilenzioso(ingrediente, btnId) {
    listaSpesa.push({ id: Date.now() + Math.random(), nome: ingrediente, comprato: false });
    await aggiornaSpesaCloud();
    const btn = document.getElementById(btnId);
    if (btn) {
        btn.textContent = "✅";
        setTimeout(() => { btn.textContent = "🛒"; }, 1500);
    }
}

function cambiaPorzioni(idRicetta, delta) {
    const ricetta = ricettario.find(r => r.id === idRicetta);
    if (!ricetta) return;
    
    ricetta.persone = Math.max(1, ricetta.persone + delta);
    const spanPersone = document.getElementById('span-persone');
    if (spanPersone) spanPersone.textContent = ricetta.persone;

    const righeIngredientiBase = ricetta.ingredienti_base.split('\n').filter(r => r.trim() !== '');
    const htmlIngredienti = righeIngredientiBase.map((ingBase, i) => {
        const ingRicalcolato = ricalcolaIngrediente(ingBase, ricetta.persone_base, ricetta.persone);
        return `
            <div style="display: flex; justify-content: space-between; align-items: center; margin: 0.5rem 0; font-size: 0.95rem; border-bottom: 1px solid rgba(0,0,0,0.05); padding-bottom: 0.4rem;">
                <span>• ${ingRicalcolato}</span>
                <button id="btn-carrello-${paginaCorrenteIndex}-${i}" onclick="aggiungiAllaSpesaSilenzioso('${ingRicalcolato.replace(/'/g, "\\'")}', this.id)" title="Aggiungi alla spesa" style="background: none; border: none; cursor: pointer; font-size: 1.1rem; opacity: 0.7;">🛒</button>
            </div>
        `;
    }).join('');

    const testoIngredientiEl = document.getElementById('testo-ingredienti');
    if (testoIngredientiEl) testoIngredientiEl.innerHTML = htmlIngredienti;
}

function toggleSpesa(index) {
    listaSpesa[index].comprato = !listaSpesa[index].comprato;
    aggiornaSpesaCloud();
    renderizzaLibro();
}

async function rimuoviDaSpesa(index) {
    listaSpesa.splice(index, 1);
    await aggiornaSpesaCloud();
    renderizzaLibro();
}

async function svuotaSpesa() {
    if (confirm("Svuotare tutta la lista della spesa?")) {
        listaSpesa = [];
        await aggiornaSpesaCloud();
        renderizzaLibro();
    }
}