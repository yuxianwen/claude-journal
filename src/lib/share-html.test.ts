import { describe, expect, it } from 'vitest';
import type { SharePayload } from './share-types';
import { buildShareHtml } from './share-html';

function createTestPayload(): SharePayload {
  return {
    v: 1,
    session: {
      title: 'Fixing OAuth & Security',
      provider: 'claude',
      model: 'claude-3-5-sonnet',
      startTime: '2026-09-01T10:00:00.000Z',
      endTime: '2026-09-01T11:00:00.000Z',
      cwd: '~/…/my-app',
    },
    messages: [
      {
        uuid: 'u-1',
        parentUuid: null,
        type: 'user',
        timestamp: '2026-09-01T10:01:00.000Z',
        isSidechain: false,
        content: [
          { type: 'text', text: 'Please inspect the server file **app.ts**' },
        ],
      },
      {
        uuid: 'a-1',
        parentUuid: 'u-1',
        type: 'assistant',
        timestamp: '2026-09-01T10:02:00.000Z',
        isSidechain: false,
        content: [
          { type: 'thinking', thinking: 'Analyzing the request thoroughly' },
          {
            type: 'tool_use',
            id: 'call-1',
            name: 'Bash',
            input: { command: 'ls -la' },
          },
          {
            type: 'tool_result',
            tool_use_id: 'call-1',
            content: 'total 16\n-rw-r--r-- app.ts',
          },
          { type: 'text', text: 'Here are the files: `app.ts` exists.' },
        ],
      },
    ],
    filters: {
      thinking: true,
      tools: true,
      userMessages: true,
      assistantMessages: true,
    },
    redactions: {
      paths: 3,
      secrets: 2,
      imagesStripped: 1,
    },
    createdAt: '2026-09-01T11:30:00.000Z',
  };
}

