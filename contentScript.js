// contentScript.js - Executado na página do Intune (Settings Catalog)
// Escuta mensagens do popup e preenche automaticamente o campo
// "Allowed Extensions" do VS Code no formulário do Intune.
(function () {
    'use strict';

    /**
     * O Intune usa a abordagem "Configure values" com um editor JSON.
     * O campo é um container de texto / editor de código (geralmente um
     * <div> editável ou <pre>/<textarea> dentro de um editor monaco-like).
     * Este script tenta vários seletores comuns para localizar o editor.
     */

    const SELETORES_EDITOR = [
        'input[aria-label*="Allowed" i]',
        'input[aria-label*="Extension" i]',
        'textarea[aria-label*="Allowed" i]',
        'textarea[aria-label*="Extension" i]',
        '[role="textbox"][aria-label*="Allowed" i]',
        '[role="textbox"][aria-label*="Extension" i]',
        '.ms-CodeFile .editor',
        '.ms-TextField input',
        '.ms-TextField textarea',
        'textarea'
    ];

    function elementoVisivel(el) {
        return el.offsetParent !== null && !el.disabled && !el.readOnly;
    }

    function textoAssociado(el) {
        const labels = el.labels
            ? Array.from(el.labels, label => label.textContent).join(' ')
            : '';
        const labelledBy = (el.getAttribute('aria-labelledby') || '')
            .split(/\s+/)
            .map(id => document.getElementById(id)?.textContent || '')
            .join(' ');
        const formLabelId = (el.id || '').replace(/-for$/, '');
        const formLabel = formLabelId === el.id
            ? ''
            : document.getElementById(formLabelId)?.textContent || '';

        return [
            el.getAttribute('aria-label'),
            el.getAttribute('placeholder'),
            el.id,
            el.getAttribute('name'),
            labels,
            labelledBy,
            formLabel
        ].join(' ');
    }

    function escolherCampo(campos) {
        const ativos = campos.filter(el => elementoVisivel(el) && el.tabIndex >= 0);
        if (ativos.length) {
            return ativos.find(el => !el.value) || ativos[ativos.length - 1];
        }
        if (campos.includes(document.activeElement)) return document.activeElement;
        return campos.length === 1 && elementoVisivel(campos[0]) ? campos[0] : null;
    }

    function encontrarPainelDaConfiguracao() {
        const titulos = new Set(document.querySelectorAll('h1, h2, h3, [role="heading"]'));
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let texto;
        while ((texto = walker.nextNode())) {
            if (/^allowed\s*extensions$/i.test(texto.textContent.trim())) {
                titulos.add(texto.parentElement);
            }
        }

        for (const titulo of titulos) {
            if (!titulo || !/allowed\s*extensions/i.test(titulo.textContent.trim())) continue;

            let painel = titulo.parentElement;
            while (painel && painel !== document.body) {
                const campos = Array.from(painel.querySelectorAll(
                    'input:not([type]), input[type="text"], textarea, [role="textbox"], [contenteditable="true"]'
                ));

                if (escolherCampo(campos)) return painel;
                painel = painel.parentElement;
            }
        }

        return null;
    }

    function encontrarEditor(painel) {
        if (painel) {
            const camposDoPainel = Array.from(painel.querySelectorAll(
                'input:not([type]), input[type="text"], textarea, [role="textbox"], [contenteditable="true"]'
            ));
            const campoDoPainel = escolherCampo(camposDoPainel);
            if (campoDoPainel) return campoDoPainel;
        }

        const campos = document.querySelectorAll(
            'input, textarea, [role="textbox"], [contenteditable="true"]'
        );
        for (const el of campos) {
            if (/allowed\s*extensions|allowed|extensions?/i.test(textoAssociado(el)) && elementoVisivel(el)) {
                return el;
            }
        }

        const painelDaConfiguracao = encontrarPainelDaConfiguracao();
        if (painelDaConfiguracao) {
            const campoDoPainel = escolherCampo(Array.from(painelDaConfiguracao.querySelectorAll(
                'input:not([type]), input[type="text"], textarea, [role="textbox"], [contenteditable="true"]'
            )));
            if (campoDoPainel) return campoDoPainel;
        }

        for (const sel of SELETORES_EDITOR) {
            const el = document.querySelector(sel);
            if (el && elementoVisivel(el)) {
                return el;
            }
        }
        return null;
    }

    /**
     * Injeta texto em um elemento de forma compatível com editores
     * baseados em contenteditable / React / monaco.
     */
    function setEditorValue(el, texto) {
        if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
            const proto = el.tagName === 'TEXTAREA'
                ? HTMLTextAreaElement.prototype
                : HTMLInputElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
            setter.call(el, texto);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            // Elemento contenteditable
            el.focus();
            el.textContent = texto;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    function enviarEnter(el) {
        el.focus();
        for (const type of ['keydown', 'keypress', 'keyup']) {
            el.dispatchEvent(new KeyboardEvent(type, {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true
            }));
        }
    }

    function encontrarBotaoConfirmacao(el) {
        let container = el.parentElement;
        for (let nivel = 0; container && nivel < 5; nivel++, container = container.parentElement) {
            const botoes = Array.from(container.querySelectorAll('button, [role="button"]'))
                .filter(elementoVisivel);
            const descricao = botao => [
                botao.getAttribute('aria-label'),
                botao.getAttribute('title'),
                botao.getAttribute('data-icon-name'),
                botao.textContent,
                ...Array.from(botao.querySelectorAll('[aria-label], [title], [data-icon-name]'))
                    .flatMap(icone => [
                        icone.getAttribute('aria-label'),
                        icone.getAttribute('title'),
                        icone.getAttribute('data-icon-name')
                    ])
            ].filter(Boolean).join(' ');

            const confirmacao = botoes.find(botao =>
                /^(save|apply|confirm|accept|ok|check|commit)|check(mark)?/i.test(descricao(botao))
            );
            if (confirmacao) return confirmacao;

            const remocao = botoes.find(botao => /delete|remove|trash/i.test(descricao(botao)));
            if (remocao && botoes.length > 1) {
                return botoes.find(botao => botao !== remocao) || null;
            }
        }
        return null;
    }

    function obterCampos(painel) {
        return Array.from(painel.querySelectorAll(
            'input:not([type]), input[type="text"], textarea, [role="textbox"], [contenteditable="true"]'
        )).filter(elementoVisivel);
    }

    function aguardar(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function encontrarNovoInput(painel, idsAnteriores) {
        const campos = obterCampos(painel).filter(el => el.tabIndex >= 0);
        const novosVazios = campos.filter(el => !idsAnteriores.has(el.id) && !el.value);
        return novosVazios[novosVazios.length - 1] || null;
    }

    async function preencherPoliticas(politicas) {
        const painel = encontrarPainelDaConfiguracao();
        let editor = encontrarEditor(painel);
        if (!editor) {
            return { ok: false, error: 'Não localizei o campo AllowedExtensions. Abra essa configuração no Intune e tente novamente.' };
        }

        let aplicadas = 0;
        for (let index = 0; index < politicas.length; index++) {
            const idsAnteriores = new Set(obterCampos(painel || document.body).map(el => el.id));
            setEditorValue(editor, JSON.stringify(politicas[index], null, 2));
            const botaoConfirmacao = encontrarBotaoConfirmacao(editor);
            if (botaoConfirmacao) {
                botaoConfirmacao.click();
            } else {
                enviarEnter(editor);
            }

            await aguardar(1000);
            aplicadas++;

            if (index < politicas.length - 1) {
                editor = encontrarNovoInput(painel || document.body, idsAnteriores);
                if (!editor) {
                    return {
                        ok: false,
                        error: `Após aguardar 1 segundo, não encontrei o input da política ${index + 2}. Foram aplicadas ${aplicadas} de ${politicas.length}.`,
                        aplicadas
                    };
                }
            }
        }

        return { ok: true, aplicadas };
    }

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (!message || message.type !== 'GERAR_POLITICAS_INTUNE') {
            return;
        }

        preencherPoliticas(message.politicas || []).then(result => {
            sendResponse({
                ...result,
                message: result.ok
                    ? `${result.aplicadas} políticas preenchidas no campo "Allowed Extensions"!`
                    : undefined
            });
        }).catch(error => {
            sendResponse({ ok: false, error: 'Erro ao preencher: ' + error.message });
        });
        return true;
    });
})();