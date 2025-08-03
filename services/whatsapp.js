// whatsapp-api/services/whatsapp.js
const { Client, LocalAuth } = require('whatsapp-web.js');
const { messageListener } = require('../listeners/message');

// Objeto para manter as sessões ativas em memória, associando um user_id a um client
const sessions = {};

/**
 * Cria e inicializa uma nova sessão do WhatsApp para um usuário.
 * Inclui configurações otimizadas do Puppeteer para rodar em servidores como o Render.
 * @param {string} userId - O ID único do usuário para associar à sessão.
 * @returns {Client} A instância do cliente do WhatsApp.
 */
const createSession = (userId) => {
    console.log(`[${userId}] Criando nova sessão...`);

    const client = new Client({
        // Usa LocalAuth para salvar a sessão em arquivos e permitir a restauração
        authStrategy: new LocalAuth({ clientId: userId }),

        // Configurações cruciais do Puppeteer para rodar em ambientes de servidor (Linux, Docker, etc.)
        puppeteer: {
            headless: true, // Roda o navegador em segundo plano, sem interface gráfica
            args: [
                '--no-sandbox',                // A configuração mais importante para compatibilidade com a maioria dos servidores
                '--disable-setuid-sandbox',    // Desativa uma camada de segurança que não é necessária e pode causar problemas
                '--disable-dev-shm-usage',     // Evita crashes por limitação de memória compartilhada
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',            // Tenta usar menos processos, economizando memória
                '--disable-gpu'                // Desativa a aceleração por GPU, já que o servidor não tem uma
            ],
        }
    });

    // Evento disparado quando o QR Code é gerado
    client.on('qr', (qr) => {
        console.log(`[${userId}] QR Code gerado.`);
        // Emitimos um evento personalizado para que a rota de conexão possa capturá-lo
        // e enviar o QR Code em string para o front-end.
        client.emit('qr_generated', qr);
    });

    // Evento disparado quando a autenticação é bem-sucedida
    client.on('authenticated', () => {
        console.log(`[${userId}] Autenticado com sucesso.`);
    });

    // Evento disparado quando o cliente está pronto para ser usado
    client.on('ready', () => {
        console.log(`[${userId}] Cliente está pronto e conectado!`);
        // Uma vez que o cliente está pronto, começamos a escutar por mensagens recebidas
        messageListener(client, userId);
    });

    // Evento disparado em caso de falha na autenticação
    client.on('auth_failure', (msg) => {
        console.error(`[${userId}] Falha na autenticação:`, msg);
        // Remove a sessão com falha da memória para evitar problemas
        delete sessions[userId];
    });

    // Evento disparado quando o cliente é desconectado
    client.on('disconnected', (reason) => {
        console.log(`[${userId}] Cliente foi desconectado:`, reason);
        // Remove a sessão da memória e destrói o cliente para limpar recursos
        client.destroy();
        delete sessions[userId];
    });

    // Inicializa o cliente
    client.initialize().catch(err => {
        console.error(`[${userId}] Erro na inicialização do cliente: `, err);
        delete sessions[userId];
    });

    // Armazena a instância do cliente na nossa lista de sessões ativas
    sessions[userId] = client;
    return client;
};

/**
 * Retorna uma sessão de cliente existente da memória.
 * @param {string} userId - O ID do usuário da sessão a ser recuperada.
 * @returns {Client|undefined} A instância do cliente ou undefined se não for encontrada.
 */
const getSession = (userId) => {
    return sessions[userId];
};

/**
 * Desconecta e destrói uma sessão ativa do WhatsApp.
 * @param {string} userId - O ID do usuário da sessão a ser desconectada.
 * @returns {Promise<boolean>} True se a sessão foi desconectada, false caso contrário.
 */
const disconnectSession = async (userId) => {
    const client = sessions[userId];
    if (client) {
        try {
            console.log(`[${userId}] Desconectando sessão...`);
            await client.logout(); // Tenta fazer logout da sessão no WhatsApp
        } catch (error) {
            console.error(`[${userId}] Erro durante o logout:`, error.message);
        } finally {
            try {
                await client.destroy(); // Garante que a instância do cliente seja destruída para liberar recursos
            } catch (error) {
                console.error(`[${userId}] Erro durante a destruição do cliente:`, error.message);
            }
            console.log(`[${userId}] Sessão desconectada e destruída.`);
            delete sessions[userId]; // Remove da lista de sessões ativas
        }
        return true;
    }
    return false;
};

// Exporta as funções para que possam ser usadas pelas rotas da API
module.exports = {
    createSession,
    getSession,
    disconnectSession,
};