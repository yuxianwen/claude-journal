import { describe, expect, it } from 'vitest';
import type { SharePayload } from './share-types';
import { redactPayload, redactString, REDACTED_PATH, REDACTED_SECRET } from './share-redact';

function createMockPayload(overrides?: Partial<SharePayload>): SharePayload {
  return {
    v: 1,
    session: {
      title: 'Test Session',
      provider: 'claude',
      model: 'claude-3-5-sonnet',
      startTime: '2026-09-01T00:00:00.000Z',
      endTime: '2026-09-01T01:00:00.000Z',
      cwd: '~/…/my-app',
    },
    messages: [],
    filters: {
      thinking: false,
      tools: true,
      userMessages: true,
      assistantMessages: true,
    },
    redactions: {
      paths: 0,
      secrets: 0,
      imagesStripped: 0,
    },
    createdAt: '2026-09-01T01:00:00.000Z',
    ...overrides,
  };
}

describe('share-redact scrubbers', () => {
  describe('path scrubber', () => {
    it('redacts macOS user path', () => {
      const input = 'File saved to /Users/alice/projects/app.ts';
      const res = redactString(input);
      expect(res.text).toBe(`File saved to ${REDACTED_PATH}/projects/app.ts`);
      expect(res.pathCount).toBe(1);
    });

    it('redacts Linux user path', () => {
      const input = 'Config at /home/bob/.config/app.json';
      const res = redactString(input);
      expect(res.text).toBe(`Config at ${REDACTED_PATH}/.config/app.json`);
      expect(res.pathCount).toBe(1);
    });

    it('redacts Windows user path with single and double backslashes', () => {
      const input1 = 'Located at C:\\Users\\Charlie\\Documents\\file.txt';
      const res1 = redactString(input1);
      expect(res1.text).toBe(`Located at ${REDACTED_PATH}\\Documents\\file.txt`);
      expect(res1.pathCount).toBe(1);

      const input2 = 'Escaped: C:\\\\Users\\\\Charlie\\\\Documents\\\\file.txt';
      const res2 = redactString(input2);
      expect(res2.text).toBe(`Escaped: ${REDACTED_PATH}\\\\Documents\\\\file.txt`);
      expect(res2.pathCount).toBe(1);
    });

    it('redacts standalone home directories', () => {
      expect(redactString('/Users/johndoe').text).toBe(REDACTED_PATH);
      expect(redactString('/home/ubuntu').text).toBe(REDACTED_PATH);
    });
  });

  describe('secret scrubbers', () => {
    it('redacts OpenAI / Anthropic sk- keys', () => {
      const input = 'Use api_key sk-ant-api03-abcdef1234567890abcdef1234567890 and sk-proj-1234567890abcdef1234567890';
      const res = redactString(input);
      expect(res.text).toBe(`Use api_key ${REDACTED_SECRET} and ${REDACTED_SECRET}`);
      expect(res.secretCount).toBe(2);
    });

    it('redacts GitHub personal access tokens', () => {
      const input = 'Tokens: ghp_1234567890abcdef1234567890123456 and github_pat_11ABCDEFG_1234567890abcdef1234567890';
      const res = redactString(input);
      expect(res.text).toBe(`Tokens: ${REDACTED_SECRET} and ${REDACTED_SECRET}`);
      expect(res.secretCount).toBe(2);
    });

    it('redacts AWS access key IDs', () => {
      const input = 'AWS Key: AKIAIOSFODNN7EXAMPLE and ASIAIOSFODNN7EXAMPLE';
      const res = redactString(input);
      expect(res.text).toBe(`AWS Key: ${REDACTED_SECRET} and ${REDACTED_SECRET}`);
      expect(res.secretCount).toBe(2);
    });

    it('redacts Slack tokens', () => {
      const input = 'Slack: xoxb-123456789012-abcdef123456-ghijkl';
      const res = redactString(input);
      expect(res.text).toBe(`Slack: ${REDACTED_SECRET}`);
      expect(res.secretCount).toBe(1);
    });

    it('redacts JWT tokens with three segments', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const input = `Bearer ${jwt}`;
      const res = redactString(input);
      expect(res.text).toBe(`Bearer ${REDACTED_SECRET}`);
      expect(res.secretCount).toBe(1);
    });

    it('redacts PEM private keys', () => {
      const pem = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Y3y1r4pZ
...fake payload...
-----END RSA PRIVATE KEY-----`;
      const input = `Here is my key:\n${pem}\nKeep it safe.`;
      const res = redactString(input);
      expect(res.text).toBe(`Here is my key:\n${REDACTED_SECRET}\nKeep it safe.`);
      expect(res.secretCount).toBe(1);
    });

    it('redacts Authorization: Bearer tokens', () => {
      const input = 'Authorization: Bearer myCustomSecretToken12345678';
      const res = redactString(input);
      expect(res.text).toBe(`Authorization: Bearer ${REDACTED_SECRET}`);
      expect(res.secretCount).toBe(1);
    });

    it('redacts API_KEY, SECRET, and TOKEN assignments', () => {
      const input = `API_KEY=supersecret123
MY_SECRET="another-secret-val"
PRIVATE_KEY='raw-key-here'
GITHUB_TOKEN=customtokenvalue
PASSWORD=mypassword123`;
      const res = redactString(input);
      expect(res.text).toContain(`API_KEY=${REDACTED_SECRET}`);
      expect(res.text).toContain(`MY_SECRET="${REDACTED_SECRET}"`);
      expect(res.text).toContain(`PRIVATE_KEY='${REDACTED_SECRET}'`);
      expect(res.text).toContain(`GITHUB_TOKEN=${REDACTED_SECRET}`);
      expect(res.text).toContain(`PASSWORD=${REDACTED_SECRET}`);
      expect(res.secretCount).toBe(5);
    });

    it('masks .env and env/printenv output values', () => {
      const envOutput = `PORT=3000
DATABASE_URL=postgres://user:pass@localhost:5432/mydb
DEBUG=false
export REDIS_HOST=127.0.0.1`;
      const res = redactString(envOutput, { isEnvOutput: true });
      expect(res.text).toBe(`PORT=${REDACTED_SECRET}
DATABASE_URL=${REDACTED_SECRET}
DEBUG=${REDACTED_SECRET}
export REDIS_HOST=${REDACTED_SECRET}`);
      expect(res.secretCount).toBe(4);
    });

    it('does not mangle ordinary prose, git commit hashes, or common keywords', () => {
      const prose = 'We need an API key for the service. The secret to good code is testing. Git commit 4b825dc639234850239482039482039482039482 is deployed at /var/www/app.';
      const res = redactString(prose);
      expect(res.text).toBe(prose);
      expect(res.pathCount).toBe(0);
      expect(res.secretCount).toBe(0);
    });
  });

  describe('redactPayload walk and immutability', () => {
    it('is immutable and returns a new payload without modifying input', () => {
      const original = createMockPayload({
        messages: [
          {
            uuid: '1',
            parentUuid: null,
            type: 'user',
            timestamp: '',
            isSidechain: false,
            content: [{ type: 'text', text: 'My path is /Users/alice/app' }],
          },
        ],
      });

      const { payload: result, pathCount, secretCount } = redactPayload(original);

      expect(pathCount).toBe(1);
      expect(secretCount).toBe(0);
      expect(result).not.toBe(original);
      expect(result.messages[0]).not.toBe(original.messages[0]);
      expect((original.messages[0].content[0] as { text: string }).text).toBe('My path is /Users/alice/app');
      expect((result.messages[0].content[0] as { text: string }).text).toBe(`My path is ${REDACTED_PATH}/app`);
    });

    it('walks text, thinking, tool_use.input, and tool_result.content', () => {
      const payload = createMockPayload({
        messages: [
          {
            uuid: 'msg-1',
            parentUuid: null,
            type: 'assistant',
            timestamp: '',
            isSidechain: false,
            content: [
              { type: 'thinking', thinking: 'Checking /Users/david/repo with API_KEY=abc12345' },
              {
                type: 'tool_use',
                id: 'call-1',
                name: 'Bash',
                input: {
                  command: 'cat /Users/david/repo/.env',
                  env: { GITHUB_TOKEN: 'ghp_123456789012345678901234567890' },
                },
              },
            ],
          },
          {
            uuid: 'msg-2',
            parentUuid: 'msg-1',
            type: 'user',
            timestamp: '',
            isSidechain: false,
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'call-1',
                content: 'DATABASE_URL=postgres://localhost:5432\nSECRET=supersecret',
              },
            ],
          },
        ],
      });

      const { payload: res, pathCount, secretCount } = redactPayload(payload);

      // Thinking block
      const thinking = (res.messages[0].content[0] as { thinking: string }).thinking;
      expect(thinking).toContain(REDACTED_PATH);
      expect(thinking).toContain(REDACTED_SECRET);

      // Tool use input
      const toolInput = (res.messages[0].content[1] as { input: Record<string, unknown> }).input;
      expect(toolInput.command).toBe(`cat ${REDACTED_PATH}/repo/.env`);
      expect((toolInput.env as Record<string, string>).GITHUB_TOKEN).toBe(REDACTED_SECRET);

      // Tool result content (recognized as env output because call-1 was cat .env)
      const toolResult = (res.messages[1].content[0] as { content: string }).content;
      expect(toolResult).toBe(`DATABASE_URL=${REDACTED_SECRET}\nSECRET=${REDACTED_SECRET}`);

      expect(pathCount).toBe(2);
      expect(secretCount).toBe(4);
    });

    it('walks nested ContentBlock[] in tool_result.content', () => {
      const payload = createMockPayload({
        messages: [
          {
            uuid: 'msg-1',
            parentUuid: null,
            type: 'user',
            timestamp: '',
            isSidechain: false,
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'call-2',
                content: [
                  { type: 'text', text: 'Error in /home/alice/script.py with sk-ant-1234567890abcdef' },
                ],
              },
            ],
          },
        ],
      });

      const { payload: res, pathCount, secretCount } = redactPayload(payload);
      const nested = (res.messages[0].content[0] as { content: Array<{ text: string }> }).content;
      expect(nested[0].text).toContain(REDACTED_PATH);
      expect(nested[0].text).toContain(REDACTED_SECRET);
      expect(pathCount).toBe(1);
      expect(secretCount).toBe(1);
    });
  });
});
