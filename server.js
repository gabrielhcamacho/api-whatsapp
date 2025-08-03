// whatsapp-api/server.js
require('dotenv').config();
const express = require('express');

// Importação das novas rotas
const connectionRoutes = require('./routes/connection');
const campaignRoutes = require('./routes/campaign');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rotas da API com o prefixo /whatsapp
app.use('/whatsapp', connectionRoutes);
app.use('/whatsapp', campaignRoutes);

app.get('/', (req, res) => {
    res.send('API de Marketing WhatsApp está rodando!');
});

app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});