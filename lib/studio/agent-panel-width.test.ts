import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AGENT_PANEL_DEFAULT_WIDTH,
  AGENT_PANEL_MAX_WIDTH,
  AGENT_PANEL_MIN_WIDTH,
  clampAgentPanelWidth,
} from './agent-panel-width';

describe('agent panel width', () => {
  it('keeps a dragged width inside the supported range', () => {
    assert.equal(clampAgentPanelWidth(420, 1440), 420);
    assert.equal(clampAgentPanelWidth(10, 1440), AGENT_PANEL_MIN_WIDTH);
    assert.equal(clampAgentPanelWidth(4_000, 1440), AGENT_PANEL_MAX_WIDTH);
  });

  it('never lets the panel take more than half the window', () => {
    assert.equal(clampAgentPanelWidth(700, 900), 450);
    assert.equal(clampAgentPanelWidth(700, 1200), 600);
  });

  // A 640px window would put half below the minimum, and a panel narrower than
  // its own composer is worse than one that overlaps a little.
  it('honours the minimum even when half the window is smaller', () => {
    assert.equal(clampAgentPanelWidth(320, 400), AGENT_PANEL_MIN_WIDTH);
  });

  it('falls back to the default for unusable input', () => {
    assert.equal(clampAgentPanelWidth(Number.NaN, 1440), AGENT_PANEL_DEFAULT_WIDTH);
  });

  it('rounds to whole pixels', () => {
    assert.equal(clampAgentPanelWidth(412.6, 1440), 413);
  });
});
