// whatsapp-api/middleware/auth.js
const supabase = require('../utils/supabase');

const authMiddleware = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Nenhum token fornecido. Acesso não autorizado.' });
    }

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(403).json({ error: 'Token inválido ou expirado. Acesso proibido.' });
        }

        // Anexa o ID do usuário ao objeto da requisição para uso posterior
        req.userId = user.id;
        next();
    } catch (error) {
        return res.status(500).json({ error: 'Falha ao autenticar o token.' });
    }
};

module.exports = authMiddleware;