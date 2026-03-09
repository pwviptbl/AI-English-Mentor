# Changelog da Branch `codex/feature-text-interpretation`

Este arquivo resume tudo o que foi implementado nesta branch, incluindo os commits realizados e o ajuste pendente ainda nao commitado no momento desta geracao.

## Branch

- Nome: `codex/feature-text-interpretation`

## Commits da Branch

1. `b6e9866` - `Add reading comprehension feature`
2. `f6221c3` - `Add text analysis to reading practice`
3. `50e1d7c` - `Add question language option for reading practice`
4. `9da7770` - `Persist reading practice across sessions`
5. `a019341` - `Add reading progress dashboard`
6. `a61727e` - `Add light and dark theme switch`

## Resumo Funcional

### 1. Interpretacao textual com IA

- Nova experiencia de pratica de leitura com geracao automatica de:
  - titulo
  - texto
  - 4 questoes de interpretacao
- Suporte a:
  - temas sugeridos
  - tema customizado
  - nivel CEFR
  - escolha de idioma das questoes (`English` ou `Portugues`)
- Endpoint principal:
  - `POST /api/v1/reading/generate`

Arquivos principais:

- [`backend/app/api/v1/reading.py`](D:/Projetos/AI-English-Mentor/backend/app/api/v1/reading.py)
- [`backend/app/schemas/reading.py`](D:/Projetos/AI-English-Mentor/backend/app/schemas/reading.py)
- [`backend/app/services/llm_router.py`](D:/Projetos/AI-English-Mentor/backend/app/services/llm_router.py)
- [`backend/app/services/llm_types.py`](D:/Projetos/AI-English-Mentor/backend/app/services/llm_types.py)
- [`backend/app/providers/gemini_provider.py`](D:/Projetos/AI-English-Mentor/backend/app/providers/gemini_provider.py)
- [`backend/app/providers/ollama_provider.py`](D:/Projetos/AI-English-Mentor/backend/app/providers/ollama_provider.py)
- [`frontend/src/components/ReadingPracticePanel.tsx`](D:/Projetos/AI-English-Mentor/frontend/src/components/ReadingPracticePanel.tsx)
- [`frontend/src/lib/api.ts`](D:/Projetos/AI-English-Mentor/frontend/src/lib/api.ts)
- [`frontend/src/lib/types.ts`](D:/Projetos/AI-English-Mentor/frontend/src/lib/types.ts)

### 2. Analise de texto dentro da interpretacao

- A pratica de leitura ganhou o botao `Analisar texto`
- O usuario pode:
  - clicar em palavras do texto
  - ver traducao
  - ouvir pronuncia
  - adicionar a palavra ao deck
- Reaproveitamento do modal de analise usado no fluxo de conversas

Arquivos principais:

- [`backend/app/api/v1/analysis.py`](D:/Projetos/AI-English-Mentor/backend/app/api/v1/analysis.py)
- [`backend/app/schemas/analysis.py`](D:/Projetos/AI-English-Mentor/backend/app/schemas/analysis.py)
- [`frontend/src/components/AnalysisModal.tsx`](D:/Projetos/AI-English-Mentor/frontend/src/components/AnalysisModal.tsx)
- [`frontend/src/components/ReadingPracticePanel.tsx`](D:/Projetos/AI-English-Mentor/frontend/src/components/ReadingPracticePanel.tsx)

### 3. Robustez na geracao via Ollama

- Tratamento mais resiliente para respostas com JSON invalido na geracao da atividade de leitura
- Adicao de tentativas de reparo de payload antes de falhar o fluxo

Arquivos principais:

- [`backend/app/providers/ollama_provider.py`](D:/Projetos/AI-English-Mentor/backend/app/providers/ollama_provider.py)
- [`backend/app/services/llm_types.py`](D:/Projetos/AI-English-Mentor/backend/app/services/llm_types.py)

### 4. Persistencia da atividade de leitura entre sessoes

- A atividade gerada passou a permanecer disponivel apos navegar entre telas
- Persistencia mantida mesmo apos logout/login no mesmo navegador
- Protecao para evitar exibir a atividade de um usuario para outro usuario no mesmo navegador

Arquivos principais:

