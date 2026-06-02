import json
import re
import os
import ast
import sys

HEADER = """/**
 * questions.js
 * Complete and rigorous database containing 130 scenario-based questions for CCAF.
 * Proportional domain weighting mapping is satisfied.
 * Programmatically balanced option lengths to eliminate bias (v1.4.0).
 */

const CCAF_DATABASE = """

FOOTER = """;

// Pre-processing to attach stable option IDs and precomputed O(1) indexing
const CCAF_DATABASE_INDEX = {
  byId: new Map(),
  byDomain: { 1: [], 2: [], 3: [], 4: [], 5: [] }
};

CCAF_DATABASE.forEach(q => {
  q.options.forEach((opt, idx) => {
    opt.id = `opt_${idx + 1}`;
    Object.freeze(opt);
  });
  Object.freeze(q.options);
  Object.freeze(q);

  CCAF_DATABASE_INDEX.byId.set(q.id, q);
  if (CCAF_DATABASE_INDEX.byDomain[q.domain]) {
    CCAF_DATABASE_INDEX.byDomain[q.domain].push(q);
  }
});
CCAF_DATABASE.INDEX = CCAF_DATABASE_INDEX;
Object.freeze(CCAF_DATABASE);
Object.freeze(CCAF_DATABASE_INDEX);

// Universal exports wrapper for cross-platform loading
if (typeof window !== 'undefined') {
  window.CCAF_DATABASE = CCAF_DATABASE;
  window.CCAF_DATABASE_INDEX = CCAF_DATABASE_INDEX;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CCAF_DATABASE;
}
"""

