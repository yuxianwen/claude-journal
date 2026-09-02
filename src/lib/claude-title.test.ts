import { describe, expect, it } from 'vitest';
import { extractClaudeTitle } from './claude-title';

const userMsg = (text: string) => ({ type: 'user', message: { content: text } });

describe('extractClaudeTitle', () => {
  it('prefers an explicit user rename over everything', () => {
    const lines = [
      { type: 'custom-title', customTitle: 'My renamed session' },
      { type: 'ai-title', aiTitle: 'AI guess' },
      userMsg('do the thing'),
    ];
    expect(extractClaudeTitle(lines, 'abcd1234')).toBe('My renamed session');
  });

  it('uses the AI title — the same one /resume shows', () => {
    const lines = [userMsg('fix the bug'), { type: 'ai-title', aiTitle: '修复登录问题' }];
    expect(extractClaudeTitle(lines, 'abcd1234')).toBe('修复登录问题');
  });

  it('takes the LAST ai-title as the conversation grows', () => {
    const lines = [
      { type: 'ai-title', aiTitle: 'early rough guess' },
      { type: 'ai-title', aiTitle: 'refined final title' },
    ];
    expect(extractClaudeTitle(lines, 'abcd1234')).toBe('refined final title');
  });

  it('skips noise slash commands and injected caveats, then uses the real prompt', () => {
    const lines = [
      userMsg('<local-command-caveat>Caveat: the messages below…</local-command-caveat>'),
      userMsg('<command-name>/clear</command-name>\n<command-message>clear</command-message>\n<command-args></command-args>'),
      userMsg('目前看下 ai 客服状况如何？'),
    ];
    expect(extractClaudeTitle(lines, 'abcd1234')).toBe('目前看下 ai 客服状况如何？');
  });

  it('keeps a meaningful slash command with its args', () => {
    const lines = [
      userMsg('<command-name>/soma-tapd</command-name>\n<command-args>提交代码并记录</command-args>'),
    ];
    expect(extractClaudeTitle(lines, 'abcd1234')).toBe('/soma-tapd 提交代码并记录');
  });

  it('falls back to the session id when nothing is usable', () => {
    const lines = [userMsg('<bash-input>open .</bash-input>')];
    expect(extractClaudeTitle(lines, 'abcd1234-5678')).toBe('abcd1234');
  });
});
