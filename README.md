# SeeMAP 2.0 — etapa de autenticação

Projeto WebApp React + TypeScript + Vite. Protótipo de pesquisa e navegação; **não usar para deslocamentos reais**. GPS desativado nesta entrega para não misturar posição real e destinos fictícios. Mapas Google, VRBus, Android nativo, ESP32 e assistência real ainda não estão integrados.

## Banco existente
Esta entrega foi adaptada ao SQL executado no painel Supabase durante o atendimento (`profiles.full_name`, `businesses.active`, status `pending`). Não execute a migração 001 do ZIP anterior: ela usava uma estrutura incompatível. O banco não deve ser recriado. O arquivo `supabase/verify.sql` é somente leitura. O arquivo `supabase/migrations/002_profile_permissions.sql` reforça as permissões do perfil; execute no SQL Editor do projeto SeeMAP antes de testar. O cadastro usa o gatilho `on_auth_user_created` já criado. O papel de usuário vem da tabela, não da interface. Painéis administrativos continuam demonstrativos; operações reais de comerciantes não foram implementadas.

## Publicar para teste
1. Extraia o ZIP. Use a pasta `seemap` como raiz do projeto (package.json deve estar na raiz selecionada). Atualize os arquivos do repositório GitHub conectado ao Vercel, sem enviar .env nem segredos.
2. No Vercel, Settings > Environment Variables, crie `VITE_SUPABASE_URL` com a Project URL e `VITE_SUPABASE_PUBLISHABLE_KEY` com a chave sb_publishable_. Não use service_role, senha ou sb_secret_.
3. Configure Vite (build `npm run build`, saída `dist`) e faça novo deploy do commit atualizado. O redeploy de um commit antigo não atualiza o código.
4. No Supabase, Authentication > URL Configuration: Site URL = endereço HTTPS estável do app; Redirect URLs = o mesmo endereço com `/` final. Mantenha a confirmação de e-mail habilitada para testes e confira as limitações de envio do Supabase.
5. Teste com uma conta de teste autorizada: cadastro, confirmação do e-mail, login, recarregar, logout, recuperação de senha; confirme que o perfil tem role user e que outras contas não podem ler nem modificar esse perfil. Não use dados de pessoas reais na fase de validação.

## Local (opcional)
`npm install`, copie `.env.example` para `.env.local` e preencha apenas as duas variáveis públicas; `npm run dev`. Se usar localhost, autorize a URL correspondente no Supabase. `npm run build` para compilar.

## Estado de validação
Sintaxe TS/TSX verificada por parser TypeScript. A instalação de dependências não terminou neste ambiente, então não houve build completo, execução em navegador, teste de segurança integrado nem teste contra o Supabase real. Esta versão é candidata a testes, não produção. Não publique para uso de mobilidade real até validar rotas, acessibilidade e segurança em campo com profissionais e usuários.

## Laboratório Google Maps (fase de testes)
- Use `VITE_GOOGLE_MAPS_API_KEY` no Vercel, além das duas variáveis Supabase existentes. Não comite chaves.
- A Maps Demo Key destina-se exclusivamente a prototipagem/testes; não ofereça o laboratório como serviço público. Restrinja acesso a testadores autorizados, confira os termos e restrições do Google. O ambiente Vercel chamado Production não equivale a autorização de uso comercial/operacional.
- Em Encontrar destino/Navegação: mapa real, busca manual por locais em Volta Redonda, autorização explícita de localização, prévia de rota a pé com origem fixa ou posição estimada. A leitura do GPS não é armazenada; a posição é descartada ao sair do mapa. Sem rastreamento de trajeto ou instrução de navegação ativa. Mapa, Places e Routes precisam ser testados com a chave real; a cota demo pode limitar chamadas.
- Teste parado, com permissão concedida/negada, GPS desligado, erro de API e pesquisa sem resultados. Nunca use o protótipo para orientar deslocamentos reais; validação com especialistas em orientação e mobilidade e usuários, auditoria de acessibilidade de percursos e requisitos de privacidade são necessárias antes de pilotos reais.
- Módulos de ônibus e sensores permanecem demonstrativos, sem integração VRBus/ESP32.
