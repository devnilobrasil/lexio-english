# Lexio — Documentação Completa e Final (Single Source of Truth)

> App desktop "invisível" para aprendizado de inglês sob demanda e produtividade.  
> O documento a seguir representa com 100% de precisão o estado real e arquitetural do código-fonte, atualizado com a integração nativa à API Groq e interface expansível.

---

## 1. Princípios e Casos de Uso
O Lexio foi criado para auxiliar pessoas fluentes ou aprendizes a destrincharem palavras instantaneamente, sem quebrar sua atenção nas tarefas diárias:
1. Funciona através de atalhos globais, surgindo na tela apenas quando solicitado.
2. Faz uso de modelos poderosos em LLMs ultra-rápidos (Groq) para responder no formato exato de JSON no tempo médio de uma digitação humana rápida.
3. Não requer nuvem para cache. Tudo é armazenado no disco local do usuário, com suporte nativo a múltiplos idiomas (`Locale`).

---

## 2. Stack de Tecnologia e Arquitetura
| Camadas | Tecnologia Real Usada | Funções Críticas |
|---|---|---|
| **Motor** | **Electron v33+** | Processo Main nativo para UIAutomation e controle assíncrono das janelas (Main e Overlay). |
| **Interface** | **React 18 + Vite + TS** | Duas instâncias de renderização isoladas (Main Search e Overlay Widget) usando TailwindCSS v4. |
| **Banco de Dados**| **better-sqlite3** | Opera em `%APPDATA%\lexio\lexio.db`. Salva a tabela `words` e a tabela `settings` (chaves de API). |
| **Inteligência** | **Groq API** | Modelo exclusivo `llama-3.3-70b-versatile` exigindo flag nativa `{ type: 'json_object' }`. |
| **Injeção de SO** | **nut.js / selection-hook** | Seleção passiva do SO para texto alheio e injeção do clipboard imitando botões (`enigo` no futuro para o port). |

---

## 3. Topologia das Janelas e Atalhos

O aplicativo não possui interface com botões de fechar e maximizar clássicos do SO. Tudo é gerido por IPC events e atalhos customizados definidos no `sys > globalShortcut`.

### A. Main Window (Search Bar & Results)
A janela primária (onde reside o AppShell).
*   **Atalho:** `Ctrl + Alt + E` (Win) | `Cmd + Alt + E` (Mac).
*   **Comportamento:** Ela nasce microscópica, medindo apenas `600x60` pixels. O React processa a busca. Se achar palavra (no DB ou retornada da IA), a UI notifica o `window.lexio.resizeWindow('result')`, que estica a janela do Electron para `600x420` para mostrar o Panel de Visualização e Histórico.

### B. Overlay Window (Botão de Bolha Flutuante)
A segunda janela, servindo apenas para traduções brutas.
*   **Atalho Visibilidade:** `Ctrl + Alt + O`.
*   **Comportamento:** É uma bolinha `48x48`, invisível a cliques de propagação. Seu processo possui um Preload isolado (`overlay-preload.js`) e APIs separadas do Lexio Core. Guarda sua própria posição física do desktop num log simples `overlay-position.json` salvo em FileSystem (FS).

### C. Text-Bridge Mágica (O core de Tradução Instantânea)
*   **Atalho de Ação:** `Ctrl + Alt + T` (Global).
*   **O Pipeline:**
    1. Usuário mantém uma frase sublinhada num documento do Word e aperta o atalho.
    2. O módulo C++ passivo (`selection-hook`) entrega ao Electron o texto marcado.
    3. O arquivo nativo `src/main/translate.ts` roda o fetch HTTP direto contra a API do **Groq** usando o endpoint `/openai/v1/chat/completions`, instruindo a tradução bruta para o inglês com o Llama-3.3-70b-versatile.
    4. Ao obter a resposta, o `nut.js` reescreve a área de transferência silenciosamente, digita o atalho nativo e substitui as palavras pela versão correta em inglês no documento original.

---

## 4. O Sistema de Tipagens e APIs (TypeScript)

Baseado ponta-a-ponta no diretório `src/types/index.ts`, para que exista o contrato firme da tipagem nas rotas assíncronas do IPC.

### A Estrutura de Retorno da Inteligência Artificial (AIWordResponse)
No Lexio, uma palavra não é só traduzida, ela sofre um parser linguístico minucioso.
```typescript
export interface AIWordResponse {
  word: string;
  phonetic: string | null;
  pos: PartOfSpeech | null; // verb, noun, adjective...
  level: WordLevel | null;
  verb_forms: { infinitive: string, past: string, past_participle: string, present_participle: string, third_person: string } | null;
  meanings: Array<{
    context: string;
    meaning_en: string;
    meaning_short: string;
    meaning: string;
    examples: Array<{ en: string; translation: string }>;
  }>;
  synonyms: string[];
  antonyms: string[];
  contexts: string[];
}
```

### O Contrato IPC da Janela Principal e as Views de React
As abas do `AppShell` (Busca, Histórico, Configurações) dependem da `window.lexio`.
```typescript
interface LexioAPI {
  // Ações Principais respeitando idiomas ('pt-BR', 'es')
  getWord: (word: string, locale: Locale) => Promise<Word | null>;
  saveWord: (data: AIWordResponse, locale: Locale) => Promise<Word>;
  getHistory: (locale: Locale, limit?: number) => Promise<Word[]>;
  getSaved: (locale: Locale) => Promise<Word[]>;
  toggleSaved: (word: string) => Promise<Word>;
  
  // Ações Destrutíveis
  deleteWord: (word: string) => Promise<void>;
  removeFromHistory: (word: string) => Promise<void>;
  unsaveWord: (word: string) => Promise<void>;
  
  // Window State e Settings
  resizeWindow: (state: 'idle' | 'result') => void;
  getApiKey: () => Promise<string | null>;
  setApiKey: (key: string) => Promise<void>;
  
  // Pipeline de Atualização Nativo no Electron
  getAppVersion: () => Promise<string>;
  onUpdateAvailable: (cb: (version: string) => void) => void;
  installUpdate: () => void;
}
```

---

## 5. Locales (Suporte de Expansão Global)
As querys no `better-sqlite3` ou requests pro Groq já recebem injetados um `Locale` (definido no `useLocale`).
Hoje o Lexio contém instruções pesadas de prompt atreladas a `pt-BR` (Português Brasileiro Nativo) e `es` (Espanhol).

> Exemplo da restrição de Prompt:
> *"The meaning field must be written in natural Brazilian Portuguese, as a Brazilian would explain it to a friend — not a dictionary translation."*

---

## 6. Setup, Inicialização e Manutenção

1.  Basta instanciar um ficheiro `.env` ou abrir as Configurações do App compilado e assentar sua `API_KEY` do Groq (A key é encriptada/salva localmente e o app já irá funcionar).
2.  Rodando ativamente processos em pipeline local em dev: `npm run dev`
    *(Nota: a tag `--publish always` no electron-builder já está injetada pro pipeline final).*