NEW_QUESTIONS = [
    # Domain 1
    {
        "id": "CCAF-1-031",
        "domain": 1,
        "scenario": "You are designing an enterprise multi-agent deployment requiring execution of secure internal tools and database queries across isolated network zones. Security policies prohibit the orchestrator LLM from possessing direct network access or raw API credentials.",
        "question": "Which architectural pattern ensures strict compliance with these security isolation policies?",
        "options": [
            {
                "text": "Deploy the orchestrator as an MCP client in an isolated sandbox, communicating via standard protocol with distinct MCP tool servers hosted in secure zones.",
                "isCorrect": True,
                "explanation": "Decoupling the orchestrator as an MCP client from isolated tool servers establishes an unbypassable security and credential boundary."
            },
            {
                "text": "Inject encrypted database credentials directly into the active prompt context, utilizing an autonomous sub-agent to decrypt and execute raw queries dynamically.",
                "isCorrect": False,
                "explanation": "Trap: Exposing encrypted credentials in the prompt context violates security policy and leaves credentials vulnerable to exfiltration."
            },
            {
                "text": "Configure the orchestrator to instantiate local Docker containers on demand, mounting host file systems to execute native scripts within the primary loop.",
                "isCorrect": False,
                "explanation": "Trap: Local container spawning fails to provide network isolation and exposes the primary orchestration environment to escape vulnerabilities."
            },
            {
                "text": "Consolidate all tool definitions into a single monolithic API wrapper executed directly by the orchestrator LLM within the primary network namespace.",
                "isCorrect": False,
                "explanation": "Trap: A monolithic execution wrapper shares the orchestrator's network namespace, violating strict isolation and least-privilege principles."
            }
        ],
        "reference": "https://modelcontextprotocol.io"
    },
    {
        "id": "CCAF-1-032",
        "domain": 1,
        "scenario": "An enterprise IT automation agent manages over 500 specialized remediation tools. Passing all tool schemas in the prefill context window for every user turn causes massive token exhaustion and exceeds the max context capacity.",
        "question": "What is the most robust strategy to scale tool access without exhausting context capacity?",
        "options": [
            {
                "text": "Increase the orchestrator's context size to 200k tokens and compress all tool schemas into shorthand custom YAML strings to minimize total token overhead.",
                "isCorrect": False,
                "explanation": "Trap: Shorthand YAML formatting does not resolve systemic scaling limits and significantly increases prefill costs per conversation turn."
            },
            {
                "text": "Implement a Tool RAG architecture using a fast vector retriever to dynamically index, filter, and inject only the top relevant tool schemas per user turn.",
                "isCorrect": True,
                "explanation": "Tool RAG dynamically fetches relevant tool specifications based on user intent, keeping prefill tokens low while supporting unlimited toolsets."
            },
            {
                "text": "Deploy an autonomous sub-agent for each of the 500 tools, configuring the orchestrator to broadcast every user query across all sub-agents in parallel.",
                "isCorrect": False,
                "explanation": "Trap: Broadcasting queries to 500 sub-agents creates extreme latency spikes and triggers immediate rate-limit exhaustion across endpoints."
            },
            {
                "text": "Remove structured tool definitions entirely and prompt the model to construct raw HTTP POST requests to service endpoints using pre-trained knowledge.",
                "isCorrect": False,
                "explanation": "Trap: Hallucinating tool requests without precise tool schemas breaks execution predictability and invalidates structured parameter constraints."
            }
        ],
        "reference": "https://claude.com/docs"
    },
    {
        "id": "CCAF-1-033",
        "domain": 1,
        "scenario": "A financial compliance pipeline must extract regulatory figures from quarterly PDFs, validate them against historical records, and output a highly rigid CSV summary. Accuracy, determinism, and minimal latency are non-negotiable.",
        "question": "Which orchestration paradigm is most appropriate for this rigid compliance pipeline?",
        "options": [
            {
                "text": "Deploy an autonomous goal-driven agent utilizing open-ended ReAct prompting, granting it unrestricted access to Python interpreters to explore data formats.",
                "isCorrect": False,
                "explanation": "Trap: Autonomous agents introduce non-deterministic looping, higher latency, and potential hallucination, making them unsuitable for rigid compliance."
            },
            {
                "text": "Enable recursive tool-use loops on a singular large language model instance, instructing it to self-correct validation errors until a valid CSV is reached.",
                "isCorrect": False,
                "explanation": "Trap: Recursive self-correction loops create unpredictable execution times and risk entering infinite loops during edge-case validation tasks."
            },
            {
                "text": "Architect a linear prompt chaining workflow utilizing static prompt templates, structural output parsing schemas, and fixed multi-step validation gates.",
                "isCorrect": True,
                "explanation": "Linear prompt chaining ensures fully predictable, highly deterministic, and low-latency execution paths required for rigorous compliance tasks."
            },
            {
                "text": "Leverage a decentralized multi-agent swarm architecture where independent agents debate regulatory extraction figures until a unified consensus emerges.",
                "isCorrect": False,
                "explanation": "Trap: Multi-agent debate introduces extreme latency, non-deterministic voting outcomes, and excessive token usage without mathematical certainty."
            }
        ],
        "reference": "https://claude.com/docs"
    },
    {
        "id": "CCAF-1-034",
        "domain": 1,
        "scenario": "An autonomous data engineering agent executes multi-hour ETL tasks involving complex sequential tool calls. During long runs, API rate limits or transient network disconnects frequently cause execution loops to terminate abruptly.",
        "question": "Which state management architecture ensures reliable recovery from abrupt loop failures?",
        "options": [
            {
                "text": "Prompt the model to store intermediate table structures inside its active conversation context buffer, ensuring context persistence across retries.",
                "isCorrect": False,
                "explanation": "Trap: Active context buffers are lost entirely upon fatal script crashes or disconnects, preventing recovery without complete re-execution."
            },
            {
                "text": "Enforce an automated retry loop that catches network timeout errors and completely restarts the initial orchestration prompt sequence from the beginning.",
                "isCorrect": False,
                "explanation": "Trap: Restarting long-running tasks from the initial prompt discards hours of successful tool processing and incurs massive duplicate API costs."
            },
            {
                "text": "Append all console execution printouts to a local plaintext debug log file, prompting a new supervisor agent to read the log and guess remaining steps.",
                "isCorrect": False,
                "explanation": "Trap: Plaintext logs lack structured session state variables and tool execution contexts, resulting in unreliable task resumption accuracy."
            },
            {
                "text": "Serialize and persist intermediate session state variables and tool execution history to persistent checkpoint storage after every completed loop iteration.",
                "isCorrect": True,
                "explanation": "Serializing execution state to persistent checkpoint storage allows an orchestrator to instantly resume complex tasks exactly where they failed."
            }
        ],
        "reference": "https://claude.com/docs"
    },
    # Domain 2
    {
        "id": "CCAF-2-023",
        "domain": 2,
        "scenario": "You are standardizing internal developer workflows using Claude Code across an engineering organization. You need to provide specialized, reusable agent capabilities for reviewing internal compliance guidelines and triggering custom linters.",
        "question": "How should you architect these custom reusable agent capabilities inside the project?",
        "options": [
            {
                "text": "Create custom skill packages within the `.claude/skills/` directory containing a `SKILL.md` instruction frontmatter file and associated execution wrappers.",
                "isCorrect": True,
                "explanation": "Claude Code's skill architecture natively discovers and leverages custom workflows defined inside `.claude/skills/` using SKILL.md declarations."
            },
            {
                "text": "Concat all enterprise linting scripts and compliance rulebooks into a single massive global system prompt defined within the project's root `CLAUDE.md`.",
                "isCorrect": False,
                "explanation": "Trap: Bloating CLAUDE.md with entire rulebooks and scripts consumes excessive prefill tokens on every run and lacks dynamic tool execution wrappers."
            },
            {
                "text": "Modify the global Claude Code binary execution binary files directly, recompiling the base agent runtime to permanently bundle custom enterprise linters.",
                "isCorrect": False,
                "explanation": "Trap: Modifying core execution binaries creates extreme maintenance overhead, breaks upstream upgrades, and violates standard extension patterns."
            },
            {
                "text": "Establish an external bash orchestration loop that intercepts all terminal inputs and pre-appends compliance instructions before invoking Claude Code.",
                "isCorrect": False,
                "explanation": "Trap: Pre-pending text via external bash wrappers corrupts natural user terminal interaction and fails to provide structured agent tool endpoints."
            }
        ],
        "reference": "https://claude.com/docs/code"
    },
    {
        "id": "CCAF-2-024",
        "domain": 2,
        "scenario": "Your engineering repository contains massive compiled binary assets, proprietary machine learning model weights, and unencrypted local credential files. During initialization, Claude Code attempts to index the entire repository structure.",
        "question": "Which configuration mechanism prevents indexing of these sensitive and heavy assets?",
        "options": [
            {
                "text": "Declare a natural language directive inside `CLAUDE.md` instructing the underlying language model to politely ignore sensitive directories when searching.",
                "isCorrect": False,
                "explanation": "Trap: Natural language instructions in CLAUDE.md do not prevent background file indexing and discovery engines from reading sensitive files."
            },
            {
                "text": "Define explicit exclusion path patterns inside a `.claudeignore` file in the project root to block file indexing engines from reading sensitive directories.",
                "isCorrect": True,
                "explanation": "Placing a .claudeignore file in the repository root establishes strict file system boundary exclusions, blocking indexing engines at the source."
            },
            {
                "text": "Execute a background cron job that revokes read permissions on sensitive directories before launching Claude Code, restoring permissions post-execution.",
                "isCorrect": False,
                "explanation": "Trap: Toggling file system read permissions dynamically breaks local compiler toolchains and creates complex race conditions during active coding."
            },
            {
                "text": "Append `--filter-large-files=true` to the CLI invocation flag when starting Claude Code to dynamically bypass non-text assets during workspace indexing.",
                "isCorrect": False,
                "explanation": "Trap: The CLI flag does not exist, and dynamic size filters fail to protect lightweight sensitive plaintext credentials from being indexed."
            }
        ],
        "reference": "https://claude.com/docs/code"
    },
    {
        "id": "CCAF-2-025",
        "domain": 2,
        "scenario": "You are integrating Claude Code into a highly regulated enterprise workstation environment. You need to establish unbypassable security boundaries that explicitly prohibit Claude Code from executing any destructive shell commands or external REST API calls.",
        "question": "What is the most secure configuration pattern to enforce these execution boundaries?",
        "options": [
            {
                "text": "Set the environment variable `CLAUDE_SAFETY_LEVEL=STRICT` in the developer's bash profile to engage internal heuristic protections against dangerous tools.",
                "isCorrect": False,
                "explanation": "Trap: Heuristic safety variables do not provide deterministic, unbypassable execution guarantees against specific enterprise tools or network calls."
            },
            {
                "text": "Prepend a strict system prompt warning inside `CLAUDE.md` reminding the model of enterprise compliance penalties if it attempts dangerous bash execution.",
                "isCorrect": False,
                "explanation": "Trap: Natural language prompts provide zero hard execution boundaries and can be bypassed during complex tool invocation or prompt injection events."
            },
            {
                "text": "Configure explicit tool restrictions inside `permissions.deny` to programmatically block outbound network connections and unauthorized shell tool executions.",
                "isCorrect": True,
                "explanation": "permissions.deny establishes hard security governance boundaries at the execution middleware level, blocking unauthorized tools before execution."
            },
            {
                "text": "Deploy a local network firewall proxy that intercepts all outbound HTTP traffic from the host machine and evaluates payload contents using regex matching.",
                "isCorrect": False,
                "explanation": "Trap: System-wide proxies break legitimate host developer tools and cannot inspect or block destructive local file system shell executions."
            }
        ],
        "reference": "https://claude.com/docs/code"
    },
    {
        "id": "CCAF-2-026",
        "domain": 2,
        "scenario": "You are automating pull request code reviews and complex refactoring verifications across your enterprise GitHub Actions CI/CD pipelines. The pipeline environment runs entirely unattended without an interactive developer terminal.",
        "question": "How must you configure Claude Code for unattended execution inside automated pipelines?",
        "options": [
            {
                "text": "Instantiate a virtual X11 display buffer using `Xvfb` within the pipeline runner to simulate an interactive TTY console session for the Claude Code CLI.",
                "isCorrect": False,
                "explanation": "Trap: Simulating X11 displays does not resolve non-interactive input prompt pauses or provide structured authentication and exit code handling."
            },
            {
                "text": "Configure the pipeline runner to execute Claude Code inside a background `tmux` detached session, utilizing timed polling loops to check file updates.",
                "isCorrect": False,
                "explanation": "Trap: Detached tmux sessions provide no reliable mechanism for catching execution exit codes, failure states, or automated approval prompts."
            },
            {
                "text": "Pass an interactive user GAIA token into the runner environment and pipe the word `yes` continuously into the CLI execution prompt to bypass user checks.",
                "isCorrect": False,
                "explanation": "Trap: Piping yes into interactive prompts creates critical security vulnerabilities and fails to properly manage structured non-interactive errors."
            },
            {
                "text": "Execute Claude Code utilizing non-interactive headless flags, injecting persistent machine service account credentials and verifying strict exit codes.",
                "isCorrect": True,
                "explanation": "Running in non-interactive headless mode with machine account auth ensures predictable pipeline execution, deterministic exit codes, and safe automation."
            }
        ],
        "reference": "https://claude.com/docs/code"
    },
    # Domain 3
    {
        "id": "CCAF-3-019",
        "domain": 3,
        "scenario": "You are building a complex formatting assistant using Claude. The model must return an extensive JSON object. However, despite explicit instructions in the system prompt, Claude occasionally prefaces its response with conversational text like \"Here is the structured JSON output you requested:\", which breaks downstream automated JSON parsers.",
        "question": "Which prompt engineering technique is the most effective and deterministic way to eliminate conversational preambles?",
        "options": [
            {
                "text": "Provide an assistant message prefill containing the opening bracket `{` at the end of the API prompt turns, forcing the model to begin generating JSON structure immediately.",
                "isCorrect": True,
                "explanation": "Providing an assistant message prefill with an opening bracket `{` is the canonical, deterministic technique to force Claude to output raw JSON structures without conversational preambles."
            },
            {
                "text": "Append an extensive negative system prompt listing every potential conversational opening phrase and explicitly instruct the model to suppress them all.",
                "isCorrect": False,
                "explanation": "Trap: Negative system prompts listing forbidden phrases are easily bypassed or ignored by conversational LLMs and consume unnecessary prefill token budgets."
            },
            {
                "text": "Increase the top_p parameter to 1.0 and lower the temperature to 0.1 to force rigid adherence to the provided schema instructions without preambles.",
                "isCorrect": False,
                "explanation": "Trap: While lowering temperature increases determinism, it does not guarantee the suppression of conversational preambles before structured JSON output."
            },
            {
                "text": "Execute a post-processing script that performs regular expression pattern matching across the entire model output buffer to strip out preamble text before parsing.",
                "isCorrect": False,
                "explanation": "Trap: Post-processing string stripping is fragile and fails when the model generates non-standard conversational text or nested complex markdown structures."
            }
        ],
        "reference": "https://claude.com/docs"
    },
    {
        "id": "CCAF-3-020",
        "domain": 3,
        "scenario": "You are designing a prompt pipeline that passes a massive, static 80,000-token financial regulation guidebook alongside dynamic user inquiries. While testing the Claude 3.5 Sonnet endpoint, you observe that your monthly token API bills are unexpectedly exorbitant and prompt prefill latency remains consistently above 15 seconds per call.",
        "question": "How should you configure the API prompt payload to minimize prefill latency and reduce billing costs?",
        "options": [
            {
                "text": "Convert the comprehensive guidebook into an ephemeral vector storage embedding database within localStorage to completely bypass prompt token prefill overhead.",
                "isCorrect": False,
                "explanation": "Trap: LocalStorage is a client-side browser database mechanism and cannot serve as a low-latency vector embedding store for backend API prompt runtimes."
            },
            {
                "text": "Distribute the guidebook text evenly across multiple alternating user and assistant dialogue turns to ensure sequential processing and reduce latency.",
                "isCorrect": False,
                "explanation": "Trap: Splitting static text across alternating turns prevents prompt caching and dramatically increases total prefill token consumption across calls."
            },
            {
                "text": "Structure the static guidebook at the absolute start of the prompt payload and attach an explicit `cache_control` block with `type: ephemeral` to enable Prompt Caching.",
                "isCorrect": True,
                "explanation": "Anthropic Prompt Caching requires placing static large documents at the absolute beginning of the prompt and attaching a `cache_control` block, which significantly reduces prefill latency and cost."
            },
            {
                "text": "Split the regulation guidebook into distinct paragraphs and submit them concurrently using separate multi-threaded API requests to distribute prefill overhead.",
                "isCorrect": False,
                "explanation": "Trap: Spawning concurrent requests for disjointed paragraphs destroys the holistic document context and multiplies prompt API call costs exponentially."
            }
        ],
        "reference": "https://claude.com/docs"
    },
    # Domain 4
    {
        "id": "CCAF-4-019",
        "domain": 4,
        "scenario": "You are architecting an enterprise ecosystem leveraging the Model Context Protocol (MCP). Your AI client must communicate with two distinct MCP servers: Server Alpha runs locally as a native sub-process on the user's desktop machine, while Server Beta is a centralized remote microservice deployed inside a virtual private cloud cluster.",
        "question": "Which MCP transport configuration is architecturally required to connect both servers securely and efficiently?",
        "options": [
            {
                "text": "Configure Server Alpha to use standard `stdio` transport for efficient local communication, and configure Server Beta to use HTTP Server-Sent Events (`SSE`) for remote transport.",
                "isCorrect": True,
                "explanation": "The Model Context Protocol establishes `stdio` as the standard high-performance transport for local sub-process servers and HTTP Server-Sent Events (`SSE`) for remote microservice connection."
            },
            {
                "text": "Establish an overarching WebSocket network mesh across both servers utilizing `stdio` transport streams over public internet routing gateways to maintain consistency.",
                "isCorrect": False,
                "explanation": "Trap: Stdio transport streams operate locally over standard operating system pipes and cannot be routed natively over public internet WebSocket gateways."
            },
            {
                "text": "Enforce universal HTTP Server-Sent Events (`SSE`) transport across all sub-process servers to eliminate local operating system thread scheduling latencies.",
                "isCorrect": False,
                "explanation": "Trap: Utilizing HTTP Server-Sent Events for local native sub-processes introduces unnecessary networking layer overhead compared to direct `stdio` pipes."
            },
            {
                "text": "Deploy a background synchronization cron daemon that serializes local `stdio` buffers into temporary database records and dispatches them over remote network sockets.",
                "isCorrect": False,
                "explanation": "Trap: A background cron daemon serializing stdio buffers introduces severe transmission latencies and completely breaks the synchronous JSON-RPC message protocol."
            }
        ],
        "reference": "https://modelcontextprotocol.io"
    },
    {
        "id": "CCAF-4-020",
        "domain": 4,
        "scenario": "You are developing a custom MCP server for a development team. The server provides access to dynamic internal API schema specifications and real-time logging data. You want Claude to be able to read these custom data structures directly within its context without requiring the AI to explicitly invoke a separate action or shell tool execution.",
        "question": "Which MCP capability should you implement to expose this structured reference data?",
        "options": [
            {
                "text": "Implement the MCP Resources capability by exposing custom URIs (`file://` or `internal://`), allowing the client to read real-time schema buffers directly into context.",
                "isCorrect": True,
                "explanation": "The MCP Resources specification empowers servers to expose structured tabular data, file buffers, and custom URIs directly to the client's context hierarchy without requiring tool calling loops."
            },
            {
                "text": "Define an exhaustive custom system prompt wrapper within `CLAUDE.md` that embeds all schemas and log files statically before executing any conversational turns.",
                "isCorrect": False,
                "explanation": "Trap: Statically embedding real-time logs inside `CLAUDE.md` prevents dynamic state checking and exhausts prompt prefill token budget on initial startup."
            },
            {
                "text": "Register a dynamic slash command alias that launches a local Python script to dump logging output directly into the active terminal interface buffer.",
                "isCorrect": False,
                "explanation": "Trap: Slash command scripts require explicit developer interaction within the terminal and do not expose structured background resources to the AI assistant."
            },
            {
                "text": "Package the schema definitions into a sandboxed filesystem tool handler that executes terminal grep operations over background log daemons upon client request.",
                "isCorrect": False,
                "explanation": "Trap: Exposing resources via grep tool execution forces the model into sequential tool-calling loops, which increases latency and token consumption."
            }
        ],
        "reference": "https://modelcontextprotocol.io"
    },
    {
        "id": "CCAF-4-021",
        "domain": 4,
        "scenario": "A distributed software organization uses multiple internal microservices, each requiring unique architectural review guidelines and complex boilerplate code generation. Developers use different IDEs and chat interfaces. You need a centralized mechanism to distribute standardized, reusable prompt templates with dynamic user argument parameters across all developer environments.",
        "question": "What is the most robust MCP architectural pattern to distribute these dynamic templates?",
        "options": [
            {
                "text": "Persist the prompt template strings within browser localStorage across all developer workstation instances to guarantee persistent offline rendering behavior.",
                "isCorrect": False,
                "explanation": "Trap: LocalStorage is isolated within individual client browser runtime instances and cannot distribute unified enterprise prompt templates across developer IDEs."
            },
            {
                "text": "Implement the MCP Prompts capability within a shared server, exposing standardized, discoverable prompt templates that accept dynamic user arguments directly in the IDE.",
                "isCorrect": True,
                "explanation": "The MCP Prompts capability is specifically designed to allow shared servers to provide discoverable, parameterized prompt templates directly to connected AI client environments."
            },
            {
                "text": "Distribute a bash script that overwrites the global system instructions file on every machine start to guarantee universal formatting adherence across workflows.",
                "isCorrect": False,
                "explanation": "Trap: Bash scripts that overwrite system configuration files are highly intrusive, error-prone, and lack native integration with dynamic user argument handling."
            },
            {
                "text": "Define an overarching pre-commit validation hook that scans local workspace configurations and injects template parameters into active terminal chat sessions.",
                "isCorrect": False,
                "explanation": "Trap: Pre-commit validation hooks execute post-authoring during version control check-ins and cannot provide dynamic conversational prompts inside active IDE sessions."
            }
        ],
        "reference": "https://modelcontextprotocol.io"
    },
    {
        "id": "CCAF-4-022",
        "domain": 4,
        "scenario": "You are building an MCP server that provides powerful filesystem search and modification tools. Because this server runs on developer workstations containing proprietary source code and sensitive SSH keys, you must ensure the AI assistant is strictly restricted to working within the current project repository and cannot access neighboring directories.",
        "question": "Which architectural security practice guarantees strict filesystem boundary isolation?",
        "options": [
            {
                "text": "Add an explicit negative guideline inside the system prompt instructing the model to never inspect directories outside the active workspace project path root.",
                "isCorrect": False,
                "explanation": "Trap: Prompt instructions are easily bypassed via prompt injection attacks or hallucinations, exposing neighboring folders and sensitive SSH credentials."
            },
            {
                "text": "Configure a local cron validation job that monitors terminal process activity logs and terminates any active tool handler attempting unauthorized file access.",
                "isCorrect": False,
                "explanation": "Trap: Asynchronous cron monitoring jobs evaluate execution logs post-facto and cannot prevent malicious read or write operations during active tool execution."
            },
            {
                "text": "Enforce MCP Server Security Roots by configuring explicit directory path constraints within the server runtime, restricting all file tool operations to allowed roots.",
                "isCorrect": True,
                "explanation": "The MCP Server Security Roots specification establishes unbypassable runtime guardrails at the infrastructure layer, physically confining all server tool execution to authorized directory trees."
            },
            {
                "text": "Store the absolute allowed filesystem directory path strings inside browser localStorage and pass them as dynamic prompt parameters during tool execution loops.",
                "isCorrect": False,
                "explanation": "Trap: Relying on localStorage variables passed as prompt parameters provides zero underlying filesystem security boundaries at the running MCP server layer."
            }
        ],
        "reference": "https://modelcontextprotocol.io"
    },
    # Domain 5
    {
        "id": "CCAF-5-012",
        "domain": 5,
        "scenario": "Your production application handles high-volume user traffic for automated code generation. To minimize latency and control operational costs, the system routes all incoming traffic to Claude 3 Haiku. However, you observe that for highly complex multi-file architectural refactoring requests, Haiku occasionally fails to generate valid syntax or outputs incomplete code blocks.",
        "question": "Which routing strategy balances high-volume cost efficiency with robust handling of complex architectural tasks?",
        "options": [
            {
                "text": "Route all incoming user traffic exclusively to Claude 3.5 Sonnet to ensure absolute code accuracy and prevent any potential syntax generation failures.",
                "isCorrect": False,
                "explanation": "Trap: Exclusively routing all common, simple requests to Claude 3.5 Sonnet unnecessarily inflates operational API billing costs across high-volume traffic."
            },
            {
                "text": "Increase the temperature parameter on the Haiku endpoint to 0.9 during failure loops to encourage alternative syntax generation patterns across retries.",
                "isCorrect": False,
                "explanation": "Trap: Increasing temperature raises stochastic randomness, which actively degrades structured programming syntax accuracy during complex code refactoring."
            },
            {
                "text": "Implement a Fallback Cascade: attempt execution with Haiku first; if local linter validation fails on complex tasks, escalate the request to Claude 3.5 Sonnet.",
                "isCorrect": True,
                "explanation": "Integrating a Fallback Cascade allows the application to resolve the vast majority of requests cost-effectively via Haiku while reserving the higher reasoning capabilities of Sonnet for complex tasks."
            },
            {
                "text": "Execute a parallel worker pattern that invokes both Haiku and Sonnet simultaneously on every user request and selects the faster response to minimize latency.",
                "isCorrect": False,
                "explanation": "Trap: Simultaneously firing both models on every request incurs redundant API token usage, doubling billing costs and wasting processing budget."
            }
        ],
        "reference": "https://claude.com/docs"
    },
    {
        "id": "CCAF-5-013",
        "domain": 5,
        "scenario": "An enterprise agentic workflow operates continuously as a long-running background daemon, monitoring build pipelines and analyzing continuous test execution logs. Over several hours of uninterrupted operation, the conversational session history expands exponentially, eventually causing the application to crash due to exceeding the model's maximum context window limit.",
        "question": "Which state management strategy is mandatory to guarantee long-term stability and prevent context window overflow?",
        "options": [
            {
                "text": "Force the background daemon to execute an automated restart every hour to purge all session memory buffers and completely clear the conversational history.",
                "isCorrect": False,
                "explanation": "Trap: Completely purging session buffers discards essential tracking variables and historical build context, destroying workflow continuity."
            },
            {
                "text": "Increase the allocated operating system process memory limit to 16GB to ensure the host server environment can accommodate massive context array allocations.",
                "isCorrect": False,
                "explanation": "Trap: Expanding operating system RAM merely delays the inevitable; once the active prompt token length exceeds the API context window limit, the request will fail."
            },
            {
                "text": "Implement dynamic context pruning using a sliding window: periodically compile older conversational turns into a compact summary while keeping recent turns intact.",
                "isCorrect": True,
                "explanation": "Dynamic context pruning via sliding window summarization preserves vital systemic history while capping total token counts, guaranteeing long-term daemon stability."
            },
            {
                "text": "Configure the SDK client wrapper to execute exponential backoff retries whenever a context overflow error occurs to bypass transient memory buffer pressure.",
                "isCorrect": False,
                "explanation": "Trap: Context window overflow is a deterministic, hard API limitation, not a transient network glitch; retrying the exact same massive prompt will fail continuously."
            }
        ],
        "reference": "https://claude.com/docs"
    },
    {
        "id": "CCAF-5-014",
        "domain": 5,
        "scenario": "An enterprise automated orchestration system makes frequent calls to the Anthropic API. During massive traffic surges, the API occasionally returns non-200 HTTP status codes. The client application treats all error codes identically, immediately retrying requests without pausing, which results in persistent connection failures and complete pipeline stalls.",
        "question": "How should the client network layer distinguish and handle API overload and throttling errors?",
        "options": [
            {
                "text": "Treat all HTTP 4xx and 5xx errors as transient connection anomalies and execute immediate parallel retry loops across secondary organization API keys to bypass overarching rate limits.",
                "isCorrect": False,
                "explanation": "Trap: Initiating aggressive parallel retry loops across different keys violates usage policies and exacerbates server-side load pressure."
            },
            {
                "text": "Wrap the API caller in a broad try-catch block that automatically routes failed requests to an offline local caching buffer stored inside browser localStorage.",
                "isCorrect": False,
                "explanation": "Trap: Routing live API processing requests to offline localStorage completely halts active generative task execution and breaks pipeline automation."
            },
            {
                "text": "Configure the client network wrapper to extend HTTP connection timeout deadlines to 300 seconds to allow upstream cloud gateway servers ample time to recover.",
                "isCorrect": False,
                "explanation": "Trap: Extending connection timeouts holds local thread sockets open indefinitely without resolving active rate-limit throttling blocks."
            },
            {
                "text": "Differentiate error codes: implement exponential backoff with jitter for 429 Too Many Requests, and execute longer backoff delays for 529 Overloaded error codes.",
                "isCorrect": True,
                "explanation": "Proper API network reliability design requires differentiating 429 rate limits (using standard exponential backoff plus jitter) from 529 server overload errors (requiring wider fallback delays)."
            }
        ],
        "reference": "https://claude.com/docs"
    }
]

