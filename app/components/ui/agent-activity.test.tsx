import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { AgentThinking } from './agent-activity';

test('wraps Thinking content in an expandable details component', () => {
  const html = renderToStaticMarkup(
    <AgentThinking label="Thinking">Inspecting the canvas</AgentThinking>,
  );

  assert.match(html, /<details/);
  assert.match(html, /<summary/);
  assert.match(html, />Thinking</);
  assert.match(html, /Inspecting the canvas/);
});

test('opens active Thinking content by default', () => {
  const html = renderToStaticMarkup(
    <AgentThinking active>Planning the workflow</AgentThinking>,
  );

  assert.match(html, /<details[^>]*open=""/);
});
