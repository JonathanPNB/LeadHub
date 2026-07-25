// server.js
import express from 'express';
import { supabase } from './database/supabaseConnection.js';

const app = express();
app.use(express.json());

// Rota GET com Try/Catch
app.get('/jetimob/contatos', async (req, res) => {
  try {
    // Requisição ao Supabase
    const { data, error } = await supabase
      .from('Contatos_JetiMob')
      .select('*');

    // Verifica se o Supabase retornou um erro de banco/regra
    if (error) {
      console.error("[server.js] error.message: "+error.message);
      console.error("[server.js] error.details: "+error.details);
      return res.status(400).json({ 
        sucesso: false, 
        error: error.message,
        details: error.details
      });
    }
    
    console.log("[server.js] dados: "+data);
    // Retorno de sucesso
    res.json({ sucesso: true, dados: data });

  } catch (err) {
    // Captura erros críticos (ex: rede, crash do servidor, variáveis nulas)
    console.error('Erro interno no servidor:', err);
    res.status(500).json({ 
      sucesso: false, 
      erro: 'Erro interno no servidor ao buscar dados.' 
    });
  }
});

app.listen(process.env.APP_PORT, () => console.log('API rodando na porta '+process.env.APP_PORT));