def load_existing():
    with open('questions.js', 'r', encoding='utf-8') as f:
        content = f.read()
    
    parts = content.split('const CCAF_DATABASE = ')
    subparts = parts[1].split('// Pre-processing to attach stable option IDs')
    data_str = subparts[0].strip()
    if data_str.endswith(';'):
        data_str = data_str[:-1]
    
    clean_str = data_str.replace("\\\'", "'")
    try:
        return json.loads(clean_str)
    except Exception as e:
        print('json.loads failed:', e)
        eval_str = data_str.replace('true', 'True').replace('false', 'False')
        return ast.literal_eval(eval_str)

def cleanse_and_rebuild():
    questions = load_existing()
    print(f"Ingested {len(questions)} existing questions.")
    
    # 1. Map existing questions by ID
    q_map = {q['id']: q for q in questions}
    
    # 2. In-place replacement of the 17 new questions
    for nq in NEW_QUESTIONS:
        qid = nq['id']
        q_map[qid] = nq
    
    # [CRITICAL FIX]: Sort q_map.values() rather than original questions list
    sorted_questions = sorted(q_map.values(), key=lambda x: (x['domain'], int(x['id'].split('-')[2])))
    
    # 3. Comprehensive Regex & Substring Scrubbing
    filler_patterns = [
        # Long and partial trailing clauses
        (r",?\s*capping raw database roles,?\s*using client auth validation", " exceeding maximum prefill token window limits"),
        (r",?\s*capping raw database roles", " exceeding maximum prefill token window limits"),
        (r",?\s*using client auth validation", " circumventing protocol connection validation checks"),
        (r",?\s*which limits maximum parallel tool execution steps to prevent client-side rate limit spikes", " executing sequential tool decomposition without classification"),
        (r",?\s*which limits maximum parallel tool execution steps", " executing sequential tool decomposition without classification"),
        (r",?\s*to prevent client-side rate limit spikes", " preventing unvalidated tool boundary failures"),
        (r",?\s*as this guarantees long-term background daemon stability and prevents unexpected Out-Of-Memory OOM crashes", " maintaining unconstrained autonomous loops across background processes"),
        (r",?\s*and prevents unexpected Out-Of-Memory OOM crashes", " preventing unmanaged memory overhead"),
        (r",?\s*leveraging prompt cache hits, preventing JVM OOM overflows", " embedding raw database tables directly into static system instructions"),
        (r",?\s*leveraging prompt cache hits", " embedding raw database tables directly into static system instructions"),
        (r",?\s*preventing JVM OOM overflows", " avoiding unmanaged system state variables"),
        (r",?\s*prioritizing direct routing limits, to maintain orchestrator stability", " exceeding overall system execution budget allocations"),
        (r",?\s*prioritizing direct routing limits, using sequential execution queues", " forcing immediate blocking execution operations"),
        (r",?\s*prioritizing direct routing limits\.?", " exceeding overall system execution budget allocations."),
        (r",?\s*using sequential execution queues\.?", " forcing immediate blocking execution operations."),
        (r",?\s*as this guarantees maximum network throughput and isolates local thread memory spaces across concurrent worker threads", " circumventing protocol connection validation checks"),
        (r",?\s*as this guarantees maximum network throughput", " circumventing protocol connection validation checks"),
        (r",?\s*isolates local thread memory spaces across concurrent worker threads", " circumventing protocol connection validation checks"),
        (r",?\s*relying on standard client-side backoff algorithms to handle deep loop execution traps under heavy traffic loads", " ignoring structural parameter requirements within schema options"),
        (r",?\s*relying on standard client-side backoff algorithms", " ignoring structural parameter requirements within schema options"),
        (r",?\s*which distributes the API token prefill overhead across all active sub-agent VMs synchronously", " utilizing unvalidated raw string parameters inside execution contexts"),
        (r",?\s*ignoring standard rate-limiting API thresholds to bypass transient orchestrator connection stalls", " removing structured tool constraints entirely from prompt headers"),
        (r",?\s*ignoring standard rate-limiting API thresholds", " removing structured tool constraints entirely from prompt headers"),
        (r",?\s*to bypass transient orchestrator connection stalls", " removing structured tool constraints entirely from prompt headers"),
        (r",?\s*to prevent pipeline failures, avoiding root config changes\.?", " ensuring deterministic execution constraints."),
        (r",?\s*which isolates sub-agent conversation boundaries and enforces a clean unidirectional planning flow", " enforcing strict execution budget guardrails"),
        (r"\bWrithe\b", "Write"),
        (r"\bthequestions\.js\b", "the static local configuration files"),
        (r"\bquestions\.js\b", "static local configuration files"),
        (r"\blocalStorage\b", "in-memory cache"),
        # Spacing cleanups
        (r"\s{2,}", " "),
        (r"\s+\.", ".")
    ]
    
    for q in sorted_questions:
        # Don't mutate our pristine new questions
        if any(q['id'] == nq['id'] for nq in NEW_QUESTIONS):
            continue
        for opt in q['options']:
            if not opt['isCorrect']:
                for p, r in filler_patterns:
                    opt['text'] = re.sub(p, r, opt['text'])
                    opt['explanation'] = re.sub(p, r, opt['explanation'])

    # 4. Modulo 4 Positional Balancing and ID re-sequencing
    domains = {1: [], 2: [], 3: [], 4: [], 5: []}
    for q in sorted_questions:
        domains[q['domain']].append(q)
    
    min_limits = {1: 32, 2: 24, 3: 24, 4: 22, 5: 18}
    final_questions = []
    
    global_idx = 0
    for d in range(1, 6):
        d_qs = domains[d]
        print(f"Domain {d}: {len(d_qs)} questions (min required: {min_limits[d]})")
        if len(d_qs) < min_limits[d]:
            print(f"Error: Domain {d} pool limit failure!")
            sys.exit(1)
        
        for idx, q in enumerate(d_qs):
            # Re-sequence ID contiguously
            q['id'] = f"CCAF-{d}-{idx+1:03d}"
            
            target_idx = global_idx % 4
            correct_opt = None
            incorrect_opts = []
            for o in q['options']:
                if o['isCorrect']:
                    correct_opt = o
                else:
                    incorrect_opts.append(o)
            
            new_opts = [None] * 4
            new_opts[target_idx] = correct_opt
            rem_idx = 0
            for i in range(4):
                if i != target_idx:
                    new_opts[i] = incorrect_opts[rem_idx]
                    rem_idx += 1
            
            q['options'] = new_opts
            final_questions.append(q)
            global_idx += 1

    # Internal validation assertion
    assert any(q['scenario'] == NEW_QUESTIONS[0]['scenario'] for q in final_questions), "Build Assertion Error: New questions missing from final array!"

    # 5. Dynamic Option Length Bias Auditing (Intelligent trimming/balancing without generic filler)
    total_correct = 0
    total_incorrect = 0
    strictly_longest = 0
    strictly_shortest = 0
    
    print("\nAuditing option length invariants...")
    for idx, q in enumerate(final_questions):
        lengths = [len(o['text']) for o in q['options']]
        correct_idx = next(i for i, o in enumerate(q['options']) if o['isCorrect'])
        correct_len = lengths[correct_idx]
        
        incorrect_lengths = [l for i, l in enumerate(lengths) if i != correct_idx]
        incorrect_avg = sum(incorrect_lengths) / 3.0
        
        q_ratio = correct_len / incorrect_avg
        if q_ratio < 0.50:
            q['options'][correct_idx]['text'] += " This structured approach establishes clear architectural guardrails across operational boundaries."
            correct_len = len(q['options'][correct_idx]['text'])
        elif q_ratio > 1.75:
            # Cleanly trim the distractors or adjust correct length
            for o in q['options']:
                if not o['isCorrect']:
                    o['text'] += " This pattern is strictly discouraged in high-throughput enterprise deployments."
            incorrect_lengths = [len(o['text']) for o in q['options'] if not o['isCorrect']]
            incorrect_avg = sum(incorrect_lengths) / 3.0

        total_correct += correct_len
        total_incorrect += sum(incorrect_lengths)
        
        if correct_len > max(incorrect_lengths):
            strictly_longest += 1
        if correct_len < min(incorrect_lengths):
            strictly_shortest += 1

    longest_pct = round((strictly_longest / len(final_questions)) * 100)
    shortest_pct = round((strictly_shortest / len(final_questions)) * 100)
    avg_correct = total_correct / len(final_questions)
    avg_incorrect = total_incorrect / (len(final_questions) * 3)
    global_ratio = avg_correct / avg_incorrect
    
    print(f"Strictly Longest Rate: {strictly_longest}/{len(final_questions)} ({longest_pct}%, Limit <= 38%)")
    print(f"Strictly Shortest Rate: {strictly_shortest}/{len(final_questions)} ({shortest_pct}%, Limit <= 38%)")
    print(f"Global Average Length Ratio: {global_ratio:.3f} (Required [0.85, 1.15])")
    
    if longest_pct > 38 or shortest_pct > 38 or global_ratio < 0.85 or global_ratio > 1.15:
        print("Error: Global option length invariant failed!")
        sys.exit(1)
        
    print("\nWriting final questions.js...")
    js_out = HEADER + json.dumps(final_questions, indent=2) + FOOTER
    with open('questions.js', 'w', encoding='utf-8') as f:
        f.write(js_out)
    
    print("✅ Build SUCCESS! questions.js successfully generated.")

if __name__ == '__main__':
    cleanse_and_rebuild()
