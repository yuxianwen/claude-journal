import type { ContentBlock, Message } from '@/types';
import type { SharePayload } from './share-types';

export const REDACTED_PATH = '[REDACTED:path]';
export const REDACTED_SECRET = '[REDACTED:secret]';

// Matches home directory prefixes:
// /Users/<username>, /home/<username>, C:\Users\<username>, C:\\Users\\<username>
const USER_PATH_RE = /(?:(?:\/(?:Users|home)\/)|(?:[a-zA-Z]:(?:\\|\\\\|\/)(?:Users|home)(?:\\|\\\\|\/)))([a-zA-Z0-9._-]+)/gi;

// Secret patterns
const PEM_PRIVATE_KEY_RE = /-----BEGIN (?:[A-Z0-9_ -]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z0-9_ -]+ )?PRIVATE KEY-----|-----BEGIN (?:[A-Z0-9_ -]+ )?PRIVATE KEY-----[^\r\n]*/g;
const SK_KEY_RE = /\bsk-(?:ant-[a-zA-Z0-9_-]{10,}|proj-[a-zA-Z0-9_-]{10,}|[a-zA-Z0-9_-]{12,})\b/g;
const GITHUB_PAT_RE = /\b(?:gh[pousr]_[a-zA-Z0-9_]{16,}|github_pat_[a-zA-Z0-9_]{16,})\b/g;
const AWS_KEY_RE = /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g;
const SLACK_TOKEN_RE = /\bxox[baprs]-[0-9a-zA-Z-]{10,}\b/g;
const JWT_RE = /\beyJ[a-zA-Z0-9_-]{6,}\.[a-zA-Z0-9_-]{6,}\.[a-zA-Z0-9_-]{6,}\b/g;
const AUTH_BEARER_RE = /(?<=(?:\bAuthorization\s*:\s*Bearer|\bBearer)\s+)(?!\[REDACTED:)([^\s"'>\r\n`]{8,})/gi;
const ASSIGNMENT_RE = /\b([a-zA-Z0-9_]*(?:API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY)[a-zA-Z0-9_]*\s*[:=]\s*)(['"]?)(?!\[REDACTED:)([^'"\s\r\n`;]+)\2/gi;

/**
 * Mask values in .env or env command outputs.
 * Lines matching KEY=VALUE or export KEY=VALUE have their VALUE replaced.
 */
export function maskEnvOutput(content: string): { text: string; count: number } {
  let count = 0;
  const result = content.replace(
    /^(\s*(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=\s*)(['"]?)(?!\[REDACTED:)(.*?)\2(\s*)$/gm,
    (match, prefix, quote, value, suffix) => {
      const trimmed = value.trim();
      if (!trimmed || trimmed.startsWith('[REDACTED:') || trimmed.startsWith('#')) {
        return match;
      }
      count++;
      return `${prefix}${quote}${REDACTED_SECRET}${quote}${suffix}`;
    }
  );
  return { text: result, count };
}

/** Check if a string looks like the multiline output of an env / .env command. */
function looksLikeEnvOutput(str: string): boolean {
  const matches = str.match(/^[A-Za-z_][A-Za-z0-9_]*\s*=\s*.+$/gm);
  return (matches?.length ?? 0) >= 2;
}

/** Check if a tool_use block represents an env/printenv or .env-reading command. */
function isEnvToolUse(input: Record<string, unknown> | undefined): boolean {
  if (!input) return false;
  const cmd = typeof input.command === 'string' ? input.command : '';
  if (cmd) {
    if (/(?:^|\s|\||;)(?:printenv|env)(?:\s|$|\||;)/.test(cmd)) return true;
    if (/(?:^|\s|\||;)(?:cat|grep|source|\.)\s+.*\.env(?:\.[a-zA-Z0-9_-]+)*(?:\s|$|\||;)/.test(cmd)) return true;
  }
  const path = typeof input.path === 'string' ? input.path : typeof input.file_path === 'string' ? input.file_path : '';
  if (path && /(^|\/)\.env(\.[a-zA-Z0-9_-]+)*$/.test(path)) return true;
  return false;
}

/**
 * Redact secret and path patterns in a given string.
 */
export function redactString(
  text: string,
  opts?: { isEnvOutput?: boolean }
): { text: string; pathCount: number; secretCount: number } {
  if (!text) return { text, pathCount: 0, secretCount: 0 };

  let current = text;
  let pathCount = 0;
  let secretCount = 0;

  // 1. Env command output masking if applicable
  if (opts?.isEnvOutput || looksLikeEnvOutput(current)) {
    const envRes = maskEnvOutput(current);
    current = envRes.text;
    secretCount += envRes.count;
  }

  // 2. PEM private keys (multiline)
  current = current.replace(PEM_PRIVATE_KEY_RE, (match) => {
    if (match.includes(REDACTED_SECRET)) return match;
    secretCount++;
    return REDACTED_SECRET;
  });

  // 3. User home directory paths (/Users/<name>, /home/<name>, C:\Users\<name>)
  current = current.replace(USER_PATH_RE, (match) => {
    if (match.includes(REDACTED_PATH)) return match;
    pathCount++;
    return REDACTED_PATH;
  });

  // 4. Secret patterns
  // 4a. OpenAI / Anthropic sk- keys
  current = current.replace(SK_KEY_RE, (match) => {
    if (match.includes(REDACTED_SECRET)) return match;
    secretCount++;
    return REDACTED_SECRET;
  });

  // 4b. GitHub personal access tokens
  current = current.replace(GITHUB_PAT_RE, (match) => {
    if (match.includes(REDACTED_SECRET)) return match;
    secretCount++;
    return REDACTED_SECRET;
  });

  // 4c. AWS Access Key IDs
  current = current.replace(AWS_KEY_RE, (match) => {
    if (match.includes(REDACTED_SECRET)) return match;
    secretCount++;
    return REDACTED_SECRET;
  });

  // 4d. Slack tokens
  current = current.replace(SLACK_TOKEN_RE, (match) => {
    if (match.includes(REDACTED_SECRET)) return match;
    secretCount++;
    return REDACTED_SECRET;
  });

  // 4e. JWTs (three dot-separated segments)
  current = current.replace(JWT_RE, (match) => {
    if (match.includes(REDACTED_SECRET)) return match;
    secretCount++;
    return REDACTED_SECRET;
  });

  // 4f. Authorization: Bearer tokens
  current = current.replace(AUTH_BEARER_RE, (match) => {
    if (match === REDACTED_SECRET || match.startsWith('[REDACTED:')) return match;
    secretCount++;
    return REDACTED_SECRET;
  });

  // 4g. API_KEY= / SECRET= / TOKEN= / PASSWORD= assignments
  current = current.replace(ASSIGNMENT_RE, (match, prefix, quote, value) => {
    if (!value || value.startsWith('[REDACTED:') || /^(?:true|false|null|undefined)$/i.test(value)) {
      return match;
    }
    secretCount++;
    return `${prefix}${quote}${REDACTED_SECRET}${quote}`;
  });

  return { text: current, pathCount, secretCount };
}

/** Recursively redact all string values in an object / array (e.g. tool_use.input). */
function redactObjectValues(
  obj: unknown,
  redactFn: (str: string) => { text: string; pathCount: number; secretCount: number }
): { value: unknown; pathCount: number; secretCount: number } {
  let totalPaths = 0;
  let totalSecrets = 0;

  if (typeof obj === 'string') {
    const res = redactFn(obj);
    return { value: res.text, pathCount: res.pathCount, secretCount: res.secretCount };
  }

  if (Array.isArray(obj)) {
    const newArr = obj.map((item) => {
      const res = redactObjectValues(item, redactFn);
      totalPaths += res.pathCount;
      totalSecrets += res.secretCount;
      return res.value;
    });
    return { value: newArr, pathCount: totalPaths, secretCount: totalSecrets };
  }

  if (obj && typeof obj === 'object') {
    const newObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      const res = redactObjectValues(v, redactFn);
      totalPaths += res.pathCount;
      totalSecrets += res.secretCount;
      newObj[k] = res.value;
    }
    return { value: newObj, pathCount: totalPaths, secretCount: totalSecrets };
  }

  return { value: obj, pathCount: 0, secretCount: 0 };
}

/**
 * Immutable pass over a SharePayload to redact secrets and user paths.
 * Returns a new SharePayload alongside total path and secret redaction counts.
 */
export function redactPayload(payload: SharePayload): {
  payload: SharePayload;
  pathCount: number;
  secretCount: number;
} {
  let totalPaths = 0;
  let totalSecrets = 0;

  // Track env command tool_use IDs so matching tool_result content is masked
  const envToolUseIds = new Set<string>();
  for (const message of payload.messages) {
    for (const block of message.content) {
      if (block.type === 'tool_use' && isEnvToolUse(block.input)) {
        envToolUseIds.add(block.id);
      }
    }
  }

  // Redact session metadata
  let newTitle = payload.session.title;
  if (newTitle) {
    const titleRes = redactString(newTitle);
    newTitle = titleRes.text;
    totalPaths += titleRes.pathCount;
    totalSecrets += titleRes.secretCount;
  }

  let newCwd = payload.session.cwd;
  if (newCwd) {
    const cwdRes = redactString(newCwd);
    newCwd = cwdRes.text;
    totalPaths += cwdRes.pathCount;
    totalSecrets += cwdRes.secretCount;
  }

  // Redact messages
  const newMessages: Message[] = payload.messages.map((msg) => {
    const newContent: ContentBlock[] = msg.content.map((block) => {
      if (block.type === 'text') {
        const res = redactString(block.text);
        totalPaths += res.pathCount;
        totalSecrets += res.secretCount;
        return { ...block, text: res.text };
      }

      if (block.type === 'thinking') {
        const res = redactString(block.thinking);
        totalPaths += res.pathCount;
        totalSecrets += res.secretCount;
        return { ...block, thinking: res.text };
      }

      if (block.type === 'tool_use') {
        const res = redactObjectValues(block.input, redactString);
        totalPaths += res.pathCount;
        totalSecrets += res.secretCount;
        return {
          ...block,
          input: res.value as Record<string, unknown>,
        };
      }

      if (block.type === 'tool_result') {
        const isEnv = envToolUseIds.has(block.tool_use_id);
        if (typeof block.content === 'string') {
          const res = redactString(block.content, { isEnvOutput: isEnv });
          totalPaths += res.pathCount;
          totalSecrets += res.secretCount;
          return { ...block, content: res.text };
        }
        if (Array.isArray(block.content)) {
          const newNested = block.content.map((nested) => {
            if (nested.type === 'text') {
              const res = redactString(nested.text, { isEnvOutput: isEnv });
              totalPaths += res.pathCount;
              totalSecrets += res.secretCount;
              return { ...nested, text: res.text };
            }
            if (nested.type === 'tool_use') {
              const res = redactObjectValues(nested.input, redactString);
              totalPaths += res.pathCount;
              totalSecrets += res.secretCount;
              return { ...nested, input: res.value as Record<string, unknown> };
            }
            return { ...nested };
          });
          return { ...block, content: newNested };
        }
        return { ...block };
      }

      return { ...block };
    });

    return {
      ...msg,
      content: newContent,
    };
  });

  const newPayload: SharePayload = {
    ...payload,
    session: {
      ...payload.session,
      title: newTitle,
      cwd: newCwd,
    },
    messages: newMessages,
    filters: { ...payload.filters },
    redactions: {
      paths: totalPaths,
      secrets: totalSecrets,
      imagesStripped: payload.redactions.imagesStripped,
    },
  };

  return {
    payload: newPayload,
    pathCount: totalPaths,
    secretCount: totalSecrets,
  };
}
