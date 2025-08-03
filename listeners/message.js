// whatsapp-api/listeners/message.js
const axios = require('axios');
require('dotenv').config();

const { SUPABASE_WEBHOOK_RESPONSES_URL, WEBHOOK_SECRET } = process.env;

const messageListener = (client, userId) => {
    client.on('message_received', async (message) => {
        if (message.isStatus || message.from === 'status@broadcast') {
            return;
        }

        console.log(`[${userId}] Mensagem recebida de ${message.from}. Enviando para webhook...`);

        const payload = {
            userId: userId, // Envia o user_id para facilitar a busca no seu backend
            phone: message.from,
            message: message.body,
            timestamp: new Date(message.timestamp * 1000).toISOString()
        };

        try {
            await axios.post(SUPABASE_WEBHOOK_RESPONSES_URL, payload, {
                headers: {
                    'Authorization': `Bearer ${WEBHOOK_SECRET}`
                }
            });
            console.log(`[${userId}] Resposta enviada ao webhook com sucesso.`);
        } catch (error) {
            console.error(`[${userId}] Erro ao enviar resposta para o webhook:`, error.response?.data || error.message);
        }
    });
};

module.exports = {
    messageListener
};