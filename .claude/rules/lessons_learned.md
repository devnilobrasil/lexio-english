# 🧠 Lições Aprendidas e Base de Conhecimento Técnico

Este documento registra erros encontrados, soluções aplicadas e aprendizados durante o desenvolvimento do projeto Lexio. Ele serve como guia para evitar reincidência de falhas e acelerar o desenvolvimento em sessões futuras.

---

## 🛠️ Erros de Sintaxe e Ambiente

### 1. Terminal Windows (PowerShell)
- **Erro:** Uso de `&&` para encadear comandos (ex: `npm run lint && npm run build`).
- **Problema:** O PowerShell no Windows não aceita `&&` como separador padrão, resultando em erro de execução.
- **Lição:** Sempre executar comandos de forma sequencial (chamadas de ferramentas separadas) ou utilizar `;` como separador.

---

*Este documento deve ser atualizado ao final de cada feature complexa.*
