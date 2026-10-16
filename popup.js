// popup.js - Lógica da interface do popup
(function () {
    'use strict';

    const LIMITE_PADRAO = 1023;

    const els = {
        extensions: document.getElementById('extensions'),
        generate: document.getElementById('generate'),
        autoFill: document.getElementById('autoFill'),
        exportCsv: document.getElementById('exportCsv'),
        exportJson: document.getElementById('exportJson'),
        clear: document.getElementById('clear'),
        pretty: document.getElementById('pretty'),
        limit: document.getElementById('limit'),
        starValue: document.getElementById('starValue'),
        extValue: document.getElementById('extValue'),
        result: document.getElementById('result'),
        count: document.getElementById('count'),
        toast: document.getElementById('toast')
    };

    els.limit.value = String(LIMITE_PADRAO);

    // Políticas atualmente geradas (objetos { "*": true, ... })
    let politicasAtuais = [];

    // ---------- Utilidades ----------

    function obterApi() {
        return window.GerarPoliticaVSCode;
    }

    function mostrarToast(msg) {
        els.toast.textContent = msg;
        els.toast.classList.add('show');
        clearTimeout(mostrarToast._timer);
        mostrarToast._timer = setTimeout(() => {
            els.toast.classList.remove('show');
        }, 2200);
    }

    function escaparHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function baixarArquivo(nome, conteudo, tipo = 'text/plain') {
        const blob = new Blob([conteudo], { type: tipo });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nome;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ---------- Renderização ----------

    function formatarPolitica(politica) {
        const json = JSON.stringify(politica, null, 2);
        return json;
    }

    function lerLista() {
        return els.extensions.value.trim();
    }

    function lerOpcoes() {
        return {
            valorAsterisco: els.starValue.value === 'true',
            valorExtensao: els.extValue.value === 'true'
        };
    }

    function lerLimite() {
        const limite = Number(els.limit.value);
        if (!Number.isSafeInteger(limite) || limite < 1) {
            throw new RangeError('O limite deve ser um inteiro maior que zero.');
        }
        return limite;
    }

    function gerarPoliticas() {
        const api = obterApi();
        if (!api) {
            mostrarToast('Erro: biblioteca não carregada.');
            return {
                politicas: [],
                listaVazia: true
            };
        }

        const lista = lerLista();
        if (!lista) {
            mostrarToast('Cole a lista de extensões primeiro.');
            renderizarVazio();
            return { politicas: [], listaVazia: true };
        }

        const opcoes = lerOpcoes();
        const politicas = api.gerarPoliticas(lista, lerLimite(), opcoes);
        return { politicas, listaVazia: false };
    }

    function tornarTextoCopiado(btn) {
        const original = btn.textContent;
        btn.textContent = '✅ Copiado!';
        btn.classList.add('copied');
        setTimeout(() => {
            btn.textContent = original;
            btn.classList.remove('copied');
        }, 1500);
    }

    function renderizarResultado() {
        els.result.innerHTML = '';
        els.result.classList.remove('empty');

        politicasAtuais.forEach((politica, idx) => {
            const card = document.createElement('div');
            card.className = 'policy-card';

            const json = JSON.stringify(politica, null, 2);

            const head = document.createElement('div');
            head.className = 'policy-head';

            const title = document.createElement('span');
            title.className = 'policy-title';
            title.textContent = `Política ${idx + 1}`;

            const size = document.createElement('span');
            size.className = 'policy-size';
            size.textContent = `${json.length} caracteres`;

            head.appendChild(title);
            head.appendChild(size);

            const textarea = document.createElement('textarea');
            textarea.readOnly = true;
            textarea.value = json;
            textarea.spellcheck = false;

            const actions = document.createElement('div');
            actions.className = 'policy-actions';

            const btnCopy = document.createElement('button');
            btnCopy.textContent = '📋 Copiar JSON';
            btnCopy.addEventListener('click', () => {
                navigator.clipboard.writeText(json).then(() => {
                    tornarTextoCopiado(btnCopy);
                }).catch(() => {
                    textarea.select();
                    document.execCommand('copy');
                    tornarTextoCopiado(btnCopy);
                });
            });

            const btnExpand = document.createElement('button');
            btnExpand.textContent = '↕️ Expandir';
            btnExpand.addEventListener('click', () => {
                if (textarea.style.height === 'auto') {
                    textarea.style.height = '120px';
                    textarea.style.overflow = 'hidden';
                    btnExpand.textContent = '↕️ Expandir';
                } else {
                    textarea.style.height = 'auto';
                    btnExpand.textContent = '↕️ Recolher';
                }
            });

            actions.appendChild(btnCopy);
            actions.appendChild(btnExpand);

            card.appendChild(head);
            card.appendChild(textarea);
            card.appendChild(actions);

            els.result.appendChild(card);
        });

        els.count.textContent = politicasAtuais.length
            ? `${politicasAtuais.length} políticas geradas`
            : '';
        els.exportCsv.disabled = politicasAtuais.length === 0;
        els.exportJson.disabled = politicasAtuais.length === 0;
        els.autoFill.disabled = politicasAtuais.length === 0;
    }

    function renderizarVazio() {
        els.result.innerHTML =
            '<div class="empty">Cole a lista de extensões e clique em <strong>Gerar Políticas</strong>.</div>';
        els.result.className = 'empty';
        els.count.textContent = '';
        els.exportCsv.disabled = true;
        els.exportJson.disabled = true;
        els.autoFill.disabled = true;
        politicasAtuais = [];
    }

    // ---------- Exportação ----------

    function exportarJson() {
        const json = JSON.stringify(politicasAtuais, null, 2);
        baixarArquivo('politicas_allowdextensions.json', json, 'application/json');
        mostrarToast('JSON exportado!');
    }

    function exportarCsv() {
        // CSV com header + uma linha por política (cada célula é o JSON)
        const linhas = ['"politica","conteudo_json"'];
        politicasAtuais.forEach((p, i) => {
            const json = JSON.stringify(p);
            const escape = json.replace(/"/g, '""');
            linhas.push(`"${i + 1}","${escape}"`);
        });
        const csv = linhas.join('\r\n');
        baixarArquivo('politicas_allowdextensions.csv', csv,
            'text/csv;charset=utf-8;');
        mostrarToast('CSV exportado!');
    }

    // ---------- Auto-preenchimento (Content Script) ----------

    function autoPreencherIntune() {
        const api = obterApi();
        const opcoes = lerOpcoes();
        let politicas;
        try {
            politicas = api.gerarPoliticas(lerLista(), lerLimite(), opcoes);
        } catch (error) {
            mostrarToast(error.message);
            return;
        }

        // Envia mensagem para o content script na aba ativa.
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs && tabs[0];
            if (!tab || !tab.id) {
                mostrarToast('Nenhuma aba encontrada.');
                return;
            }

            const mensagem = {
                type: 'GERAR_POLITICAS_INTUNE',
                politicas
            };

            function enviarMensagem(retry = false) {
                chrome.tabs.sendMessage(tab.id, mensagem, (response) => {
                    if (chrome.runtime.lastError) {
                        if (retry) {
                            mostrarToast('Não consegui conectar à página do Intune. Atualize a aba e tente novamente.');
                            return;
                        }

                        chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            files: ['contentScript.js']
                        }, () => {
                            if (chrome.runtime.lastError) {
                                mostrarToast('Não consegui conectar à página do Intune. Atualize a aba e tente novamente.');
                                return;
                            }
                            enviarMensagem(true);
                        });
                    } else if (response && response.ok) {
                        mostrarToast(response.message || 'Políticas preenchidas no Intune!');
                    } else if (response && response.error) {
                        mostrarToast(response.error);
                    } else {
                        mostrarToast('Nenhuma resposta do content script.');
                    }
                });
            }

            enviarMensagem();
        });
    }

    // ---------- Eventos ----------

    els.generate.addEventListener('click', () => {
        try {
            const resultado = gerarPoliticas();
            if (resultado.listaVazia) return;
            politicasAtuais = resultado.politicas;
            renderizarResultado();
            mostrarToast(`${politicasAtuais.length} políticas geradas!`);
        } catch (error) {
            politicasAtuais = [];
            renderizarVazio();
            els.result.textContent = error.message;
            mostrarToast(error.message);
        }
    });

    els.autoFill.addEventListener('click', autoPreencherIntune);

    els.exportJson.addEventListener('click', exportarJson);
    els.exportCsv.addEventListener('click', exportarCsv);

    els.clear.addEventListener('click', () => {
        els.extensions.value = '';
        renderizarVazio();
    });

    // Gera também ao pressionar Ctrl+Enter dentro do textarea
    els.extensions.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            els.generate.click();
        }
    });

    renderizarVazio();
})();