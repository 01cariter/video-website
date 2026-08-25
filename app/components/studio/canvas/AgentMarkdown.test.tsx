import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import AgentMarkdown from './AgentMarkdown';

test('renders safe GitHub-flavored Markdown for Agent messages', () => {
  const html = renderToStaticMarkup(
    <AgentMarkdown>{`## Plan\n\n- **Write** the script\n- Generate frames\n\n[Source](https://example.com)`}</AgentMarkdown>,
  );

  assert.match(html, /<h2>Plan<\/h2>/);
  assert.match(html, /<strong>Write<\/strong>/);
  assert.match(html, /<ul>/);
  assert.match(html, /target="_blank"/);
  assert.doesNotMatch(html, /dangerouslySetInnerHTML/);
});
