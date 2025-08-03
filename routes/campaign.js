// whatsapp-api/routes/campaign.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const authMiddleware = require('../middleware/auth');
const { getSession } = require('../services/whatsapp');
require('dotenv').config();

const { SUPABASE_WEBHOOK_MESSAGE_STATUS_URL, WEBHOOK_SECRET } = process.env;

// Helper para pausar a execução
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const formatPhoneNumber = (phone) => ('' + phone).replace(/\D/g, '') + '@c.us';

// Função que chama o webhook de status
async function callStatusWebhook(payload) {
    try {
        await axios.post(SUPABASE_WEBHOOK_MESSAGE_STATUS_URL, payload, {
            headers: { 'Authorization': `Bearer ${WEBHOOK_SECRET}` }
        });
    } catch (error) {
        console.error(`Erro ao chamar webhook de status para contactId ${payload.contactId}:`, error.response?.data || error.message);
    }
}

// Função principal que processa a campanha em background
async function processCampaign(userId, client, campaignData) {
    const { campaignId, contacts, message, intervals } = campaignData;
    const { messageInterval, batchSize, restInterval } = intervals;

    console.log(`[${userId}] Iniciando campanha ${campaignId} com ${contacts.length} contatos.`);

    for (let i = 0; i < contacts.length; i += batchSize) {
        const batch = contacts.slice(i, i + batchSize);
        console.log(`[${userId}][${campaignId}] Processando lote ${i / batchSize + 1} com ${batch.length} contatos.`);

        for (const contact of batch) {
            try {
                // Checa se o cliente ainda está conectado antes de cada envio
                const state = await client.getState();
                if (state !== 'CONNECTED') {
                    throw new Error('Cliente WhatsApp desconectado.');
                }
                
                // Envia a mensagem
                await client.sendMessage(formatPhoneNumber(contact.phone), message);

                // Notifica o sucesso via webhook
                await callStatusWebhook({ campaignId, contactId: contact.id, status: 'sent', timestamp: new Date().toISOString() });
                console.log(`[${userId}][${campaignId}] Mensagem enviada para ${contact.phone}`);

            } catch (error) {
                console.error(`[${userId}][${campaignId}] Falha ao enviar para ${contact.phone}:`, error.message);
                // Notifica a falha via webhook
                await callStatusWebhook({ campaignId, contactId: contact.id, status: 'failed', error: error.message, timestamp: new Date().toISOString() });
            } finally {
                // Aguarda o intervalo entre mensagens
                await sleep(messageInterval * 1000);
            }
        }
        
        // Descanso entre lotes (se não for o último)
        if (i + batchSize < contacts.length) {
            console.log(`[${userId}][${campaignId}] Fim do lote. Descansando por ${restInterval} minutos.`);
            await sleep(restInterval * 60 * 1000);
        }
    }
    console.log(`[${userId}] Campanha ${campaignId} finalizada.`);
    // Opcional: chamar um webhook para notificar o fim da campanha
}


// POST /whatsapp/send-campaign
router.post('/whatsapp/send-campaign', authMiddleware, async (req, res) => {
    const userId = req.userId;
    const { campaignId, contacts, message, intervals } = req.body;

    if (!campaignId || !contacts || !message || !intervals) {
        return res.status(400).json({ error: "Dados da campanha incompletos." });
    }

    const client = getSession(userId);
    if (!client) {
        return res.status(404).json({ error: "Sessão WhatsApp não encontrada." });
    }

    const state = await client.getState().catch(() => null);
    if (state !== 'CONNECTED') {
        return res.status(409).json({ error: 'Cliente WhatsApp não está conectado.' });
    }

    // Inicia o processo em background e responde imediatamente
    processCampaign(userId, client, req.body);

    res.status(202).json({ success: true, message: "O envio da campanha foi iniciado." });
});

module.exports = router;