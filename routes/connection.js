// whatsapp-api/routes/connection.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { createSession, getSession, disconnectSession } = require('../services/whatsapp');
const supabase = require('../utils/supabase'); // Usado para consultar o status persistido

// GET /whatsapp/status
router.get('/whatsapp/status', authMiddleware, async (req, res) => {
    const userId = req.userId;
    const client = getSession(userId);

    if (client) {
        const state = await client.getState().catch(() => null);
        if (state === 'CONNECTED') {
            return res.status(200).json({ status: 'connected', phone: client.info.wid.user });
        }
    }
    
    // Se não está na memória ou não está conectado, verifique o Supabase
    const { data } = await supabase.from('sessions').select('status, whatsapp_number').eq('user_id', userId).single();
    if (data && data.status === 'ready') {
        // Significa que a sessão existe mas o cliente não está ativo, precisa inicializar
        return res.status(200).json({ status: 'disconnected', message: 'Sessão existe, mas precisa ser reiniciada.' });
    }

    return res.status(200).json({ status: 'disconnected' });
});


// POST /whatsapp/initialize
router.post('/whatsapp/initialize', authMiddleware, (req, res) => {
    const userId = req.userId;
    let client = getSession(userId);
    if (!client) {
        client = createSession(userId);
    }
    
    client.once('qr_generated', (qr) => {
        return res.status(200).json({ qr_code: qr, status: 'qr_ready' });
    });

    client.getState().then(state => {
        if (state === 'CONNECTED') {
             res.status(200).json({ status: 'connected', message: 'Cliente já está conectado.' });
        }
    }).catch(() => {});

    setTimeout(() => {
        if (!res.headersSent) {
            res.status(500).json({ error: "Timeout: QR Code não foi gerado." });
        }
    }, 90000);
});

// POST /whatsapp/disconnect
router.post('/whatsapp/disconnect', authMiddleware, async (req, res) => {
    const userId = req.userId;
    const success = await disconnectSession(userId);
    if (success) {
        // Atualiza o status no Supabase
        await supabase.from('sessions').upsert({ user_id: userId, status: 'disconnected' }, { onConflict: 'user_id' });
        res.status(200).json({ success: true, message: 'Sessão desconectada.' });
    } else {
        res.status(404).json({ success: false, error: 'Nenhuma sessão ativa encontrada para este usuário.' });
    }
});

module.exports = router;