- [`frontend/src/store/useMentorStore.ts`](D:/Projetos/AI-English-Mentor/frontend/src/store/useMentorStore.ts)
- [`frontend/src/components/ReadingPracticePanel.tsx`](D:/Projetos/AI-English-Mentor/frontend/src/components/ReadingPracticePanel.tsx)
- [`frontend/src/lib/types.ts`](D:/Projetos/AI-English-Mentor/frontend/src/lib/types.ts)

### 5. Novo layout da pratica de leitura

- Texto com area de scroll dedicada
- Questoes exibidas uma por vez
- Navegacao com:
  - `Anterior`
  - `Proxima`
  - indicador de progresso
- Interface mais organizada para evitar a sensacao de tela "espaguete"

Arquivo principal:

- [`frontend/src/components/ReadingPracticePanel.tsx`](D:/Projetos/AI-English-Mentor/frontend/src/components/ReadingPracticePanel.tsx)

### 6. Progresso separado para palavras e interpretacao textual

- Mantido o progresso de palavras existente
- Adicionado progresso de interpretacao textual com persistencia em banco
- Novo painel de progresso com 3 visoes:
  - `Progresso de Palavras`
  - `Progresso de Interpretacao Textual`
  - `Progresso Geral`
- O progresso geral eh calculado no frontend combinando os dois blocos

Arquivos principais:

- [`backend/app/db/models.py`](D:/Projetos/AI-English-Mentor/backend/app/db/models.py)
- [`backend/alembic/versions/20260219_0006_reading_attempts.py`](D:/Projetos/AI-English-Mentor/backend/alembic/versions/20260219_0006_reading_attempts.py)
- [`backend/app/api/v1/reading.py`](D:/Projetos/AI-English-Mentor/backend/app/api/v1/reading.py)
- [`backend/app/schemas/reading.py`](D:/Projetos/AI-English-Mentor/backend/app/schemas/reading.py)
- [`frontend/src/components/ProgressDashboard.tsx`](D:/Projetos/AI-English-Mentor/frontend/src/components/ProgressDashboard.tsx)
- [`frontend/src/components/ReadingPracticePanel.tsx`](D:/Projetos/AI-English-Mentor/frontend/src/components/ReadingPracticePanel.tsx)
- [`frontend/src/lib/api.ts`](D:/Projetos/AI-English-Mentor/frontend/src/lib/api.ts)
- [`frontend/src/lib/types.ts`](D:/Projetos/AI-English-Mentor/frontend/src/lib/types.ts)

### 7. Tema claro e escuro

- Implementado switch de tema com persistencia local
- Tema disponivel:
  - antes do login
  - no header principal
  - no menu mobile
- Ajustes globais de superficie, contraste e sombras para suportar dark mode
- Refinos posteriores:
  - remocao do texto do switch
  - correcao de contraste do botao `Logout`
  - correcao do card de resumo da leitura no dark mode

Arquivos principais:

- [`frontend/src/components/ThemeToggle.tsx`](D:/Projetos/AI-English-Mentor/frontend/src/components/ThemeToggle.tsx)
- [`frontend/src/store/useMentorStore.ts`](D:/Projetos/AI-English-Mentor/frontend/src/store/useMentorStore.ts)
- [`frontend/app/page.tsx`](D:/Projetos/AI-English-Mentor/frontend/app/page.tsx)
- [`frontend/app/layout.tsx`](D:/Projetos/AI-English-Mentor/frontend/app/layout.tsx)
- [`frontend/app/globals.css`](D:/Projetos/AI-English-Mentor/frontend/app/globals.css)

## Ajuste Pendente Nao Commitado

No momento da geracao deste changelog existe uma alteracao local ainda nao commitada:

- [`backend/app/api/v1/analysis.py`](D:/Projetos/AI-English-Mentor/backend/app/api/v1/analysis.py)

Resumo do ajuste:

- O endpoint de analise de texto da interpretacao (`POST /api/v1/analysis/text`) foi alinhado para usar os mesmos limites da rotina de conversa:
  - rate limit de chat
  - limite diario de chat por plano

Impacto:

- `Gerar texto e questoes` e `Analisar texto` passam a seguir o mesmo regime de limites da conversa

## Observacoes

- O push desta branch ainda depende de permissao da conta Git autenticada na maquina
- O changelog acima descreve a branch como ela esta no workspace, nao apenas o que ja foi publicado remotamente
