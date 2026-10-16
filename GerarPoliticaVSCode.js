/**
 * Gera políticas de "Allowed Extensions" do VS Code no formato exigido
 * pelo Intune Settings Catalog.
 *
 * Formato aceito pela Microsoft:
 * {
 *   "setting_definition_id": "com.microsoft.visualstudio_code.allowedExtensions",
 *   "setting_instance": [
 *     { "setting_name": "*", "value": true },
 *     { "setting_name": "ms-python.python", "value": false }
 *   ]
 * }
 *
 * Cada bloco de política é dividido em até `limite` caracteres.
 */

const INTELLIGENT_NAMESPACE_ID = 'com.microsoft.visualstudio_code.allowedExtensions';

/**
 * Divide a lista de extensões em blocos de políticas.
 * @param {string} listaExtensoes Lista de extensões (uma por linha).
 * @param {number} limite Tamanho máximo (em caracteres) de cada política.
 * @param {object} opcoes Configurações opcionais de valores.
 * @param {boolean} opcoes.valorAsterisco Valor para a chave "*" (padrão: true).
 * @param {boolean} opcoes.valorExtensao Valor padrão para cada extensão (padrão: false).
 * @returns {Array<Object>} Array de objetos { "*": <valorAsterisco>, "ext": <valorExtensao> }.
 */
function gerarPoliticas(listaExtensoes, limite = 1023, opcoes = {}) {
    const valorAsterisco = opcoes.valorAsterisco !== undefined
        ? opcoes.valorAsterisco
        : true;
    const valorExtensao = opcoes.valorExtensao !== undefined
        ? opcoes.valorExtensao
        : false;

    const extensoes = listaExtensoes
        .split(/\r?\n/)
        .map(x => x.trim())
        .filter(Boolean);

    const politicas = [];
    let atual = { '*': valorAsterisco };

    for (const ext of extensoes) {
        let teste = { ...atual, [ext]: valorExtensao };

        if (JSON.stringify(teste, null, 2).length > limite) {
            if (Object.keys(atual).length === 1) {
                throw new RangeError(`A extensão "${ext}" não cabe no limite de ${limite} caracteres.`);
            }

            politicas.push(atual);
            atual = { '*': valorAsterisco };
            teste = { ...atual, [ext]: valorExtensao };

            if (JSON.stringify(teste, null, 2).length > limite) {
                throw new RangeError(`A extensão "${ext}" não cabe no limite de ${limite} caracteres.`);
            }
        }

        atual[ext] = valorExtensao;
    }

    if (Object.keys(atual).length > 1) {
        politicas.push(atual);
    }

    return politicas;
}

/**
 * Converte o objeto de política no formato JSON aceito pela API de
 * configuração do VS Code no Intune.
 * @param {Object} politica Objeto { "*": true, "ext": false }.
 * @returns {string} JSON formatado com prefixo de namespace.
 */
function politicaParaJsonIntune(politica) {
    const settingInstance = Object.entries(politica).map(([settingName, value]) => ({
        setting_name: settingName,
        value: value
    }));

    const payload = {
        setting_definition_id: INTELLIGENT_NAMESPACE_ID,
        setting_instance: settingInstance
    };

    return JSON.stringify(payload, null, 2);
}

/**
 * Gera os JSONs completos (formato Intune) a partir da lista de extensões.
 * @param {string} listaExtensoes Lista de extensões (uma por linha).
 * @param {number} limite Tamanho máximo de cada bloco.
 * @returns {Array<string>} Array de strings JSON formatadas.
 */
function gerarPoliticasIntune(listaExtensoes, limite = 1023) {
    return gerarPoliticas(listaExtensoes, limite).map(politicaParaJsonIntune);
}

// Expoe para uso em outros contextos (popup.js, content script, testes).
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        gerarPoliticas,
        gerarPoliticasIntune,
        politicaParaJsonIntune,
        INTELLIGENT_NAMESPACE_ID
    };
} else if (typeof window !== 'undefined') {
    window.GerarPoliticaVSCode = {
        gerarPoliticas,
        gerarPoliticasIntune,
        politicaParaJsonIntune,
        INTELLIGENT_NAMESPACE_ID
    };
}