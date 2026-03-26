---
name: mcp-tooling
description: Orientações de MCP para o projeto.
---

# MCP & Tooling Skill

## MCP Priority Protocol

**ALWAYS check for MCP tools BEFORE writing code.**

### Why MCP Tools Matter

- **Database Inspector** → Ensures schema accuracy (prevents bugs)
- **File Indexer** → Maps project structure (prevents file conflicts)
- **GitHub MCP** → Automates PR creation (enforces workflow)

**Golden Rule:** If an MCP tool exists that would improve task accuracy, ASK user to enable it.

---

## Available MCP Tools

### 1. Database Inspector

**Purpose:** Verify database schema, tables, columns, relationships.

**Use When:**
- Creating server actions that query database
- Writing migrations
- Implementing CRUD operations
- Debugging data-related issues

**Example Usage:**
```
Before writing Supabase query:
1. Check Database Inspector for table schema
2. Verify column names and types
3. Check relationships/foreign keys
4. Then write query with correct structure
```

**Benefits:**
- Prevents typos in column names
- Ensures correct data types
- Reveals relationships between tables
- Avoids runtime database errors

**How to Request:**
```
"To ensure schema accuracy, I recommend enabling the Database Inspector MCP tool. 
Would you like me to guide you through setup?"
```

---

### 2. File Indexer

**Purpose:** Map entire project structure, file relationships, imports.

**Use When:**
- Adding new components
- Refactoring file structure
- Understanding existing codebase
- Planning large features

**Example Usage:**
```
Before creating new component:
1. Check File Indexer for existing similar components
2. Verify import paths
3. Identify reusable utilities
4. Plan file location based on existing structure
```

**Benefits:**
- Prevents duplicate code
- Maintains consistent file structure
- Identifies reusable components
- Reduces circular dependencies

**How to Request:**
```
"For better code organization, I recommend enabling the File Indexer MCP tool.
This will help me understand your existing project structure."
```

---

### 3. GitHub MCP (CRITICAL for Git Workflow)

**Purpose:** Automate PR creation (PREFERRED METHOD).

**Use When:**
- Completing any development task (always)
- Creating feature branches
- Finalizing bug fixes

**Priority in Git Workflow:**
1. **FIRST:** Check if GitHub MCP is available
2. **IF YES:** Use it to create PR automatically
3. **IF NO:** Fall back to GitHub CLI or manual URL

**Example Usage:**
```
After pushing branch:
1. Check for github_create_pull_request tool
2. Call tool with:
   - title: Same as commit message
   - body: Changes list + testing checklist
   - base: "stage"
3. Return PR link to user
```

**Benefits:**
- Ensures consistent PR format
- Automatically targets correct base branch
- Includes proper PR template
- Faster than manual creation

**Setup Guide (if unavailable):**
```markdown
## GitHub MCP Setup

1. Generate Personal Access Token:
   https://github.com/settings/tokens
   
   Required scopes:
   - ✅ repo (Full repository access)
   - ✅ workflow (Update GitHub Actions)

2. Configure in Antigravity MCP settings:
   ```json
   {
     "mcpServers": {
       "github": {
         "command": "npx",
         "args": ["-y", "@modelcontextprotocol/server-github"],
         "env": {
           "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_your_token_here"
         }
       }
     }
   }
   ```

3. Restart Claude/Antigravity IDE

4. Verify by testing PR creation
```

---

## MCP Detection Pattern

### At Start of Task

```
STEP 1: Assess task requirements
STEP 2: Identify helpful MCP tools
STEP 3: Check if tools are available
STEP 4: If missing, inform user and offer setup help
STEP 5: Proceed with or without tools
```

### Example Workflow

```
User: "Add user authentication with Supabase"

Claude Internal Process:
1. Task requires database queries → Database Inspector would help
2. Task creates new files → File Indexer would help
3. Task will need PR → GitHub MCP would help

Claude Response:
"I'll implement user authentication. For best results, I recommend enabling:
- Database Inspector (verify auth tables)
- File Indexer (organize new files)
- GitHub MCP (automate PR creation)

Would you like setup guidance, or should I proceed with what's available?"
```

---

## MCP Tool Recommendations by Task Type

| Task Type | Recommended MCP Tools |
|-----------|----------------------|
| Database queries | Database Inspector ⭐ |
| New features | File Indexer + GitHub MCP |
| Bug fixes | GitHub MCP |
| Refactoring | File Indexer ⭐ |
| Schema changes | Database Inspector ⭐ |
| ANY code change | GitHub MCP ⭐ |

⭐ = Highly recommended (may affect accuracy)

---

## When to Ask vs. When to Proceed

### ASK for Tool Enable When:
- Tool would significantly improve accuracy
- Task involves database schema
- Large refactoring that needs structure understanding
- First time working on project

### PROCEED Without When:
- Tool is nice-to-have but not critical
- User is experienced and doesn't want interruption
- Simple, isolated task
- User has explicitly said "just do it"

---

## MCP Setup Assistance

### Database Inspector Setup
```markdown
1. Install Supabase CLI (if not installed):
   npm install -g supabase

2. Link to project:
   supabase link --project-ref your-project-ref

3. Configure MCP in Antigravity settings

4. Restart IDE
```

### File Indexer Setup
```markdown
Usually pre-configured in Antigravity IDE.

If not available:
1. Check Antigravity settings → MCP Servers
2. Verify "file-indexer" is enabled
3. Restart IDE
```

---

## Best Practices

### DO:
- ✅ Check for MCP tools at start of task
- ✅ Explain benefits when recommending tools
- ✅ Offer setup assistance
- ✅ Proceed gracefully if user declines
- ✅ Use GitHub MCP for ALL PRs when available

### DON'T:
- ❌ Assume tools are available without checking
- ❌ Block progress waiting for tool setup
- ❌ Be pushy about tool adoption
- ❌ Skip PR creation if GitHub MCP unavailable (use fallback)

---

## Validation Checklist

Before completing task:
- [ ] Checked for relevant MCP tools
- [ ] Used Database Inspector for schema queries (if available)
- [ ] Used File Indexer for structure planning (if available)
- [ ] Used GitHub MCP for PR creation (if available)
- [ ] Offered setup guidance if critical tool missing
- [ ] Proceeded efficiently regardless of tool availability

---

## Priority Level: HIGH

MCP tools significantly improve code quality and workflow efficiency.
Always check for availability, but never block progress.
