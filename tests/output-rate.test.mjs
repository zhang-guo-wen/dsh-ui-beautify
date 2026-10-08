import test from 'node:test'
import assert from 'node:assert/strict'
import { charsPerSecond, laneSpeed, observeOutput } from '../src/client/output-rate.ts'

test('beam uses approved speed curve, zero idle and monotonically faster output', () => {
  assert.equal(laneSpeed(0), 0)
  for (const rate of [35, 120, 220, 380, 500]) assert.ok(Math.abs(laneSpeed(rate) - 1.6 * rate / (rate + 220)) < 1e-12)
  assert.ok(laneSpeed(35) < laneSpeed(120) && laneSpeed(120) < laneSpeed(380))
})

test('rate stays stable between chunks, stops on silence, and resets for new step', () => {
  let samples = observeOutput([], 0, 0)
  samples = observeOutput(samples, 60, 500)
  assert.equal(charsPerSecond(samples, 510), 120)
  assert.equal(charsPerSecond(samples, 800), 120)
  assert.equal(charsPerSecond(samples, 1401), 0)
  assert.equal(charsPerSecond(observeOutput(samples, 0, 900), 900), 0)
})
