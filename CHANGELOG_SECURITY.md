# CHANGELOG SECURITY - CONDEVOTE

Este documento registra todas as alterações de segurança, conformidade com a LGPD e hardening arquitetural efetuadas no código-fonte do sistema CondeVote. Todas as alterações preservam integralmente as regras de negócio originais, os fluxos de assembleia e o cálculo de votos.

---

## [1.1.0] - 2026-07-10

### 🔒 Hardening de Headers HTTP (Segurança do Navegador)
* **Arquivo alterado**: `/vercel.json`
* **Implementação**:
  - Adicionado cabeçalho `Content-Security-Policy` (CSP) estrito para limitar fontes de execução de scripts, conexões de dados e frames exclusivamente para domínios legítimos do CondeVote e subdomínios autorizados do Firebase (`*.firebaseio.com`, `*.googleapis.com`, `*.firebaseapp.com`, `*.firebasestorage.app`, `*.gstatic.com`).
  - Ativado `Strict-Transport-Security` (HSTS) com `max-age=31536000`, `includeSubDomains` e `preload` para forçar tráfego TLS em todo o ecossistema.
  - Adicionado `X-Content-Type-Options: nosniff` para bloquear ataques de MIME Sniffing.
  - Adicionado `Referrer-Policy: strict-origin-when-cross-origin` para impedir o vazamento de caminhos e parâmetros em requisições de terceiros.
  - Adicionado `Permissions-Policy` configurando controle granular para travar permissões do navegador (liberando `camera` estritamente para o fluxo de uploads/selfies de check-in, enquanto bloqueia microfone e geolocalização por padrão).

### 🛡️ Validação Rigorosa de Formulários Administrativos (OWASP Top 10)
* **Arquivo alterado**: `/components/Users.tsx`
* **Implementação**:
  - Implementada sanitização com remoção ativa de espaços em branco (trim) e conversão para caixa baixa automática nos campos de login de administradores.
  - Adicionada validação de regex restrita (`/^[a-z0-9._-]+$/`) no campo de nome de usuário para blindar contra Injeções de HTML, XSS e manipulações de caminhos de arquivos/documentos no banco de dados.
  - Aplicados limites rígidos de tamanho máximo em tempo real em todas as entradas de criação e edição (`name` <= 100 caracteres, `username` <= 50, `password` <= 50, `jobTitle` <= 50) para mitigar potenciais ataques de negação de serviço (DoS) por sobrecarga de buffers.
  - Estabelecida obrigatoriedade de comprimento mínimo de 6 caracteres para senhas de novos usuários.

### 👥 Validação e Defesa de Caminhos de Moradores (Zero-Trust)
* **Arquivo alterado**: `/services/dataService.ts`
* **Implementação**:
  - Introduzida verificação de formato e tamanho nos identificadores de assembleia (`assemblyId` <= 128 caracteres, validado contra a regex `/^[a-zA-Z0-9_ \-]+$/`) antes de qualquer consulta ao Firestore, neutralizando injeções NoSQL ou vazamento de escopo por caminhos falsificados.
  - Adicionadas validações de comprimento máximo nas consultas de unidade (`unit` <= 64 caracteres) e senha de acesso (`passwordPart` <= 64 caracteres).
  - Sanitizado o parâmetro de entrada de CPF (`cpfPart`) para conter apenas dígitos numéricos e limitar o comprimento ao máximo de 11 posições.

### 👁️ Mascaramento Dinâmico de PII e Log Seguro (LGPD & OWASP ASVS)
* **Arquivo alterado**: `/services/dataService.ts`
* **Implementação**:
  - Criada a função utilitária global `maskSensitiveData` capaz de identificar e mascarar dados pessoais sensíveis em strings ou logs serializados:
    - **CPFs**: Convertidos para o formato `123.***.***-**` garantindo total anonimização em logs.
    - **E-mails**: Reduzidos a iniciais com máscara central para evitar raspagem e proteger a privacidade do morador (ex: `wa*******@domain.com`).
    - **Credenciais**: Varredura por expressões regulares para substituir qualquer ocorrência de chaves de acesso, senhas administrativas, senhas de moradores (`accessPassword`), segredos e tokens por `"********"`.
  - Integrado o mascaramento diretamente na serialização segura de objetos em `safeStringify` e no coletor central de erros de banco de dados em `handleFirestoreError`.
  - Aplicada a filtragem de dados na função de auditoria local `addLog` para assegurar que detalhes descritivos de ações dos operadores nunca contenham informações cruas sob escopo da LGPD.

---

### RESULTADO DO HARDENING
* **Compilação do Sistema**: 100% Funcional e estável.
* **Impacto**: Nenhuma alteração nas regras jurídicas de votação, cálculo de frações ideais ou quóruns. A integridade estrutural e privacidade foram elevadas ao estado da arte em conformidade regulatória.