describe('buildShareHtml', () => {
  it('returns a single standalone HTML document string', () => {
    const payload = createTestPayload();
    const html = buildShareHtml(payload, { assistantName: 'Claude', userLabel: 'User' });

    expect(typeof html).toBe('string');
    expect(html.trim().startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('</html>');
  });

  it('contains the title, header metadata, and escapes special HTML chars', () => {
    const payload = createTestPayload();
    const html = buildShareHtml(payload, { assistantName: 'Claude', userLabel: 'User' });

    expect(html).toContain('Fixing OAuth &amp; Security');
    expect(html).toContain('claude-3-5-sonnet');
    expect(html).toContain('~/…/my-app');
    expect(html).toContain('Claude');
    expect(html).toContain('User');
  });

  it('renders markdown in message content', () => {
    const payload = createTestPayload();
    const html = buildShareHtml(payload, { assistantName: 'Claude', userLabel: 'User' });

    // Bold text converted to <strong>
    expect(html).toContain('<strong>app.ts</strong>');
    // Code text converted to <code>
    expect(html).toContain('<code>app.ts</code>');
  });

  it('renders thinking blocks as <details>', () => {
    const payload = createTestPayload();
    const html = buildShareHtml(payload, { assistantName: 'Claude', userLabel: 'User' });

    expect(html).toContain('<details class="thinking-block">');
    expect(html).toContain('<summary class="thinking-summary">Thinking</summary>');
    expect(html).toContain('Analyzing the request thoroughly');
  });

  it('renders tool calls and results as labeled <pre> code blocks', () => {
    const payload = createTestPayload();
    const html = buildShareHtml(payload, { assistantName: 'Claude', userLabel: 'User' });

    expect(html).toContain('Tool Call');
    expect(html).toContain('Bash');
    expect(html).toContain('&quot;command&quot;: &quot;ls -la&quot;');
    expect(html).toContain('Tool Result');
    expect(html).toContain('call-1');
    expect(html).toContain('total 16');
  });

  it('includes footer with AI Journal brand and redaction counts', () => {
    const payload = createTestPayload();
    const html = buildShareHtml(payload, { assistantName: 'Claude', userLabel: 'User' });

    expect(html).toContain('Exported from <strong>AI Journal</strong>');
    expect(html).toContain('Redacted: 2 secret(s) · 3 path(s) · 1 image(s) stripped');
  });

  it('has no external script or style URLs except optionally pinned cdnjs/jsdelivr', () => {
    const payload = createTestPayload();
    const html = buildShareHtml(payload, { assistantName: 'Claude', userLabel: 'User' });

    // Check script and link tags
    const scriptSrcMatches = Array.from(html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi));
    const styleHrefMatches = Array.from(html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/gi));

    const externalUrls = [...scriptSrcMatches, ...styleHrefMatches].map(m => m[1]);
    for (const url of externalUrls) {
      const allowed = url.startsWith('https://cdnjs.cloudflare.com/') || url.startsWith('https://cdn.jsdelivr.net/');
      expect(allowed).toBe(true);
    }
  });

  describe('HTML injection sanitization', () => {
    it('escapes script tags, img onerror, javascript links, and iframes while preserving valid markdown', () => {
      const maliciousPayload: SharePayload = {
        v: 1,
        session: {
          title: 'Security Audit',
          provider: 'claude',
          cwd: '~/…/audit',
        },
        messages: [
          {
            uuid: 'u-attack',
            parentUuid: null,
            type: 'user',
            timestamp: '2026-09-01T10:00:00.000Z',
            isSidechain: false,
            content: [
              {
                type: 'text',
                text: `Here is an attack:

<script>alert(1)</script>

<img src=x onerror=alert(1)>

Check out this [link](javascript:alert(1)).

<iframe src="https://evil.com"></iframe>

And here is legitimate markdown:

**bold**

\`\`\`js
console.log("fenced code block");
\`\`\`

[ok](https://example.com)`,
              },
            ],
          },
          {
            uuid: 'a-response',
            parentUuid: 'u-attack',
            type: 'assistant',
            timestamp: '2026-09-01T10:01:00.000Z',
            isSidechain: false,
            content: [
              {
                type: 'thinking',
                thinking: 'Checking <script>alert(2)</script> and <iframe src="x"></iframe> in thinking block',
              },
              {
                type: 'text',
                text: 'Inspected: `<script>` tag was neutralized.',
              },
            ],
          },
        ],
        filters: {
          thinking: true,
          tools: true,
          userMessages: true,
          assistantMessages: true,
        },
        redactions: {
          paths: 0,
          secrets: 0,
          imagesStripped: 0,
        },
        createdAt: '2026-09-01T10:02:00.000Z',
      };

      const html = buildShareHtml(maliciousPayload, { assistantName: 'Claude', userLabel: 'User' });

      // Extract the messages container so we only test content originating from messages
      const mainContentMatch = html.match(/<main class="messages-list">([\s\S]*?)<\/main>/);
      expect(mainContentMatch).toBeTruthy();
      const messagesHtml = mainContentMatch![1];

      // 1. Assert none of the dangerous tags survive as live markup
      expect(messagesHtml).not.toContain('<script');
      expect(messagesHtml).not.toContain('<iframe');
      expect(messagesHtml).not.toContain('<object');
      expect(messagesHtml).not.toContain('<embed');
      expect(messagesHtml).not.toContain('<style');
      expect(messagesHtml).not.toContain('<link');
      expect(messagesHtml).not.toContain('<meta');

      // 2. Assert no live tags have event handlers (on<event>=)
      expect(messagesHtml).not.toMatch(/<[a-z0-9_-]+[^>]*\son\w+\s*=/i);

      // 3. Assert no javascript: or data:text/html URLs in links/attributes
      expect(messagesHtml).not.toContain('href="javascript:');
      expect(messagesHtml).not.toContain('data:text/html');
      // The [link](javascript:alert(1)) should NOT be rendered as a link with javascript: URL
      expect(messagesHtml).not.toMatch(/<a[^>]+href=["']javascript:/i);

      // 4. Assert raw HTML appears as escaped visible text
      expect(messagesHtml).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(messagesHtml).toContain('&lt;img src=x onerror=alert(1)&gt;');
      expect(messagesHtml).toContain('&lt;iframe src=&quot;https://evil.com&quot;&gt;&lt;/iframe&gt;');
      expect(messagesHtml).toContain('&lt;script&gt;alert(2)&lt;/script&gt;');

      // 5. Assert valid markdown still renders correctly
      expect(messagesHtml).toContain('<strong>bold</strong>');
      expect(messagesHtml).toContain('<pre><code class="language-js">console.log(&quot;fenced code block&quot;);\n</code></pre>');
      expect(messagesHtml).toContain('<a href="https://example.com" rel="noopener noreferrer">ok</a>');
    });

    it('escapes <script>alert(1)</script> so it does not survive as live markup', () => {
      const payload: SharePayload = {
        v: 1,
        session: { title: 'Test', provider: 'claude' },
        messages: [{
          uuid: 'm1', parentUuid: null, type: 'user', timestamp: '', isSidechain: false,
          content: [{ type: 'text', text: '<script>alert(1)</script>' }],
        }],
        filters: { thinking: true, tools: true, userMessages: true, assistantMessages: true },
        redactions: { paths: 0, secrets: 0, imagesStripped: 0 },
        createdAt: '2026-09-01T00:00:00.000Z',
      };
      const html = buildShareHtml(payload, { assistantName: 'Claude', userLabel: 'User' });
      const main = html.match(/<main class="messages-list">([\s\S]*?)<\/main>/)![1];
      expect(main).not.toContain('<script');
      expect(main).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    it('escapes <img src=x onerror=alert(1)> so no live element with onerror handler is emitted', () => {
      const payload: SharePayload = {
        v: 1,
        session: { title: 'Test', provider: 'claude' },
        messages: [{
          uuid: 'm1', parentUuid: null, type: 'user', timestamp: '', isSidechain: false,
          content: [{ type: 'text', text: '<img src=x onerror=alert(1)>' }],
        }],
        filters: { thinking: true, tools: true, userMessages: true, assistantMessages: true },
        redactions: { paths: 0, secrets: 0, imagesStripped: 0 },
        createdAt: '2026-09-01T00:00:00.000Z',
      };
      const html = buildShareHtml(payload, { assistantName: 'Claude', userLabel: 'User' });
      const main = html.match(/<main class="messages-list">([\s\S]*?)<\/main>/)![1];
      expect(main).not.toContain('<img');
      expect(main).not.toMatch(/<[^>]+onerror/i);
      expect(main).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });

    it('strips javascript: protocol from markdown [link](javascript:alert(1))', () => {
      const payload: SharePayload = {
        v: 1,
        session: { title: 'Test', provider: 'claude' },
        messages: [{
          uuid: 'm1', parentUuid: null, type: 'user', timestamp: '', isSidechain: false,
          content: [{ type: 'text', text: '[link](javascript:alert(1))' }],
        }],
        filters: { thinking: true, tools: true, userMessages: true, assistantMessages: true },
        redactions: { paths: 0, secrets: 0, imagesStripped: 0 },
        createdAt: '2026-09-01T00:00:00.000Z',
      };
      const html = buildShareHtml(payload, { assistantName: 'Claude', userLabel: 'User' });
      const main = html.match(/<main class="messages-list">([\s\S]*?)<\/main>/)![1];
      expect(main).not.toContain('href="javascript:');
      expect(main).not.toMatch(/<a[^>]+href=["']javascript:/i);
      expect(main).toContain('link');
    });

    it('escapes <iframe> so it does not survive as live markup', () => {
      const payload: SharePayload = {
        v: 1,
        session: { title: 'Test', provider: 'claude' },
        messages: [{
          uuid: 'm1', parentUuid: null, type: 'user', timestamp: '', isSidechain: false,
          content: [{ type: 'text', text: '<iframe src="https://evil.com"></iframe>' }],
        }],
        filters: { thinking: true, tools: true, userMessages: true, assistantMessages: true },
        redactions: { paths: 0, secrets: 0, imagesStripped: 0 },
        createdAt: '2026-09-01T00:00:00.000Z',
      };
      const html = buildShareHtml(payload, { assistantName: 'Claude', userLabel: 'User' });
      const main = html.match(/<main class="messages-list">([\s\S]*?)<\/main>/)![1];
      expect(main).not.toContain('<iframe');
      expect(main).toContain('&lt;iframe src=&quot;https://evil.com&quot;&gt;&lt;/iframe&gt;');
    });

    it('still renders normal markdown (bold, code block, https link) correctly', () => {
      const payload: SharePayload = {
        v: 1,
        session: { title: 'Test', provider: 'claude' },
        messages: [{
          uuid: 'm1', parentUuid: null, type: 'user', timestamp: '', isSidechain: false,
          content: [{
            type: 'text',
            text: '**bold**\n\n```python\nprint("code")\n```\n\n[ok](https://example.com)',
          }],
        }],
        filters: { thinking: true, tools: true, userMessages: true, assistantMessages: true },
        redactions: { paths: 0, secrets: 0, imagesStripped: 0 },
        createdAt: '2026-09-01T00:00:00.000Z',
      };
      const html = buildShareHtml(payload, { assistantName: 'Claude', userLabel: 'User' });
      const main = html.match(/<main class="messages-list">([\s\S]*?)<\/main>/)![1];
      expect(main).toContain('<strong>bold</strong>');
      expect(main).toContain('<pre><code class="language-python">print(&quot;code&quot;)\n</code></pre>');
      expect(main).toContain('<a href="https://example.com" rel="noopener noreferrer">ok</a>');
    });
  });
});
