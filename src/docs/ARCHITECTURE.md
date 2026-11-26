# SeeMAP 2.0 — arquitetura inicial

## Decisões
- Cidade-piloto: Centro de Volta Redonda/RJ (área de validação a delimitar em campo).
- Clientes: WebApp responsivo e aplicativo Android.
- Frontend existente: React + TypeScript + Vite.
- Empacotamento Android planejado: Capacitor; recursos críticos de navegação podem exigir integração Android nativa.
- Backend: Supabase (Auth, PostgreSQL, PostGIS, Realtime e Edge Functions).
- Mapas de consulta: mapa leve/simplificado.
- Navegação: Google Maps Platform. No Android, avaliar Navigation SDK nativo; no WebApp, Maps JavaScript API + Routes API. Não presumir equivalência entre navegação web e Android.
- Transporte: integração VRBus somente após autorização e documentação técnica do operador/fornecedor.
- Sensores: ESP32 autenticados enviando eventos por gateway/serviço confiável; não aceitar escrita direta irrestrita do dispositivo no banco.

## Módulos de dados
- profiles: identidade e papel do usuário.
- businesses: estabelecimentos e localização geográfica.
- sensors: cadastro e estado operacional dos sensores.
- assistance_requests: chamados e confirmação de atendimento.
- sensor_events: telemetria e eventos técnicos, sem acesso público.

## Segurança ainda necessária antes de produção
1. Fluxo de convite/aprovação de comerciantes e vínculo comerciante-estabelecimento.
2. Funções Edge para aceitar/concluir chamados e ingestão de sensores.
3. Autenticação própria por dispositivo, rotação de credenciais e proteção contra replay.
4. Auditoria de acesso, retenção mínima e política de exclusão de dados.
5. Testes de RLS com usuários de cada papel; nunca confiar em papel enviado pelo cliente.
6. Monitoramento, backups, limites de uso e plano de incidentes.
7. Revisão jurídica/LGPD e avaliação de impacto de dados pessoais, especialmente localização.

## Segurança de navegação
Rotas de terceiros não garantem calçadas acessíveis, travessias seguras ou ausência de obras/obstáculos. Até validação de campo com pessoas com deficiência visual e profissionais de orientação e mobilidade, o SeeMAP deve identificar o recurso como assistivo experimental e nunca substituir bengala, cão-guia ou técnicas de mobilidade.

## Variáveis de ambiente
Copie `.env.example` para `.env` e preencha somente após criar os projetos e chaves. Nunca publique service_role keys ou segredos no frontend. A chave pública/anon do Supabase é usada com RLS habilitado; chaves de servidor ficam apenas em Edge Functions/ambiente seguro.


Nota desta entrega: schema efetivamente criado no painel usa full_name, active e pending. Autenticação implementada para teste; consulte README.md.
